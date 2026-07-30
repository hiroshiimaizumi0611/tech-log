import { describe, expect, it } from 'vitest';

import { buildPaginationModel, paginate } from '../../src/lib/content/pagination';

describe('paginate', () => {
  it('splits items into pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('keeps listing pages at 12 items', () => {
    const items = Array.from({ length: 14 }, (_, index) => index + 1);

    expect(paginate(items, 12)).toEqual([items.slice(0, 12), [13, 14]]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid page size %s', (pageSize) => {
    expect(() => paginate([1], pageSize)).toThrow(/positive integer/i);
  });
});

describe('buildPaginationModel', () => {
  it('builds first, middle, and last page links without invalid destinations', () => {
    expect(buildPaginationModel(1, 3, '/blog/')).toEqual({ current: 1, total: 3, previousHref: undefined, nextHref: '/blog/page/2/' });
    expect(buildPaginationModel(2, 3, '/blog/')).toEqual({ current: 2, total: 3, previousHref: '/blog/', nextHref: '/blog/page/3/' });
    expect(buildPaginationModel(3, 3, '/blog/')).toEqual({ current: 3, total: 3, previousHref: '/blog/page/2/', nextHref: undefined });
  });

  it.each([
    [0, 1],
    [2, 1],
    [1, 0],
  ])('rejects invalid current/total pair %s/%s', (current, total) => {
    expect(() => buildPaginationModel(current, total, '/blog/')).toThrow(/valid current page/i);
  });
});
