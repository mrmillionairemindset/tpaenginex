import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { persons, orders } from '@/db/schema';
import { and, eq, or, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/search/global?q=...
// Returns grouped results: persons, orders, drivers
export const GET = withAuth(async (req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json({ persons: [], orders: [], drivers: [] });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 2) {
    return NextResponse.json({ persons: [], orders: [], drivers: [] });
  }

  const pattern = `%${q}%`;

  const [personResults, orderResults, driverResults] = await Promise.all([
    db.query.persons.findMany({
      where: and(
        eq(persons.tpaOrgId, user.tpaOrgId),
        or(
          ilike(persons.firstName, pattern),
          ilike(persons.lastName, pattern),
          ilike(persons.email, pattern),
        ),
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        personType: true,
      },
      limit: 5,
    }),
    db.query.orders.findMany({
      where: and(
        eq(orders.tpaOrgId, user.tpaOrgId),
        ilike(orders.orderNumber, pattern),
      ),
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        jobsiteLocation: true,
      },
      limit: 5,
    }),
    db.query.persons.findMany({
      where: and(
        eq(persons.tpaOrgId, user.tpaOrgId),
        eq(persons.personType, 'driver'),
        or(
          ilike(persons.firstName, pattern),
          ilike(persons.lastName, pattern),
          ilike(persons.email, pattern),
        ),
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      limit: 5,
    }),
  ]);

  return NextResponse.json({
    persons: personResults,
    orders: orderResults,
    drivers: driverResults,
  });
});
