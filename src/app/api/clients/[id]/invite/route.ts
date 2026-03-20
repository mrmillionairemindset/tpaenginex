import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, organizations, organizationMembers } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sendUserInviteEmail } from '@/lib/email';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
});

// POST /api/clients/[id]/invite — TPA admin invites a user to a client org
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only TPA admins can invite client users' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  // Verify client org exists and belongs to this TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = inviteSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { firstName, lastName, email } = validation.data;
  const fullName = `${firstName} ${lastName}`;

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'A user with this email already exists' },
      { status: 409 }
    );
  }

  // Create user with temp password
  const temporaryPassword = Math.random().toString(36).slice(-12);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    name: fullName,
    password: hashedPassword,
    role: 'client_admin',
    orgId: id,
    emailVerified: new Date(),
    isActive: true,
  }).returning();

  // Create org membership
  await db.insert(organizationMembers).values({
    userId: newUser.id,
    organizationId: id,
    role: 'client_admin',
    invitedBy: user.id,
    isActive: true,
  });

  // Send invite email
  const loginUrl = `${process.env.NEXTAUTH_URL || 'https://tpaenginex.vercel.app'}/auth/signin`;
  await sendUserInviteEmail({
    to: email.toLowerCase(),
    name: fullName,
    role: 'client_admin',
    organizationName: clientOrg.name,
    temporaryPassword,
    loginUrl,
  }).catch(err => console.error('Failed to send invite email:', err));

  return NextResponse.json(
    {
      message: `${fullName} has been invited to ${clientOrg.name}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
    { status: 201 }
  );
}
