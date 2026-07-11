import { describe, expect, it } from 'vitest';

import { paginate } from '../../src/lib/content/pagination';

describe('paginate', () => {
  it('splits items into pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('keeps listing pages at 12 items', () => {
    const items = Array.from({ length: 13 }, (_, index) => index + 1);

    expect(paginate(items, 12)).toEqual([items.slice(0, 12), [13]]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid page size %s', (pageSize) => {
    expect(() => paginate([1], pageSize)).toThrow(/positive integer/i);
  });
});
