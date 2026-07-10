import { describe, expect, it } from 'vitest';

import { paginate } from '../../src/lib/content/pagination';

describe('paginate', () => {
  it('splits items into pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid page size %s', (pageSize) => {
    expect(() => paginate([1], pageSize)).toThrow(/positive integer/i);
  });
});
