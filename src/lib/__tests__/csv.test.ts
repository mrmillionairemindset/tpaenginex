import { describe, it, expect } from 'vitest';
import { toCsv, csvResponse } from '../csv';

describe('toCsv', () => {
  it('generates a CSV with string column keys as headers', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const csv = toCsv(rows, ['name', 'age']);
    expect(csv).toBe('name,age\nAlice,30\nBob,25');
  });

  it('supports accessor functions with custom headers', () => {
    const rows = [{ firstName: 'Alice', lastName: 'Smith' }];
    const csv = toCsv(rows, [
      { header: 'Full Name', accessor: (r) => `${r.firstName} ${r.lastName}` },
    ]);
    expect(csv).toBe('Full Name\nAlice Smith');
  });

  it('escapes cells containing commas', () => {
    const rows = [{ value: 'hello, world' }];
    const csv = toCsv(rows, ['value']);
    expect(csv).toBe('value\n"hello, world"');
  });

  it('escapes cells containing quotes (double them)', () => {
    const rows = [{ value: 'she said "hi"' }];
    const csv = toCsv(rows, ['value']);
    expect(csv).toBe('value\n"she said ""hi"""');
  });

  it('escapes cells containing newlines', () => {
    const rows = [{ value: 'line1\nline2' }];
    const csv = toCsv(rows, ['value']);
    expect(csv).toBe('value\n"line1\nline2"');
  });

  it('renders null as empty', () => {
    const rows = [{ value: null }];
    const csv = toCsv(rows, ['value']);
    expect(csv).toBe('value\n');
  });

  it('renders undefined as empty', () => {
    const rows = [{ value: undefined }];
    const csv = toCsv(rows, ['value' as any]);
    expect(csv).toBe('value\n');
  });

  it('JSON-encodes object values (with CSV quote-escaping)', () => {
    const rows = [{ meta: { foo: 'bar' } }];
    const csv = toCsv(rows, ['meta']);
    // Quotes inside JSON are doubled per RFC 4180 and the whole cell is quoted
    expect(csv).toBe('meta\n"{""foo"":""bar""}"');
  });

  it('handles empty rows array', () => {
    const csv = toCsv([], ['col1', 'col2']);
    expect(csv).toBe('col1,col2');
  });

  it('handles multiple columns with mixed accessor types', () => {
    const rows = [{ a: 1, b: 2, c: 3 }];
    const csv = toCsv(rows, [
      'a',
      { header: 'B Plus One', accessor: (r) => r.b + 1 },
      'c',
    ]);
    expect(csv).toBe('a,B Plus One,c\n1,3,3');
  });
});

describe('csvResponse', () => {
  it('returns a Response with CSV content type', () => {
    const res = csvResponse('col1,col2\nval1,val2', 'test.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('test.csv');
  });

  it('returns the body content', async () => {
    const csv = 'a,b\n1,2';
    const res = csvResponse(csv, 'x.csv');
    expect(await res.text()).toBe(csv);
  });
});
