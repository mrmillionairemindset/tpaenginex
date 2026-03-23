import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { collectors, users, organizationMembers } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendUserInviteEmail } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

export const dynamic = 'force-dynamic';

// POST /api/collectors/[id]/invite — invite collector to portal
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = params;

  // Fetch collector and verify it belongs to this TPA
  const collector = await db.query.collectors.findFirst({
    where: and(eq(collectors.id, id), eq(collectors.tpaOrgId, tpaOrgId)),
  });

  if (!collector) {
    return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
  }

  if (collector.userId) {
    return NextResponse.json(
      { error: 'Collector has already been invited to the portal' },
      { status: 409 }
    );
  }

  // Check if a user with this email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, collector.email),
  });

  if (existingUser) {
    return NextResponse.json(
      { error: 'A user with this email address already exists' },
      { status: 409 }
    );
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  // Create user
  const [newUser] = await db.insert(users).values({
    name: `${collector.firstName} ${collector.lastName}`,
    email: collector.email,
    password: hashedPassword,
    role: 'collector',
    orgId: tpaOrgId,
    isActive: true,
  }).returning();

  // Create organization membership
  await db.insert(organizationMembers).values({
    userId: newUser.id,
    organizationId: tpaOrgId,
    role: 'collector',
    invitedBy: user.id,
  });

  // Link collector to user
  await db.update(collectors)
    .set({ userId: newUser.id, updatedAt: new Date() })
    .where(eq(collectors.id, id));

  // Send invite email
  try {
    const branding = await getTpaBranding(tpaOrgId);
    const loginUrl = `${process.env.NEXTAUTH_URL || 'https://app.tpaenginex.com'}/auth/signin`;

    await sendUserInviteEmail({
      to: collector.email,
      name: `${collector.firstName} ${collector.lastName}`,
      role: 'collector',
      organizationName: user.organization?.name || 'Your TPA',
      temporaryPassword: tempPassword,
      loginUrl,
      branding,
    });
  } catch (emailError) {
    // User was created but email failed — log but don't fail the request
    console.error('Failed to send collector invite email:', emailError);
  }

  return NextResponse.json({
    message: 'Collector invited successfully',
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
}
