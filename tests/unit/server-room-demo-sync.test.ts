import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

import { __testing as syncTesting, syncServerRoomDemo } from '../../scripts/sync-server-room-demo.mjs';
import {
  MANIFEST_SCHEMA,
  MANIFEST_VERSION,
  __testing as verifyTesting,
  computeSnapshotSha256,
  verifyServerRoomDemo,
} from '../../scripts/verify-server-room-demo.mjs';

const GLB_SHA256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';
const roots: string[] = [];

type Fixture = {
  root: string;
  source: string;
  blogRoot: string;
  destination: string;
  commit: string;
};

function fixtureContract(fixture: Fixture) {
  const files = [
    ['index.html', '<main>tagged</main>\n'],
    ['public/models/server-room.glb', 'fixture glb\n'],
    ['src/components/panel.css', '.panel { color: red; }\n'],
    ['src/main.tsx', 'export const tagged = true;\n'],
  ].map(([path, contents]) => ({
    path,
    sha256: createHash('sha256').update(contents).digest('hex'),
  }));
  return {
    tag: 'episode-04-demo',
    commit: fixture.commit,
    glbSha256: createHash('sha256').update('fixture glb\n').digest('hex'),
    snapshotSha256: computeSnapshotSha256({
      schema: MANIFEST_SCHEMA,
      version: MANIFEST_VERSION,
      upstream: { tag: 'episode-04-demo', commit: fixture.commit },
      files,
    }),
  };
}

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
  git(source, 'init', '-q', '--object-format=sha1');
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
  const { hooks, ...syncOptions } = options;
  return syncTesting.syncServerRoomDemo(
    {
      source: fixture.source,
      tag: 'episode-04-demo',
      blogRoot: fixture.blogRoot,
      ...syncOptions,
    },
    fixtureContract(fixture),
    hooks,
  );
}

async function verifyFixture(fixture: Fixture) {
  return verifyTesting.verifyServerRoomDemo({ blogRoot: fixture.blogRoot }, fixtureContract(fixture));
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
  test('uses the documented code-point-sorted canonical snapshot SHA-256 encoding', () => {
    expect(
      computeSnapshotSha256({
        schema: 'server-room-demo-upstream',
        version: 1,
        upstream: {
          tag: 'episode-04-demo',
          commit: '0'.repeat(40),
        },
        files: [
          { path: 'src/app.tsx', sha256: '2'.repeat(64) },
          { path: 'src/App.tsx', sha256: '1'.repeat(64) },
        ],
      }),
    ).toBe('a6fa97dd100ea05fca5f2a953386c54fc234a4c0dcc8c842206d8a27b148a29a');
  });

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
      snapshotSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
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
    const contract = {
      ...fixtureContract(fixture),
      tag,
      commit: expectedCommit ?? fixture.commit,
    };
    await expect(syncTesting.syncServerRoomDemo({ source: fixture.source, tag, blogRoot: fixture.blogRoot }, contract)).rejects.toThrow();
  });

  test('rejects a lightweight tag', async () => {
    const fixture = await makeFixture();
    git(fixture.source, 'tag', '-d', 'episode-04-demo');
    git(fixture.source, 'tag', 'episode-04-demo');
    await expect(
      syncTesting.syncServerRoomDemo(
        {
          source: fixture.source,
          tag: 'episode-04-demo',
          blogRoot: fixture.blogRoot,
        },
        fixtureContract(fixture),
      ),
    ).rejects.toThrow(/annotated/i);
  });

  test('rejects an annotated alias even when it peels to the expected commit', async () => {
    const fixture = await makeFixture();
    git(fixture.source, 'tag', '-a', 'alias-demo', '-m', 'alias', fixture.commit);
    await expect(
      syncServerRoomDemo({
        source: fixture.source,
        tag: 'alias-demo',
        blogRoot: fixture.blogRoot,
      }),
    ).rejects.toThrow(/expected tag/i);
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

  test('rejects tampered bytes even when the manifest file SHA is updated to match', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const target = join(fixture.destination, 'src/main.tsx');
    const manifestPath = join(fixture.destination, 'upstream.json');
    await writeFile(target, 'tampered with matching manifest\n');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files.find((file: { path: string }) => file.path === 'src/main.tsx').sha256 = createHash('sha256')
      .update('tampered with matching manifest\n')
      .digest('hex');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await expect(verifyFixture(fixture)).rejects.toThrow(/snapshot sha-256/i);
  });

  test('public verifier refuses provenance pin overrides', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    await expect(
      verifyServerRoomDemo({
        blogRoot: fixture.blogRoot,
        expectedCommit: fixture.commit,
      }),
    ).rejects.toThrow(/override/i);
    await expect(
      syncServerRoomDemo({
        source: fixture.source,
        tag: 'episode-04-demo',
        blogRoot: fixture.blogRoot,
        expectedCommit: fixture.commit,
      }),
    ).rejects.toThrow(/override/i);
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
    await expect(syncFixture(fixture)).rejects.toThrow(/unknown/i);
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

  test.each(['beforeBackup', 'beforeInstall', 'afterInstall'] as const)(
    'rolls back the whole destination when directory-swap phase %s fails',
    async (failureHook) => {
      const fixture = await makeFixture();
      await syncFixture(fixture);
      const before = await treeSnapshot(fixture.destination);
      await expect(
        syncFixture(fixture, {
          hooks: {
            [failureHook]() {
              throw new Error(`injected ${failureHook}`);
            },
          },
        }),
      ).rejects.toThrow(`injected ${failureHook}`);
      expect(await treeSnapshot(fixture.destination)).toEqual(before);
    },
  );

  test.each(['prepared', 'backing-up', 'installing', 'installed'] as const)(
    'recovers an orphan transaction in journal state %s before the next sync',
    async (crashState) => {
      const fixture = await makeFixture();
      await syncFixture(fixture);
      const crash = Object.assign(new Error(`simulated crash at ${crashState}`), {
        simulatedCrash: true,
      });
      await expect(
        syncFixture(fixture, {
          hooks: {
            afterJournal(state: string) {
              if (state === crashState) throw crash;
            },
          },
        }),
      ).rejects.toThrow(`simulated crash at ${crashState}`);
      const transaction = join(fixture.blogRoot, 'demos', syncTesting.transactionName);
      expect((await lstat(transaction)).isDirectory()).toBe(true);

      await syncFixture(fixture);

      await expect(verifyFixture(fixture)).resolves.toBeDefined();
      expect(await lstat(transaction).catch(() => undefined)).toBeUndefined();
      expect(await lstat(join(fixture.blogRoot, 'demos', syncTesting.lockName)).catch(() => undefined)).toBeUndefined();
    },
  );

  test('retains the durable backup and journal when rollback itself fails', async () => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    await expect(
      syncFixture(fixture, {
        hooks: {
          beforeInstall() {
            throw new Error('install failed');
          },
          beforeRollbackRestore() {
            throw new Error('restore failed');
          },
        },
      }),
    ).rejects.toThrow(/backup retained/i);
    const transaction = join(fixture.blogRoot, 'demos', syncTesting.transactionName);
    expect((await lstat(join(transaction, 'backup'))).isDirectory()).toBe(true);
    expect((await lstat(join(transaction, 'journal.json'))).isFile()).toBe(true);
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
      await expect(verifyTesting.verifyServerRoomDemo({ blogRoot: fixture.blogRoot }, fixtureContract(fixture))).rejects.toThrow();
    }
  });

  test.each(['0'.repeat(40), '1'.repeat(40)])('rejects a well-formed but unexpected manifest commit %s', async (commit) => {
    const fixture = await makeFixture();
    await syncFixture(fixture);
    const path = join(fixture.destination, 'upstream.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.upstream.commit = commit;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);

    await expect(verifyFixture(fixture)).rejects.toThrow(/expected commit/i);
  });
});
