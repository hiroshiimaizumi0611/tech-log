import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

import { syncServerRoomDemo } from '../../scripts/sync-server-room-demo.mjs';
import { verifyServerRoomDemo } from '../../scripts/verify-server-room-demo.mjs';

const GLB_SHA256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';
const roots: string[] = [];

type Fixture = {
  root: string;
  source: string;
  blogRoot: string;
  destination: string;
  commit: string;
};

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
  return result.stdout.trim();
}

async function makeFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'server-room-demo-sync-'));
  roots.push(root);
  const source = join(root, 'source');
  const blogRoot = join(root, 'blog');
  const destination = join(blogRoot, 'demos/server-room');
  await mkdir(join(source, 'src/components'), { recursive: true });
  await mkdir(join(source, 'public/models'), { recursive: true });
  await mkdir(blogRoot, { recursive: true });
  git(source, 'init', '-q');
  git(source, 'config', 'user.email', 'test@example.com');
  git(source, 'config', 'user.name', 'Test');
  await writeFile(join(source, 'index.html'), '<main>tagged</main>\n');
  await writeFile(join(source, 'src/main.tsx'), 'export const tagged = true;\n');
  await writeFile(join(source, 'src/components/panel.css'), '.panel { color: red; }\n');
  await writeFile(join(source, 'public/models/server-room.glb'), 'fixture glb\n');
  await writeFile(join(source, 'README.md'), 'ignored\n');
  git(source, 'add', '.');
  git(source, 'commit', '-qm', 'fixture');
  const commit = git(source, 'rev-parse', 'HEAD');
  git(source, 'tag', '-a', 'episode-04-demo', '-m', 'fixture');
  return { root, source, blogRoot, destination, commit };
}

async function syncFixture(fixture: Fixture, options: Record<string, unknown> = {}) {
  return syncServerRoomDemo({
    source: fixture.source,
    tag: 'episode-04-demo',
    expectedCommit: fixture.commit,
    blogRoot: fixture.blogRoot,
    expectedGlbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
    ...options,
  });
}

async function verifyFixture(fixture: Fixture) {
  return verifyServerRoomDemo({
    blogRoot: fixture.blogRoot,
    expectedGlbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
  });
}

async function treeSnapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(directory: string, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else result[relative] = (await readFile(absolute)).toString('hex');
    }
  }
  if ((await lstat(root).catch(() => undefined))?.isDirectory()) await visit(root);
  return result;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('server room demo synchronization', () => {
  test('Prettier ignores only the immutable managed snapshot and not future blog-owned configs', async () => {
    const lines = (await readFile(join(process.cwd(), '.prettierignore'), 'utf8')).split(/\r?\n/).filter(Boolean);
    expect(lines).toEqual(
      expect.arrayContaining([
        'demos/server-room/index.html',
        'demos/server-room/src/',
        'demos/server-room/public/',
        'demos/server-room/upstream.json',
      ]),
    );
    for (const config of ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json']) {
      expect(lines).not.toContain(`demos/server-room/${config}`);
    }
  });

  test('extracts only the allowlisted regular files and writes a sorted deterministic manifest', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);

    const manifest = JSON.parse(await readFile(join(fixture.destination, 'upstream.json'), 'utf8'));
    expect(manifest).toMatchObject({
      schema: 'server-room-demo-upstream',
      version: 1,
      upstream: { tag: 'episode-04-demo', commit: fixture.commit },
    });
    expect(manifest.files.map(({ path }: { path: string }) => path)).toEqual([
      'index.html',
      'public/models/server-room.glb',
      'src/components/panel.css',
      'src/main.tsx',
    ]);
    expect(await lstat(join(fixture.destination, 'README.md')).catch(() => undefined)).toBe(undefined);
    await expect(verifyFixture(fixture)).resolves.toBeDefined();
  });

  test('reads the immutable tag tree instead of dirty working-tree files', async () => {
    const fixture = await makeFixture();
    await writeFile(join(fixture.source, 'src/main.tsx'), 'DIRTY\n');

    await syncFixture(fixture);

    await expect(readFile(join(fixture.destination, 'src/main.tsx'), 'utf8')).resolves.toBe('export const tagged = true;\n');
  });

  test.each([
    ['missing tag', 'missing-tag', undefined],
    ['unexpected commit', 'episode-04-demo', '0'.repeat(40)],
  ])('rejects a %s', async (_name, tag, expectedCommit) => {
    const fixture = await makeFixture();
    await expect(
      syncServerRoomDemo({
        source: fixture.source,
        tag,
        expectedCommit: expectedCommit ?? fixture.commit,
        blogRoot: fixture.blogRoot,
        expectedGlbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
      }),
    ).rejects.toThrow();
  });

  test('rejects a lightweight tag', async () => {
    const fixture = await makeFixture();
    git(fixture.source, 'tag', 'lightweight');
    await expect(
      syncServerRoomDemo({
        source: fixture.source,
        tag: 'lightweight',
        expectedCommit: fixture.commit,
        blogRoot: fixture.blogRoot,
        expectedGlbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
      }),
    ).rejects.toThrow(/annotated/i);
  });

  test.each([
    ['symlink', '120000'],
    ['submodule', '160000'],
  ])('rejects an allowlisted %s entry', async (_name, mode) => {
    const fixture = await makeFixture();
    const blob = git(fixture.source, 'rev-parse', 'HEAD:index.html');
    git(fixture.source, 'update-index', '--add', '--cacheinfo', `${mode},${blob},src/unsafe.ts`);
    git(fixture.source, 'commit', '-qm', 'unsafe entry');
    fixture.commit = git(fixture.source, 'rev-parse', 'HEAD');
    git(fixture.source, 'tag', '-fa', 'episode-04-demo', '-m', 'unsafe');

    await expect(syncFixture(fixture)).rejects.toThrow(/regular file/i);
  });

  test.each(['../outside', '/absolute'])('rejects an invalid destination path: %s', async (destination) => {
    const fixture = await makeFixture();
    await expect(syncFixture(fixture, { destination })).rejects.toThrow(/destination/i);
  });

  test('detects a changed byte, a missing file, and an extra managed file', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const target = join(fixture.destination, 'src/main.tsx');
    await writeFile(target, 'tampered\n');
    await expect(verifyFixture(fixture)).rejects.toThrow(/sha-256/i);
    await syncFixture(fixture);
    await rm(target);
    await expect(verifyFixture(fixture)).rejects.toThrow(/missing/i);
    await syncFixture(fixture);
    await writeFile(join(fixture.destination, 'src/extra.ts'), 'extra\n');
    await expect(verifyFixture(fixture)).rejects.toThrow(/unknown/i);
  });

  test('preserves future blog-owned configs while rejecting any other extra file', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    for (const name of ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json']) {
      await writeFile(join(fixture.destination, name), `${name}\n`);
    }
    await syncFixture(fixture);
    await expect(verifyFixture(fixture)).resolves.toBeDefined();
    await writeFile(join(fixture.destination, 'notes.txt'), 'unknown\n');
    await expect(verifyFixture(fixture)).rejects.toThrow(/unknown/i);
  });

  test('rejects symlinked destination ancestors without changing the linked directory', async () => {
    const fixture = await makeFixture();
    const outside = join(fixture.root, 'outside');
    await mkdir(outside);
    await mkdir(join(fixture.blogRoot, 'demos'));
    await symlink(outside, fixture.destination);
    await expect(syncFixture(fixture)).rejects.toThrow(/symbolic link/i);
    expect(await treeSnapshot(outside)).toEqual({});
  });

  test('rejects a symlinked destination during verification', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const realSnapshot = join(fixture.blogRoot, 'real-snapshot');
    await rename(fixture.destination, realSnapshot);
    await symlink(realSnapshot, fixture.destination);

    await expect(verifyFixture(fixture)).rejects.toThrow(/symbolic link/i);
  });

  test.each([0, 1, 2, 3])('rolls back all four targets when replacement phase %i fails', async (failurePhase) => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const before = await treeSnapshot(fixture.destination);
    await expect(
      syncFixture(fixture, {
        hooks: {
          beforeReplacement(phase: number) {
            if (phase === failurePhase) throw new Error(`injected phase ${phase}`);
          },
        },
      }),
    ).rejects.toThrow(`injected phase ${failurePhase}`);
    expect(await treeSnapshot(fixture.destination)).toEqual(before);
  });

  test('does not mutate an existing snapshot when source validation fails', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const before = await treeSnapshot(fixture.destination);
    await writeFile(join(fixture.source, 'index.html'), 'new\n');
    git(fixture.source, 'add', 'index.html');
    git(fixture.source, 'commit', '-qm', 'new commit');
    git(fixture.source, 'tag', '-fa', 'episode-04-demo', '-m', 'moved');
    await expect(syncFixture(fixture)).rejects.toThrow(/unexpected commit/i);
    expect(await treeSnapshot(fixture.destination)).toEqual(before);
  });

  test('does not mutate an existing snapshot when extraction fails', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const before = await treeSnapshot(fixture.destination);
    await expect(
      syncFixture(fixture, {
        hooks: {
          beforeExtract(path: string) {
            if (path === 'src/main.tsx') throw new Error('injected extraction failure');
          },
        },
      }),
    ).rejects.toThrow('injected extraction failure');
    expect(await treeSnapshot(fixture.destination)).toEqual(before);
  });

  test('rejects malformed, unsorted, duplicate, allowlist-invalid manifests and the wrong GLB hash', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const path = join(fixture.destination, 'upstream.json');
    const original = JSON.parse(await readFile(path, 'utf8'));
    const invalidManifests = [
      { ...original, schema: 'wrong' },
      { ...original, upstream: { ...original.upstream, commit: 'bad' } },
      { ...original, files: [...original.files].reverse() },
      { ...original, files: [...original.files, original.files[0]] },
      {
        ...original,
        files: [{ path: '../escape', sha256: '0'.repeat(64) }, ...original.files],
      },
      {
        ...original,
        files: original.files.map((file: { path: string; sha256: string }) =>
          file.path === 'public/models/server-room.glb' ? { ...file, sha256: GLB_SHA256 } : file,
        ),
      },
    ];
    for (const manifest of invalidManifests) {
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
      await expect(
        verifyServerRoomDemo({
          blogRoot: fixture.blogRoot,
          expectedGlbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
        }),
      ).rejects.toThrow();
    }
  });
});
