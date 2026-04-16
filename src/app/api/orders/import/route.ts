import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, persons } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Simple CSV parser — handles basic quoted fields
function parseCSV(text: string): string[][] {
  return text.replace(/\r\n/g, '\n').trim().split('\n').map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  });
}

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'dob',
  'testType',
  'serviceType',
  'isDOT',
  'jobsiteLocation',
] as const;

const VALID_SERVICE_TYPES = new Set([
  'pre_employment',
  'random',
  'post_accident',
  'reasonable_suspicion',
  'physical',
  'other',
  'drug_screen',
]);

export const POST = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!user.role || !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions to import orders' },
      { status: 403 },
    );
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const f = formData.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return NextResponse.json(
      { error: 'CSV must contain a header row and at least one data row' },
      { status: 400 },
    );
  }

  const headers = rows[0].map((h) => h.trim());
  const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required columns: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const idx = (name: string) => headers.indexOf(name);

  const errors: { row: number; error: string }[] = [];
  let imported = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      if (row.length === 1 && row[0] === '') continue; // skip blank

      const get = (name: string) => {
        const j = idx(name);
        return j >= 0 ? (row[j] ?? '').trim() : '';
      };

      const firstName = get('firstName');
      const lastName = get('lastName');
      const email = get('email');
      const phone = get('phone');
      const dob = get('dob');
      const ssnLast4 = get('ssnLast4');
      const testType = get('testType');
      const serviceTypeRaw = get('serviceType');
      const isDOTRaw = get('isDOT').toLowerCase();
      const jobsiteLocation = get('jobsiteLocation');
      const scheduledFor = get('scheduledFor');
      const clientOrgId = get('clientOrgId');

      for (const f of REQUIRED_FIELDS) {
        if (!get(f)) {
          throw new Error(`Missing required field: ${f}`);
        }
      }

      if (!VALID_SERVICE_TYPES.has(serviceTypeRaw)) {
        throw new Error(`Invalid serviceType "${serviceTypeRaw}"`);
      }

      const isDOT = isDOTRaw === 'true' || isDOTRaw === '1' || isDOTRaw === 'yes';

      // Find or create person (by email + tpaOrgId)
      let personId: string;
      const existing = await db.query.persons.findFirst({
        where: and(eq(persons.tpaOrgId, tpaOrgId), eq(persons.email, email)),
      });

      if (existing) {
        personId = existing.id;
      } else {
        const [newPerson] = await db
          .insert(persons)
          .values({
            orgId: user.organization!.id,
            tpaOrgId,
            firstName,
            lastName,
            email,
            phone,
            dob: dob || '01/01/1900',
            ssnLast4: ssnLast4 || '0000',
          })
          .returning();
        personId = newPerson.id;
      }

      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      let scheduledDate: Date | null = null;
      if (scheduledFor) {
        const d = new Date(scheduledFor);
        if (!isNaN(d.getTime())) scheduledDate = d;
      }

      const priority =
        serviceTypeRaw === 'post_accident' || serviceTypeRaw === 'reasonable_suspicion'
          ? 'urgent'
          : 'standard';

      await db.insert(orders).values({
        orgId: clientOrgId || user.organization!.id,
        tpaOrgId,
        clientOrgId: clientOrgId || null,
        personId,
        orderNumber,
        testType,
        serviceType: serviceTypeRaw as any,
        isDOT,
        priority,
        urgency: 'standard',
        jobsiteLocation,
        needsMask: false,
        requestedBy: user.id,
        scheduledFor: scheduledDate,
        status: 'new',
      });

      imported++;
    } catch (err: any) {
      errors.push({ row: rowNum, error: err?.message || 'Unknown error' });
    }
  }

  return NextResponse.json({ imported, errors });
});
