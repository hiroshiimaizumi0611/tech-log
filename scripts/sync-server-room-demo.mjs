import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import lockfile from 'proper-lockfile';

import {
  MANIFEST_SCHEMA,
  MANIFEST_VERSION,
  PRODUCTION_CONTRACT,
  __testing as verifierTesting,
  computeSnapshotSha256,
  isAllowlistedPath,
  isSafeRelativePath,
} from './verify-server-room-demo.mjs';

const BLOG_OWNED_CONFIGS = ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json'];
const PIN_OVERRIDE_KEYS = ['expectedTag', 'expectedCommit', 'expectedGlbSha256', 'expectedSnapshotSha256', 'contract', 'hooks'];
const LOCK_NAME = '.server-room-sync.lock';
const TRANSACTION_NAME = '.server-room-sync-transaction';
const JOURNAL_STATES = new Set(['prepared', 'backing-up', 'installing', 'installed', 'committed', 'rolling-back', 'restored']);

// Threat boundary: the lock coordinates cooperating sync processes and the journal
// recovers process/host crashes. A separate process with arbitrary filesystem write
// access is out of scope. After destination validation/config preservation, the
// transaction only renames the whole destination directory; it does not traverse
// destination children after the final check.
// proper-lockfile uses atomic mkdir plus an mtime heartbeat. Only a lock whose
// heartbeat exceeded the stale threshold is reclaimed; compromised heartbeat
// updates gate every destructive rename below.

function runGit(source, args, { binary = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', source, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const output = Buffer.concat(stdout);
      if (code !== 0) {
        reject(new Error(`git ${args[0]} failed: ${Buffer.concat(stderr).toString('utf8').trim()}`));
      } else {
        resolvePromise(binary ? output : output.toString('utf8').trim());
      }
    });
  });
}

function validateTag(tag) {
  if (typeof tag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(tag) || tag.includes('..') || tag.includes('//')) {
    throw new Error(`Invalid tag name: ${tag}`);
  }
}

async function validateDestination(blogRootOption, destinationOption) {
  const blogRoot = await realpath(blogRootOption);
  const destinationRelative = destinationOption ?? 'demos/server-room';
  if (isAbsolute(destinationRelative) || !isSafeRelativePath(destinationRelative.replaceAll(sep, '/'))) {
    throw new Error(`Demo destination must be a safe relative path: ${destinationRelative}`);
  }
  const destination = resolve(blogRoot, destinationRelative);
  if (!destination.startsWith(`${blogRoot}${sep}`)) {
    throw new Error(`Demo destination must remain inside the blog repository: ${destination}`);
  }
  let cursor = blogRoot;
  for (const part of relative(blogRoot, destination).split(sep)) {
    cursor = join(cursor, part);
    const stat = await lstat(cursor).catch(() => undefined);
    if (stat?.isSymbolicLink()) {
      throw new Error(`Symbolic link is not allowed in destination ancestry: ${cursor}`);
    }
    if (stat && !stat.isDirectory() && cursor !== destination) {
      throw new Error(`Destination ancestor is not a directory: ${cursor}`);
    }
  }
  return { blogRoot, destination };
}

function parseTree(buffer) {
  const entries = [];
  for (const record of buffer.toString('utf8').split('\0')) {
    if (!record) continue;
    const match = /^(\d{6}) ([^ ]+) ([a-f0-9]{40})\t(.+)$/.exec(record);
    if (!match) throw new Error(`Cannot parse git tree entry: ${record}`);
    entries.push({ mode: match[1], type: match[2], object: match[3], path: match[4] });
  }
  return entries;
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function validateJournal(journal, transactionRoot) {
  if (!JOURNAL_STATES.has(journal?.state) || typeof journal?.hadDestination !== 'boolean') {
    throw new Error(`Invalid orphan demo transaction journal; preserving it at ${transactionRoot}`);
  }
  return journal;
}

async function writeJournal(transactionRoot, journal, hooks) {
  const path = join(transactionRoot, 'journal.json');
  const temporaryPath = join(transactionRoot, 'journal.json.tmp');
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(journal)}\n`);
    await handle.sync();
    hooks?.afterJournalTempSynced?.(journal.state);
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);
  await syncDirectory(transactionRoot);
  hooks?.afterJournal?.(journal.state);
}

async function readJournal(transactionRoot) {
  const path = join(transactionRoot, 'journal.json');
  const temporaryPath = join(transactionRoot, 'journal.json.tmp');
  const temporaryStat = await lstat(temporaryPath).catch(() => undefined);
  const pathStat = await lstat(path).catch(() => undefined);
  if (temporaryStat) {
    if (!temporaryStat.isFile() || temporaryStat.isSymbolicLink()) {
      throw new Error(`Unsafe temporary journal; preserving it at ${temporaryPath}`);
    }
    if (pathStat) {
      await rm(temporaryPath);
      await syncDirectory(transactionRoot);
    } else {
      let temporaryJournal;
      try {
        temporaryJournal = validateJournal(JSON.parse(await readFile(temporaryPath, 'utf8')), transactionRoot);
      } catch (error) {
        throw new Error(`Cannot recover temporary journal; preserving ${transactionRoot}: ${error.message}`);
      }
      await rename(temporaryPath, path);
      await syncDirectory(transactionRoot);
      return temporaryJournal;
    }
  }
  const stat = await lstat(path).catch(() => undefined);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Orphan demo transaction has no safe journal; preserving it at ${transactionRoot}`);
  }
  let journal;
  try {
    journal = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read orphan demo transaction journal; preserving ${transactionRoot}: ${error.message}`);
  }
  return validateJournal(journal, transactionRoot);
}

async function acquireLock(parent, options = {}) {
  const lockPath = join(parent, LOCK_NAME);
  let compromised;
  const release = await lockfile.lock(parent, {
    realpath: true,
    lockfilePath: lockPath,
    stale: options.stale ?? 10_000,
    update: options.update ?? 2_000,
    retries: options.retries ?? { retries: 20, minTimeout: 250, maxTimeout: 500 },
    onCompromised(error) {
      compromised = error;
    },
  });
  return {
    assertHealthy() {
      if (compromised) {
        throw new Error(`Demo sync lock was compromised: ${compromised.message}`, {
          cause: compromised,
        });
      }
    },
    async release() {
      await release();
      await syncDirectory(parent);
    },
  };
}

async function extractSnapshot({ source, tag, contract, stageDestination, hooks }) {
  validateTag(tag);
  const tagType = await runGit(source, ['cat-file', '-t', tag]).catch((error) => {
    throw new Error(`Cannot resolve annotated tag ${tag}: ${error.message}`);
  });
  if (tagType !== 'tag') {
    throw new Error(`Tag ${tag} must be an annotated tag; found ${tagType}`);
  }
  const commit = await runGit(source, ['rev-parse', `${tag}^{}`]);
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error(`Tag ${tag} did not resolve to a 40-character commit`);
  }
  if (commit !== contract.commit) {
    throw new Error(`Tag ${tag} resolved to unexpected commit ${commit}; expected ${contract.commit}`);
  }
  if ((await runGit(source, ['cat-file', '-t', commit])) !== 'commit') {
    throw new Error(`Annotated tag ${tag} does not point to a commit`);
  }
  const tree = parseTree(await runGit(source, ['ls-tree', '-r', '-z', commit], { binary: true }));
  const candidates = tree.filter((entry) => isAllowlistedPath(entry.path));
  for (const entry of candidates) {
    if (!isSafeRelativePath(entry.path)) {
      throw new Error(`Unsafe extraction path: ${entry.path}`);
    }
    if ((entry.mode !== '100644' && entry.mode !== '100755') || entry.type !== 'blob') {
      throw new Error(`Allowlisted candidate must be a regular file: ${entry.path} has mode ${entry.mode} and type ${entry.type}`);
    }
  }
  const paths = candidates.map((entry) => entry.path).sort();
  for (const required of ['index.html', 'public/models/server-room.glb']) {
    if (!paths.includes(required)) throw new Error(`Upstream tree is missing ${required}`);
  }
  const files = [];
  for (const path of paths) {
    hooks?.beforeExtract?.(path);
    const output = join(stageDestination, ...path.split('/'));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, await runGit(source, ['show', `${commit}:${path}`], { binary: true }));
    files.push({ path, sha256: await sha256(output) });
  }
  const glb = files.find((file) => file.path === 'public/models/server-room.glb');
  if (glb.sha256 !== contract.glbSha256) {
    throw new Error(`GLB SHA-256 mismatch: expected ${contract.glbSha256}, got ${glb.sha256}`);
  }
  const snapshotSha256 = computeSnapshotSha256({
    schema: MANIFEST_SCHEMA,
    version: MANIFEST_VERSION,
    upstream: { tag, commit },
    files,
  });
  if (snapshotSha256 !== contract.snapshotSha256) {
    throw new Error(`Snapshot SHA-256 mismatch: expected ${contract.snapshotSha256}, got ${snapshotSha256}`);
  }
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: MANIFEST_VERSION,
    upstream: { tag, commit },
    snapshotSha256,
    files,
  };
  await writeFile(join(stageDestination, 'upstream.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function preserveBlogOwnedConfigs(destination, stageDestination) {
  for (const name of BLOG_OWNED_CONFIGS) {
    const source = join(destination, name);
    const stat = await lstat(source).catch(() => undefined);
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Blog-owned config must be a regular file: ${source}`);
    }
    await copyFile(source, join(stageDestination, name));
  }
}

async function validateExistingDestinationShape(destination) {
  const allowedBlogFiles = new Set(['upstream.json', ...BLOG_OWNED_CONFIGS]);
  const isAllowedDirectory = (path) => path === 'src' || path.startsWith('src/') || path === 'public' || path === 'public/models';
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic link is not allowed in existing demo: ${path}`);
      }
      if (entry.isDirectory()) {
        if (!isAllowedDirectory(path)) {
          throw new Error(`Unknown directory in existing demo snapshot: ${path}`);
        }
        await visit(absolute, path);
      } else if (!entry.isFile()) {
        throw new Error(`Non-regular file is not allowed in existing demo: ${path}`);
      } else if (!allowedBlogFiles.has(path) && !isAllowlistedPath(path)) {
        throw new Error(`Unknown file in existing demo snapshot: ${path}`);
      }
    }
  }
  await visit(destination);
}

async function fsyncStagedTree(root, hooks) {
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, path);
      } else if (entry.isFile()) {
        const handle = await open(absolute, 'r');
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
        hooks?.onDurabilityEvent?.({ type: 'file', path });
      } else {
        throw new Error(`Cannot fsync non-regular staged entry: ${path}`);
      }
    }
    await syncDirectory(directory);
    hooks?.onDurabilityEvent?.({
      type: 'directory',
      path: prefix || '.',
    });
  }
  await visit(root);
}

async function restoreOldDestination({ destination, transactionRoot, journal, hooks, assertLockHealthy = () => {} }) {
  const backup = join(transactionRoot, 'backup');
  const interrupted = join(transactionRoot, 'interrupted-new');
  const startingState = journal.state;
  try {
    assertLockHealthy();
    hooks?.beforeRollbackRestore?.();
    journal = { ...journal, state: 'rolling-back' };
    await writeJournal(transactionRoot, journal, hooks);
    const destinationExists = Boolean(await lstat(destination).catch(() => undefined));
    const backupExists = Boolean(await lstat(backup).catch(() => undefined));
    const interruptedExists = Boolean(await lstat(interrupted).catch(() => undefined));
    if (journal.hadDestination) {
      if (backupExists) {
        if (destinationExists) {
          if (interruptedExists) {
            throw new Error('both destination and interrupted-new exist during rollback');
          }
          assertLockHealthy();
          await rename(destination, interrupted);
          await syncDirectory(dirname(destination));
        }
        assertLockHealthy();
        await rename(backup, destination);
        await syncDirectory(dirname(destination));
        hooks?.afterBackupRestored?.();
      } else if (!destinationExists || (!interruptedExists && !['prepared', 'backing-up', 'rolling-back'].includes(startingState))) {
        throw new Error('old destination backup is missing');
      }
    } else if (destinationExists) {
      if (interruptedExists) {
        throw new Error('both destination and interrupted-new exist during rollback');
      }
      assertLockHealthy();
      await rename(destination, interrupted);
      await syncDirectory(dirname(destination));
    }
    journal = { ...journal, state: 'restored' };
    await writeJournal(transactionRoot, journal, hooks);
    assertLockHealthy();
    await rm(transactionRoot, { recursive: true });
    await syncDirectory(dirname(destination));
  } catch (error) {
    throw new Error(`Demo sync rollback failed; backup retained at ${backup}: ${error.message}`, { cause: error });
  }
}

async function recoverOrphanTransaction({ destination, transactionRoot, assertLockHealthy }) {
  const stat = await lstat(transactionRoot).catch(() => undefined);
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Unsafe orphan demo transaction; preserving it at ${transactionRoot}`);
  }
  const journal = await readJournal(transactionRoot);
  if (journal.state === 'committed' || journal.state === 'restored') {
    assertLockHealthy();
    await rm(transactionRoot, { recursive: true });
    await syncDirectory(dirname(destination));
    return;
  }
  await restoreOldDestination({
    destination,
    transactionRoot,
    journal,
    assertLockHealthy,
  });
}

async function replaceDirectory({ destination, transactionRoot, stageDestination, hadDestination, hooks, assertLockHealthy }) {
  const backup = join(transactionRoot, 'backup');
  let journal = { state: 'prepared', hadDestination };
  try {
    await writeJournal(transactionRoot, journal, hooks);
    journal = { ...journal, state: 'backing-up' };
    await writeJournal(transactionRoot, journal, hooks);
    hooks?.beforeBackup?.();
    if (hadDestination) {
      assertLockHealthy();
      await rename(destination, backup);
      await syncDirectory(dirname(destination));
    }

    journal = { ...journal, state: 'installing' };
    await writeJournal(transactionRoot, journal, hooks);
    hooks?.beforeInstall?.();
    assertLockHealthy();
    await rename(stageDestination, destination);
    await syncDirectory(dirname(destination));

    journal = { ...journal, state: 'installed' };
    await writeJournal(transactionRoot, journal, hooks);
    hooks?.afterInstall?.();
    journal = { ...journal, state: 'committed' };
    await writeJournal(transactionRoot, journal, hooks);
    assertLockHealthy();
    await rm(transactionRoot, { recursive: true });
    await syncDirectory(dirname(destination));
  } catch (error) {
    if (error?.simulatedCrash) throw error;
    await restoreOldDestination({
      destination,
      transactionRoot,
      journal,
      hooks,
      assertLockHealthy,
    });
    throw error;
  }
}

async function syncWithContract(options, contract, hooks = {}) {
  const sourceOption = options?.source;
  if (!sourceOption || !isAbsolute(sourceOption)) {
    throw new Error('--source must be an absolute path');
  }
  const source = await realpath(sourceOption);
  const tag = options.tag;
  if (tag !== contract.tag) {
    throw new Error(`Invalid upstream tag; expected tag ${contract.tag}`);
  }
  const defaultBlogRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { blogRoot, destination } = await validateDestination(options.blogRoot ?? defaultBlogRoot, options.destination);
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const heldLock = await acquireLock(parent, hooks.lockOptions);
  const transactionRoot = join(parent, TRANSACTION_NAME);
  const stageDestination = join(transactionRoot, 'stage');
  try {
    await recoverOrphanTransaction({
      destination,
      transactionRoot,
      assertLockHealthy: () => heldLock.assertHealthy(),
    });
    const destinationStat = await lstat(destination).catch(() => undefined);
    const hadDestination = Boolean(destinationStat);
    if (destinationStat && (!destinationStat.isDirectory() || destinationStat.isSymbolicLink())) {
      throw new Error(`Demo destination must be a real directory: ${destination}`);
    }
    if (hadDestination) await validateExistingDestinationShape(destination);
    await mkdir(transactionRoot);
    await mkdir(stageDestination);
    try {
      const manifest = await extractSnapshot({
        source,
        tag,
        contract,
        stageDestination,
        hooks,
      });
      if (hadDestination) {
        await preserveBlogOwnedConfigs(destination, stageDestination);
      }
      await verifierTesting.verifyServerRoomDemo({ blogRoot, destination: relative(blogRoot, stageDestination) }, contract);
      await fsyncStagedTree(stageDestination, hooks);
      heldLock.assertHealthy();
      await replaceDirectory({
        destination,
        transactionRoot,
        stageDestination,
        hadDestination,
        hooks,
        assertLockHealthy: () => heldLock.assertHealthy(),
      });
      return { destination, manifest };
    } catch (error) {
      const journalExists = await lstat(join(transactionRoot, 'journal.json')).catch(() => undefined);
      if (!journalExists && !error?.simulatedCrash) {
        await rm(transactionRoot, { recursive: true }).catch(() => {});
      }
      throw error;
    }
  } finally {
    await heldLock.release();
  }
}

function rejectPinOverrides(options) {
  for (const key of PIN_OVERRIDE_KEYS) {
    if (Object.hasOwn(options, key)) {
      throw new Error(`Public sync does not allow provenance override: ${key}`);
    }
  }
}

export async function syncServerRoomDemo(options) {
  rejectPinOverrides(options ?? {});
  return syncWithContract(options, PRODUCTION_CONTRACT);
}

export const __testing = Object.freeze({
  syncServerRoomDemo: syncWithContract,
  transactionName: TRANSACTION_NAME,
  lockName: LOCK_NAME,
});

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--source' && argument !== '--tag') {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    result[argument.slice(2)] = value;
    index += 1;
  }
  if (!result.source || !result.tag) {
    throw new Error('Usage: node scripts/sync-server-room-demo.mjs --source /absolute/source --tag episode-04-demo');
  }
  return result;
}

async function main() {
  try {
    const result = await syncServerRoomDemo(parseArguments(process.argv.slice(2)));
    console.log(`Synced ${result.manifest.files.length} files from ${result.manifest.upstream.tag} (${result.manifest.upstream.commit}).`);
  } catch (error) {
    console.error(`Server room demo sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
