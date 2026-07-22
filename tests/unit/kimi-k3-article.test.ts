import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const heroUrl = new URL('../../src/assets/blog/kimi-k3-official-hero.webp', import.meta.url);

describe('Kimi K3 official visual', () => {
  it('stores the official hero as a real 1920x879 WebP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('kimi-k3-official-hero.webp');
    expect(metadata).toMatchObject({ width: 1920, height: 879, format: 'webp' });
  });
});
