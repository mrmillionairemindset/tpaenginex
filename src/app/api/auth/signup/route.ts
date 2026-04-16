import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, emailVerificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  generateSecureToken,
  tokenExpiryDates,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from "@/lib/auth-security";
import { sendEmailVerification } from "@/lib/email";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const userAgent = getClientUserAgent(request.headers);

  try {
    const { name, email, password } = await request.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user — email not yet verified
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: normalizedEmail,
        password: hashedPassword,
      })
      .returning();

    // Generate email verification token
    try {
      const { token, hash } = await generateSecureToken();
      const { emailVerificationExpiresAt } = tokenExpiryDates();

      await db.insert(emailVerificationTokens).values({
        userId: newUser.id,
        tokenHash: hash,
        email: newUser.email,
        expiresAt: emailVerificationExpiresAt,
      });

      const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tpaenginex.com';
      const verifyUrl = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(newUser.email)}`;

      await sendEmailVerification({
        to: newUser.email,
        name: newUser.name,
        verifyUrl,
      });

      await logLoginEvent({
        userId: newUser.id,
        email: newUser.email,
        event: 'email_verification_sent',
        ipAddress,
        userAgent,
      });
    } catch (err) {
      console.error('Failed to send verification email on signup:', err);
      // Don't fail signup — user can resend verification later
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
