import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// PATCH /api/user/password — change own password
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = changePasswordSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0].message },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = validation.data;

  // Fetch user with password
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!dbUser?.password) {
    return NextResponse.json({ error: 'Account does not have a password set' }, { status: 400 });
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, dbUser.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
  }

  // Hash and update
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({
    password: hashedPassword,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  return NextResponse.json({ message: 'Password updated successfully' });
}
