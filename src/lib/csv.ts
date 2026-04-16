/**
 * Lightweight CSV serialization — no external dependencies.
 */

/**
 * Escape a single CSV cell. Wraps in quotes if it contains a comma,
 * quote, or newline; doubles internal quotes per RFC 4180.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize an array of objects to a CSV string.
 *
 * @param rows - Array of row objects
 * @param columns - Either an array of column keys (uses key as header) or
 *                  array of `{ header, accessor }` for custom rendering
 */
export function toCsv<T extends Record<string, any>>(
  rows: T[],
  columns: Array<keyof T | { header: string; accessor: (row: T) => unknown }>
): string {
  const headers = columns.map((c) =>
    typeof c === 'object' && c !== null && 'header' in c ? c.header : String(c)
  );
  const headerRow = headers.map(escapeCell).join(',');

  const dataRows = rows.map((row) =>
    columns
      .map((c) => {
        const value =
          typeof c === 'object' && c !== null && 'accessor' in c
            ? c.accessor(row)
            : row[c as keyof T];
        return escapeCell(value);
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Build a Response object that downloads as a CSV file.
 */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
