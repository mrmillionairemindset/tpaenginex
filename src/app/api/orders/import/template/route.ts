import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'dob',
    'ssnLast4',
    'testType',
    'serviceType',
    'isDOT',
    'jobsiteLocation',
    'scheduledFor',
    'clientOrgId',
  ];

  const example = [
    'John',
    'Doe',
    'john.doe@example.com',
    '555-123-4567',
    '01/15/1985',
    '1234',
    '5-Panel',
    'pre_employment',
    'false',
    '123 Jobsite Rd, City, ST 12345',
    '2026-05-01T09:00:00Z',
    '',
  ];

  const csv = `${headers.join(',')}\n${example.join(',')}\n`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="orders-import-template.csv"',
    },
  });
}
