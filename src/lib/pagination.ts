/**
 * Shared pagination utilities for API routes.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const rawPage = searchParams.get('page');
  const rawLimit = searchParams.get('limit');

  const parsedPage = rawPage === null ? 1 : parseInt(rawPage, 10);
  const parsedLimit = rawLimit === null ? DEFAULT_LIMIT : parseInt(rawLimit, 10);

  // NaN → default; otherwise clamp
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build a paginated response object.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasMore: params.offset + data.length < total,
    },
  };
}
