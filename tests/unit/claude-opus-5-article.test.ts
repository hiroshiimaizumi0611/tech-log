import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const heroUrl = new URL('../../src/assets/blog/claude-opus-5-evolution.webp', import.meta.url);

describe('Claude Opus 5 original visual', () => {
  it('stores a 1600x900 WebP suitable for article cards and OGP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('claude-opus-5-evolution.webp');
    expect(metadata).toMatchObject({ width: 1600, height: 900, format: 'webp' });
    expect(bytes.byteLength).toBeGreaterThan(80_000);
  });
});
