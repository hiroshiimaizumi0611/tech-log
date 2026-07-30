import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_SCHEMA = 'server-room-demo-upstream';
export const MANIFEST_VERSION = 1;
export const EXPECTED_TAG = 'episode-04-demo';
export const EXPECTED_GLB_SHA256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';

const MANAGED_ROOTS = ['index.html', 'public', 'src'];
const BLOG_OWNED_FILES = new Set(['upstream.json', 'vite.config.ts', 'vitest.config.ts', 'tsconfig.json']);
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

async function listFiles(root) {
  const files = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic link is not allowed in demo snapshot: ${path}`);
      }
      if (entry.isDirectory()) {
        await visit(absolute, path);
      } else if (entry.isFile()) {
        files.push(path);
      } else {
        throw new Error(`Non-regular file is not allowed in demo snapshot: ${path}`);
      }
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

function validateManifest(manifest, { expectedTag, expectedGlbSha256 }) {
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA || manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Invalid upstream manifest schema; expected ${MANIFEST_SCHEMA} version ${MANIFEST_VERSION}`);
  }
  if (!manifest.upstream || manifest.upstream.tag !== expectedTag || !COMMIT_PATTERN.test(manifest.upstream.commit)) {
    throw new Error('Invalid upstream tag or 40-character commit in manifest');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Manifest files must be a non-empty array');
  }

  const paths = manifest.files.map((file) => file?.path);
  const sortedPaths = [...paths].sort();
  if (new Set(paths).size !== paths.length) {
    throw new Error('Manifest paths must be unique');
  }
  if (paths.some((path, index) => path !== sortedPaths[index])) {
    throw new Error('Manifest paths must be sorted');
  }
  for (const file of manifest.files) {
    if (!isSafeRelativePath(file?.path) || !isAllowlistedPath(file.path) || !SHA256_PATTERN.test(file?.sha256)) {
      throw new Error(`Invalid manifest file entry: ${JSON.stringify(file)}`);
    }
  }
  for (const required of ['index.html', 'public/models/server-room.glb']) {
    if (!paths.includes(required)) {
      throw new Error(`Manifest is missing required path: ${required}`);
    }
  }
  const glb = manifest.files.find((file) => file.path === 'public/models/server-room.glb');
  if (glb.sha256 !== expectedGlbSha256) {
    throw new Error(`GLB SHA-256 mismatch: expected ${expectedGlbSha256}, got ${glb.sha256}`);
  }
  return manifest;
}

function resolveDestination(blogRoot, destination) {
  const resolved = destination
    ? isAbsolute(destination)
      ? resolve(destination)
      : resolve(blogRoot, destination)
    : resolve(blogRoot, 'demos/server-room');
  const withinRoot = resolved === blogRoot || resolved.startsWith(`${blogRoot}${sep}`);
  if (!withinRoot || resolved === blogRoot) {
    throw new Error(`Demo destination must remain inside the blog repository: ${resolved}`);
  }
  return resolved;
}

export async function verifyServerRoomDemo(options = {}) {
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
  const manifest = validateManifest(parsed, {
    expectedTag: options.expectedTag ?? EXPECTED_TAG,
    expectedGlbSha256: options.expectedGlbSha256 ?? EXPECTED_GLB_SHA256,
  });

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
  }

  return {
    destination: destinationReal,
    manifest,
    fileCount: manifest.files.length,
  };
}

async function main() {
  try {
    const result = await verifyServerRoomDemo();
    console.log(
      `Verified ${result.fileCount} server room demo files from ${result.manifest.upstream.tag} (${result.manifest.upstream.commit}).`,
    );
  } catch (error) {
    console.error(`Server room demo verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
