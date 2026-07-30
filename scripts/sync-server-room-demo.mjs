import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_GLB_SHA256,
  MANIFEST_SCHEMA,
  MANIFEST_VERSION,
  isAllowlistedPath,
  isSafeRelativePath,
  verifyServerRoomDemo,
} from './verify-server-room-demo.mjs';

const EXPECTED_COMMIT = '13bf472051782ff3373e52b1e312b2b380363bc5';
const REPLACEMENT_TARGETS = ['index.html', 'src', 'public', 'upstream.json'];
const BLOG_OWNED_CONFIGS = ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json'];

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

async function extractSnapshot({ source, tag, expectedCommit, expectedGlbSha256, stageDestination, hooks }) {
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
  if (commit !== expectedCommit) {
    throw new Error(`Tag ${tag} resolved to unexpected commit ${commit}; expected ${expectedCommit}`);
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
    if (entry.mode !== '100644' && entry.mode !== '100755') {
      throw new Error(`Allowlisted candidate must be a regular file: ${entry.path} has mode ${entry.mode}`);
    }
    if (entry.type !== 'blob') {
      throw new Error(`Allowlisted candidate must be a regular file blob: ${entry.path} has type ${entry.type}`);
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
  if (glb.sha256 !== expectedGlbSha256) {
    throw new Error(`GLB SHA-256 mismatch: expected ${expectedGlbSha256}, got ${glb.sha256}`);
  }
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: MANIFEST_VERSION,
    upstream: { tag, commit },
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

async function replaceTransaction({ destination, stageDestination, transactionRoot, hooks }) {
  const backupRoot = join(transactionRoot, 'backup');
  await mkdir(backupRoot);
  const states = [];
  try {
    for (let phase = 0; phase < REPLACEMENT_TARGETS.length; phase += 1) {
      hooks?.beforeReplacement?.(phase);
      const name = REPLACEMENT_TARGETS[phase];
      const current = join(destination, name);
      const staged = join(stageDestination, name);
      const backup = join(backupRoot, name);
      const existed = Boolean(await lstat(current).catch(() => undefined));
      const state = { name, current, staged, backup, existed, installed: false };
      states.push(state);
      if (existed) {
        await mkdir(dirname(backup), { recursive: true });
        await rename(current, backup);
      }
      await rename(staged, current);
      state.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const state of states.reverse()) {
      try {
        if (state.installed) await rm(state.current, { recursive: true });
        if (state.existed && (await lstat(state.backup).catch(() => undefined))) {
          await mkdir(dirname(state.current), { recursive: true });
          await rename(state.backup, state.current);
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${state.name}: ${rollbackError.message}`);
      }
    }
    if (rollbackErrors.length) {
      throw new Error(`${error.message}; rollback also failed (${rollbackErrors.join(', ')})`, { cause: error });
    }
    throw error;
  }
}

export async function syncServerRoomDemo(options) {
  const sourceOption = options?.source;
  if (!sourceOption || !isAbsolute(sourceOption)) {
    throw new Error('--source must be an absolute path');
  }
  const source = await realpath(sourceOption);
  const tag = options.tag;
  const expectedCommit = options.expectedCommit ?? EXPECTED_COMMIT;
  const expectedGlbSha256 = options.expectedGlbSha256 ?? EXPECTED_GLB_SHA256;
  const defaultBlogRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { blogRoot, destination } = await validateDestination(options.blogRoot ?? defaultBlogRoot, options.destination);
  const destinationParent = dirname(destination);
  await mkdir(destinationParent, { recursive: true });
  const transactionRoot = await mkdtemp(join(destinationParent, '.server-room-sync-'));
  const stageDestination = join(transactionRoot, 'snapshot');
  await mkdir(stageDestination);
  try {
    const manifest = await extractSnapshot({
      source,
      tag,
      expectedCommit,
      expectedGlbSha256,
      stageDestination,
      hooks: options.hooks,
    });
    const existingDestinationStat = await lstat(destination).catch(() => undefined);
    if (existingDestinationStat) {
      if (!existingDestinationStat.isDirectory() || existingDestinationStat.isSymbolicLink()) {
        throw new Error(`Demo destination must be a real directory: ${destination}`);
      }
      await preserveBlogOwnedConfigs(destination, stageDestination);
    }
    await verifyServerRoomDemo({
      blogRoot,
      destination: relative(blogRoot, stageDestination),
      expectedTag: tag,
      expectedGlbSha256,
    });

    await mkdir(destination, { recursive: true });
    await replaceTransaction({
      destination,
      stageDestination,
      transactionRoot,
      hooks: options.hooks,
    });
    return { destination, manifest };
  } finally {
    await rm(transactionRoot, { recursive: true }).catch(() => {});
  }
}

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
