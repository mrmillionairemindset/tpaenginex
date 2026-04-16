/**
 * GET /api/docs — serves the OpenAPI 3.1 spec as JSON.
 * GET /api/docs?format=yaml — serves the spec as YAML (optional)
 *
 * No auth required — the spec describes the public API surface and contains
 * no secrets or tenant data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi/registry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const spec = buildOpenApiSpec();

  const format = new URL(req.url).searchParams.get('format');
  if (format === 'yaml') {
    // Basic YAML serialization — good enough for OpenAPI docs
    const yaml = toYaml(spec);
    return new Response(yaml, {
      status: 200,
      headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
    });
  }

  return NextResponse.json(spec, {
    headers: {
      // Docs can be cached briefly
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

/**
 * Minimal, dependency-free YAML serializer for plain JSON-compatible values.
 * Handles strings, numbers, booleans, null, arrays, objects. No custom tags.
 */
function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // Quote strings that contain special characters or look like other types
    if (/^[\w.-]+$/.test(value) && !/^(true|false|null|yes|no)$/i.test(value) && !/^[\d.]+$/.test(value)) {
      return value;
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => `\n${pad}- ${toYaml(item, indent + 1).replace(/\n/g, `\n${pad}  `)}`)
      .join('');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, v]) => {
        const serialized = toYaml(v, indent + 1);
        const isBlock = typeof v === 'object' && v !== null && !(Array.isArray(v) && v.length === 0);
        if (isBlock) {
          return `\n${pad}${key}:${serialized.startsWith('\n') ? '' : '\n' + pad + '  '}${serialized}`;
        }
        return `\n${pad}${key}: ${serialized}`;
      })
      .join('');
  }

  return JSON.stringify(value);
}
