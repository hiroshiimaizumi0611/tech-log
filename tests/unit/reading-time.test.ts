import { describe, expect, it } from 'vitest';

import { readingMinutes } from '../../src/lib/content/reading-time';

describe('readingMinutes', () => {
  it('removes whitespace, divides by 500, and rounds up', () => {
    expect(readingMinutes(`${'あ'.repeat(250)} \n ${'い'.repeat(251)}`)).toBe(2);
  });

  it('returns at least one minute', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(' \n\t')).toBe(1);
  });
});
