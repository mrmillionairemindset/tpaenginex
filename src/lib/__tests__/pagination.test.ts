import { describe, it, expect } from 'vitest';
import { parsePagination, paginatedResponse } from '../pagination';

describe('parsePagination', () => {
  it('returns defaults for empty params', () => {
    const r = parsePagination(new URLSearchParams());
    expect(r.page).toBe(1);
    expect(r.limit).toBe(50);
    expect(r.offset).toBe(0);
  });

  it('parses valid page and limit', () => {
    const r = parsePagination(new URLSearchParams({ page: '3', limit: '25' }));
    expect(r.page).toBe(3);
    expect(r.limit).toBe(25);
    expect(r.offset).toBe(50);
  });

  it('clamps page to minimum 1', () => {
    const r = parsePagination(new URLSearchParams({ page: '0' }));
    expect(r.page).toBe(1);
  });

  it('clamps page to minimum 1 for negative values', () => {
    const r = parsePagination(new URLSearchParams({ page: '-5' }));
    expect(r.page).toBe(1);
  });

  it('clamps limit to maximum 200', () => {
    const r = parsePagination(new URLSearchParams({ limit: '1000' }));
    expect(r.limit).toBe(200);
  });

  it('clamps limit to minimum 1', () => {
    const r = parsePagination(new URLSearchParams({ limit: '0' }));
    expect(r.limit).toBe(1);
  });

  it('handles non-numeric input by falling back to defaults', () => {
    const r = parsePagination(new URLSearchParams({ page: 'abc', limit: 'xyz' }));
    expect(r.page).toBe(1);
    expect(r.limit).toBe(50);
  });

  it('calculates offset correctly', () => {
    expect(parsePagination(new URLSearchParams({ page: '1', limit: '10' })).offset).toBe(0);
    expect(parsePagination(new URLSearchParams({ page: '2', limit: '10' })).offset).toBe(10);
    expect(parsePagination(new URLSearchParams({ page: '5', limit: '20' })).offset).toBe(80);
  });
});

describe('paginatedResponse', () => {
  it('returns correct metadata when there are more pages', () => {
    const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const res = paginatedResponse(data, 100, { page: 1, limit: 3, offset: 0 });
    expect(res.pagination.page).toBe(1);
    expect(res.pagination.limit).toBe(3);
    expect(res.pagination.total).toBe(100);
    expect(res.pagination.totalPages).toBe(34);
    expect(res.pagination.hasMore).toBe(true);
  });

  it('returns hasMore=false on the last page', () => {
    const data = [{ id: '97' }, { id: '98' }, { id: '99' }];
    const res = paginatedResponse(data, 99, { page: 33, limit: 3, offset: 96 });
    expect(res.pagination.hasMore).toBe(false);
  });

  it('handles empty results', () => {
    const res = paginatedResponse([], 0, { page: 1, limit: 50, offset: 0 });
    expect(res.data).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(res.pagination.totalPages).toBe(0);
    expect(res.pagination.hasMore).toBe(false);
  });
});
