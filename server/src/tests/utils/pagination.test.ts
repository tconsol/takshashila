import { parsePaginationQuery, buildPaginatedResult, MAX_LIMIT } from '../../utils/pagination';

describe('parsePaginationQuery', () => {
  it('returns defaults when query is empty', () => {
    const result = parsePaginationQuery({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
  });

  it('calculates skip correctly', () => {
    const { skip } = parsePaginationQuery({ page: '3', limit: '10' });
    expect(skip).toBe(20);
  });

  it('clamps limit to MAX_LIMIT', () => {
    const { limit } = parsePaginationQuery({ limit: '9999' });
    expect(limit).toBe(MAX_LIMIT);
  });

  it('does not allow page < 1', () => {
    const { page } = parsePaginationQuery({ page: '-5' });
    expect(page).toBe(1);
  });
});

describe('buildPaginatedResult', () => {
  it('builds correct pagination metadata', () => {
    const result = buildPaginatedResult(['a', 'b'], 50, 2, 10);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.page).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('handles zero total', () => {
    const result = buildPaginatedResult([], 0, 1, 20);
    expect(result.pagination.totalPages).toBe(0);
  });
});
