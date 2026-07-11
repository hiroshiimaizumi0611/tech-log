import { describe, expect, it } from 'vitest';

import { resolveHighlightLanguage } from '../../src/lib/highlight-language';

describe('resolveHighlightLanguage', () => {
  it('keeps a valid bundled language', () => {
    expect(resolveHighlightLanguage('typescript')).toBe('typescript');
  });

  it('falls back for an unknown language', () => {
    expect(resolveHighlightLanguage('not-a-real-language')).toBe('text');
  });

  it.each(['constructor', 'toString', '__proto__'])('falls back for inherited property name %s', (language) => {
    expect(resolveHighlightLanguage(language)).toBe('text');
  });
});
