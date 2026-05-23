import type { PaginationQuery, PaginatedResult } from '../shared/types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePaginationQuery(query: PaginationQuery) {
  const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const sortBy = query.sortBy || 'createdAt';

  return { page, limit, skip, sortBy, sortOrder };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
