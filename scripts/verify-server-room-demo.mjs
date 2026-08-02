import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBytes } from 'gltf-validator';

export const MANIFEST_SCHEMA = 'server-room-demo-upstream';
export const MANIFEST_VERSION = 1;
export const EXPECTED_TAG = 'episode-04-demo';
export const EXPECTED_COMMIT = '13bf472051782ff3373e52b1e312b2b380363bc5';
export const EXPECTED_GLB_SHA256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';
export const EXPECTED_SNAPSHOT_SHA256 = '32ef5b3f89ecbd35dfee62daf0ab69349aea48ddda7826dd36068da41afb9385';
export const EXPECTED_SERVER_NODE_NAMES = Object.freeze([
  'server_01_01',
  'server_01_02',
  'server_01_03',
  'server_01_04',
  'server_01_05',
  'server_01_06',
  'server_02_01',
  'server_02_02',
  'server_02_03',
  'server_02_04',
  'server_02_05',
  'server_02_06',
  'server_02_07',
  'server_02_08',
]);

export const PRODUCTION_CONTRACT = Object.freeze({
  tag: EXPECTED_TAG,
  commit: EXPECTED_COMMIT,
  glbSha256: EXPECTED_GLB_SHA256,
  snapshotSha256: EXPECTED_SNAPSHOT_SHA256,
});

const MANAGED_ROOTS = ['index.html', 'public', 'src'];
const BLOG_OWNED_FILES = new Set(['upstream.json', 'vite.config.ts', 'vitest.config.ts', 'tsconfig.json']);
const PIN_OVERRIDE_KEYS = ['expectedTag', 'expectedCommit', 'expectedGlbSha256', 'expectedSnapshotSha256', 'contract'];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export function isSafeRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes('\\') &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

export function isAllowlistedPath(path) {
  return path === 'index.html' || path === 'public/models/server-room.glb' || /^src\/.+\.(?:ts|tsx|css)$/.test(path);
}

/**
 * Canonical encoding: UTF-8 SHA-256 of JSON.stringify over exactly
 * {schema,version,upstream:{tag,commit},files:[{path,sha256},...]}.
 * Files are sorted by path; no whitespace and no trailing newline are encoded.
 */
export function computeSnapshotSha256({ schema, version, upstream, files }) {
  const canonical = JSON.stringify({
    schema,
    version,
    upstream: { tag: upstream.tag, commit: upstream.commit },
    files: [...files]
      .map(({ path, sha256 }) => ({ path, sha256 }))
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function listFiles(root) {
  const files = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic link is not allowed in demo snapshot: ${path}`);
      }
      if (entry.isDirectory()) await visit(absolute, path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Non-regular file is not allowed in demo snapshot: ${path}`);
    }
  }
  await visit(root);
  return files.sort();
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function glbJson(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 20) {
    throw new Error('Published GLB is too short to contain a glTF 2.0 JSON chunk');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('Published GLB must use the glTF 2.0 binary container');
  }
  const declaredLength = view.getUint32(8, true);
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (declaredLength !== bytes.byteLength || jsonType !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) {
    throw new Error('Published GLB has an invalid JSON chunk');
  }
  const json = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).replace(/[\u0000 ]+$/u, '');
  return JSON.parse(json);
}

export async function validateServerRoomGlb(bytes) {
  const report = await validateBytes(bytes, { uri: 'server-room.glb' });
  const numErrors = report.issues?.numErrors;
  const numWarnings = report.issues?.numWarnings;
  if (numErrors !== 0 || numWarnings !== 0) {
    throw new Error(`GLB Validator failed: ${numErrors ?? 'unknown'} errors, ${numWarnings ?? 'unknown'} warnings`);
  }

  const document = glbJson(bytes);
  const serverNodeNames = (document.nodes ?? [])
    .map((node) => node?.name)
    .filter((name) => typeof name === 'string' && /^server_\d{2}_\d{2}$/.test(name))
    .sort();
  if (new Set(serverNodeNames).size !== serverNodeNames.length) {
    throw new Error('Published GLB server node names must be unique');
  }
  if (
    serverNodeNames.length !== EXPECTED_SERVER_NODE_NAMES.length ||
    serverNodeNames.some((name, index) => name !== EXPECTED_SERVER_NODE_NAMES[index])
  ) {
    throw new Error(
      `Published GLB server node names mismatch: expected ${EXPECTED_SERVER_NODE_NAMES.join(', ')}, got ${serverNodeNames.join(', ')}`,
    );
  }

  return { numErrors, numWarnings, serverNodeNames };
}

function assertContract(contract) {
  if (
    !contract ||
    typeof contract.tag !== 'string' ||
    !COMMIT_PATTERN.test(contract.commit) ||
    !SHA256_PATTERN.test(contract.glbSha256) ||
    !SHA256_PATTERN.test(contract.snapshotSha256)
  ) {
    throw new Error('Testing contract must provide tag, commit, GLB SHA-256, and snapshot SHA-256');
  }
}

function validateManifest(manifest, contract) {
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA || manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Invalid upstream manifest schema; expected ${MANIFEST_SCHEMA} version ${MANIFEST_VERSION}`);
  }
  if (!manifest.upstream || manifest.upstream.tag !== contract.tag) {
    throw new Error(`Invalid upstream tag; expected tag ${contract.tag}`);
  }
  if (!COMMIT_PATTERN.test(manifest.upstream.commit)) {
    throw new Error('Invalid 40-character upstream commit in manifest');
  }
  if (manifest.upstream.commit !== contract.commit) {
    throw new Error(`Invalid upstream commit; expected commit ${contract.commit}`);
  }
  if (!SHA256_PATTERN.test(manifest.snapshotSha256)) {
    throw new Error('Invalid snapshotSha256 in manifest');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Manifest files must be a non-empty array');
  }
  const paths = manifest.files.map((file) => file?.path);
  const sortedPaths = [...paths].sort();
  if (new Set(paths).size !== paths.length) throw new Error('Manifest paths must be unique');
  if (paths.some((path, index) => path !== sortedPaths[index])) {
    throw new Error('Manifest paths must be sorted');
  }
  for (const file of manifest.files) {
    if (!isSafeRelativePath(file?.path) || !isAllowlistedPath(file.path) || !SHA256_PATTERN.test(file?.sha256)) {
      throw new Error(`Invalid manifest file entry: ${JSON.stringify(file)}`);
    }
  }
  for (const required of ['index.html', 'public/models/server-room.glb']) {
    if (!paths.includes(required)) throw new Error(`Manifest is missing required path: ${required}`);
  }
  const glb = manifest.files.find((file) => file.path === 'public/models/server-room.glb');
  if (glb.sha256 !== contract.glbSha256) {
    throw new Error(`GLB SHA-256 mismatch: expected ${contract.glbSha256}, got ${glb.sha256}`);
  }
  return manifest;
}

function resolveDestination(blogRoot, destination) {
  const resolved = destination
    ? isAbsolute(destination)
      ? resolve(destination)
      : resolve(blogRoot, destination)
    : resolve(blogRoot, 'demos/server-room');
  if (resolved === blogRoot || (!resolved.startsWith(`${blogRoot}${sep}`) && resolved !== blogRoot)) {
    throw new Error(`Demo destination must remain inside the blog repository: ${resolved}`);
  }
  return resolved;
}

async function verifyWithContract(options, contract) {
  assertContract(contract);
  const blogRoot = await realpath(options.blogRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const destination = resolveDestination(blogRoot, options.destination);
  let cursor = blogRoot;
  for (const part of relative(blogRoot, destination).split(sep)) {
    cursor = join(cursor, part);
    const stat = await lstat(cursor).catch(() => undefined);
    if (stat?.isSymbolicLink()) {
      throw new Error(`Symbolic link is not allowed in destination ancestry: ${cursor}`);
    }
  }
  const destinationReal = await realpath(destination);
  const relativeDestination = relative(blogRoot, destinationReal);
  if (relativeDestination === '..' || relativeDestination.startsWith(`..${sep}`) || isAbsolute(relativeDestination)) {
    throw new Error(`Demo destination resolves outside the blog repository: ${destination}`);
  }

  const manifestPath = join(destinationReal, 'upstream.json');
  const manifestStat = await lstat(manifestPath).catch(() => undefined);
  if (!manifestStat?.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error('Missing regular upstream.json manifest');
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse upstream.json: ${error.message}`);
  }
  const manifest = validateManifest(parsed, contract);
  const actualFiles = await listFiles(destinationReal);
  const manifestPaths = new Set(manifest.files.map((file) => file.path));
  for (const path of actualFiles) {
    const managed = path === MANAGED_ROOTS[0] || MANAGED_ROOTS.slice(1).some((root) => path.startsWith(`${root}/`));
    if (managed && !manifestPaths.has(path)) {
      throw new Error(`Unknown managed file is not recorded in manifest: ${path}`);
    }
    if (!managed && !BLOG_OWNED_FILES.has(path)) {
      throw new Error(`Unknown file in demo snapshot: ${path}`);
    }
  }

  const actualFilesForDigest = [];
  for (const file of manifest.files) {
    const absolute = join(destinationReal, ...file.path.split('/'));
    const stat = await lstat(absolute).catch(() => undefined);
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Missing regular manifest file: ${file.path}`);
    }
    const actualSha256 = await sha256(absolute);
    if (actualSha256 !== file.sha256) {
      throw new Error(`SHA-256 mismatch for ${file.path}: expected ${file.sha256}, got ${actualSha256}`);
    }
    actualFilesForDigest.push({ path: file.path, sha256: actualSha256 });
  }
  const actualSnapshotSha256 = computeSnapshotSha256({
    schema: manifest.schema,
    version: manifest.version,
    upstream: manifest.upstream,
    files: actualFilesForDigest,
  });
  if (manifest.snapshotSha256 !== actualSnapshotSha256 || actualSnapshotSha256 !== contract.snapshotSha256) {
    throw new Error(`Snapshot SHA-256 mismatch: expected ${contract.snapshotSha256}, got ${actualSnapshotSha256}`);
  }

  return {
    destination: destinationReal,
    manifest,
    fileCount: manifest.files.length,
  };
}

function rejectPinOverrides(options) {
  for (const key of PIN_OVERRIDE_KEYS) {
    if (Object.hasOwn(options, key)) {
      throw new Error(`Public verifier does not allow provenance override: ${key}`);
    }
  }
}

export async function verifyServerRoomDemo(options = {}) {
  rejectPinOverrides(options);
  const result = await verifyWithContract(options, PRODUCTION_CONTRACT);
  const glbValidation = await validateServerRoomGlb(await readFile(join(result.destination, 'public/models/server-room.glb')));
  return { ...result, glbValidation };
}

export const __testing = Object.freeze({
  verifyServerRoomDemo: verifyWithContract,
});

async function main() {
  try {
    const result = await verifyServerRoomDemo();
    console.log(
      `Verified ${result.fileCount} server room demo files from ${result.manifest.upstream.tag} (${result.manifest.upstream.commit}); GLB: ${result.glbValidation.numErrors} errors, ${result.glbValidation.numWarnings} warnings, ${result.glbValidation.serverNodeNames.length} server nodes.`,
    );
  } catch (error) {
    console.error(`Server room demo verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
