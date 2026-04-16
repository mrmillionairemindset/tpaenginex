import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type CheckStatus = 'up' | 'down' | 'skipped';

interface BaseCheck {
  status: CheckStatus | 'configured' | 'not_configured';
  latencyMs?: number;
  error?: string;
}

export async function GET() {
  const timestamp = new Date().toISOString();

  // Database check
  const dbStart = Date.now();
  let dbCheck: BaseCheck;
  try {
    await db.execute(sql`SELECT 1`);
    dbCheck = { status: 'up', latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    dbCheck = {
      status: 'down',
      latencyMs: Date.now() - dbStart,
      error: err?.message || 'database error',
    };
  }

  // Redis check (optional)
  let redisCheck: BaseCheck;
  if (process.env.REDIS_URL) {
    const redisStart = Date.now();
    try {
      const { redis } = await import('@/lib/redis');
      if (redis && typeof (redis as any).ping === 'function') {
        await (redis as any).ping();
        redisCheck = { status: 'up', latencyMs: Date.now() - redisStart };
      } else {
        redisCheck = { status: 'skipped' };
      }
    } catch (err: any) {
      redisCheck = {
        status: 'down',
        latencyMs: Date.now() - redisStart,
        error: err?.message || 'redis error',
      };
    }
  } else {
    redisCheck = { status: 'skipped' };
  }

  // Storage check
  let storageCheck: BaseCheck;
  try {
    storageCheck = {
      status: isStorageConfigured() ? 'configured' : 'not_configured',
    };
  } catch {
    storageCheck = { status: 'not_configured' };
  }

  // Overall status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (dbCheck.status === 'down') {
    status = 'unhealthy';
  } else {
    const anyDown = redisCheck.status === 'down';
    status = anyDown ? 'degraded' : 'healthy';
  }

  return NextResponse.json(
    {
      status,
      timestamp,
      checks: {
        database: dbCheck,
        redis: redisCheck,
        storage: storageCheck,
      },
    },
    { status: 200 },
  );
}
