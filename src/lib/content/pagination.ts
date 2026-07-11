export function assertNonNegativeInteger(value: number, name = 'value'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

export function paginate<T>(items: readonly T[], pageSize: number): T[][] {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('pageSize must be a positive integer');
  }

  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

export interface PaginationModel {
  current: number;
  total: number;
  previousHref?: string;
  nextHref?: string;
}

export function listingPageHref(page: number, base: string): string {
  if (!Number.isInteger(page) || page < 1) throw new RangeError('page must be a positive integer');
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return page === 1 ? normalizedBase : `${normalizedBase}page/${page}/`;
}

export function buildPaginationModel(current: number, total: number, base: string): PaginationModel {
  if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < 1 || current > total) {
    throw new RangeError('Pagination requires a valid current page and total page count');
  }

  return {
    current,
    total,
    previousHref: current > 1 ? listingPageHref(current - 1, base) : undefined,
    nextHref: current < total ? listingPageHref(current + 1, base) : undefined,
  };
}
