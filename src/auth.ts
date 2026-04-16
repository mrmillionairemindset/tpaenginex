import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { users, organizations, userBackupCodes, ssoConnections } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { DefaultSession } from "next-auth";
import { authConfig } from "./auth.config";
import { verifyTotpToken, verifyBackupCode } from "@/lib/totp";
import {
  checkLockoutStatus,
  recordFailedLogin,
  resetFailedLoginCount,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from "@/lib/auth-security";
import { createSession } from "@/lib/session-manager";
import { consumeSsoLoginToken } from "@/lib/sso-login-token";

/**
 * Thrown by the Credentials authorize() function when the user has 2FA enabled
 * and the submitted request lacks a valid TOTP token. The signin page catches
 * this and prompts the user for their TOTP code.
 */
export class TotpRequiredError extends Error {
  constructor() {
    super("TOTP_REQUIRED");
    this.name = "TotpRequiredError";
  }
}

// Extend NextAuth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      tpaOrgId: string | null;
      role: string | null;
    } & DefaultSession["user"];
    sessionId?: string;
  }

  interface User {
    orgId?: string | null;
    tpaOrgId?: string | null;
    role?: string | null;
    sessionToken?: string;
  }
}

// JWT type augmentation happens inline via session callback (see auth.config.ts)

// Full auth config (for API routes and server components)
// NOTE: Database adapter is intentionally omitted when using Credentials provider
// with JWT strategy. NextAuth v5 throws a Configuration error if the adapter
// tries to create a DB session for credential-based logins.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpToken: { label: "2FA Code", type: "text" },
        backupCode: { label: "Backup Code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Extract client info for audit logging
        const headers = (request as Request | undefined)?.headers;
        const ipAddress = headers ? getClientIp(headers) : null;
        const userAgent = headers ? getClientUserAgent(headers) : null;
        const emailStr = credentials.email as string;

        const user = await db.query.users.findFirst({
          where: eq(users.email, emailStr),
        });

        if (!user || !user.password) {
          await logLoginEvent({
            email: emailStr,
            event: "login_failed_unknown_user",
            ipAddress,
            userAgent,
          });
          return null;
        }

        // Check lockout BEFORE password compare — don't waste compute on locked accounts.
        // Return null (generic error) to avoid account enumeration at this step.
        const lockoutStatus = await checkLockoutStatus(user.id);
        if (lockoutStatus.locked) {
          await logLoginEvent({
            userId: user.id,
            email: user.email,
            event: "login_failed_locked",
            ipAddress,
            userAgent,
            metadata: { unlockAt: lockoutStatus.unlockAt?.toISOString() },
          });
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          const newStatus = await recordFailedLogin(user.id);
          await logLoginEvent({
            userId: user.id,
            email: user.email,
            event: "login_failed_password",
            ipAddress,
            userAgent,
            metadata: { remainingAttempts: newStatus.remainingAttempts },
          });
          if (newStatus.locked) {
            await logLoginEvent({
              userId: user.id,
              email: user.email,
              event: "account_locked",
              ipAddress,
              userAgent,
              metadata: { unlockAt: newStatus.unlockAt?.toISOString() },
            });
          }
          return null;
        }

        // ============================================================
        // Two-Factor Authentication check
        // ============================================================
        if (user.totpEnabled && user.totpSecret) {
          const submittedTotp = (credentials.totpToken as string | undefined)?.trim();
          const submittedBackup = (credentials.backupCode as string | undefined)?.trim();

          if (!submittedTotp && !submittedBackup) {
            // Signal to the client that 2FA is required
            throw new TotpRequiredError();
          }

          let verified = false;

          if (submittedTotp) {
            verified = verifyTotpToken(user.totpSecret, submittedTotp);
          }

          if (!verified && submittedBackup) {
            // Load unused backup codes for this user
            const codes = await db.query.userBackupCodes.findMany({
              where: and(
                eq(userBackupCodes.userId, user.id),
                isNull(userBackupCodes.usedAt)
              ),
            });
            const hashes = codes.map((c) => c.codeHash);
            const matchIndex = await verifyBackupCode(submittedBackup, hashes);
            if (matchIndex >= 0) {
              // Mark the code as used — single-use enforcement
              await db
                .update(userBackupCodes)
                .set({ usedAt: new Date() })
                .where(eq(userBackupCodes.id, codes[matchIndex].id));
              verified = true;
            }
          }

          if (!verified) {
            // Wrong 2FA code — reject the login and count as a failed attempt
            const newStatus = await recordFailedLogin(user.id);
            await logLoginEvent({
              userId: user.id,
              email: user.email,
              event: "2fa_failed",
              ipAddress,
              userAgent,
              metadata: { remainingAttempts: newStatus.remainingAttempts },
            });
            if (newStatus.locked) {
              await logLoginEvent({
                userId: user.id,
                email: user.email,
                event: "account_locked",
                ipAddress,
                userAgent,
                metadata: { unlockAt: newStatus.unlockAt?.toISOString() },
              });
            }
            return null;
          }

          await logLoginEvent({
            userId: user.id,
            email: user.email,
            event: submittedBackup ? "backup_code_used" : "2fa_success",
            ipAddress,
            userAgent,
          });
        }

        // Successful login — reset counter and log
        await resetFailedLoginCount(user.id);
        await logLoginEvent({
          userId: user.id,
          email: user.email,
          event: "login_success",
          ipAddress,
          userAgent,
        });

        // Create a session record for device tracking / remote revocation
        const sessionToken = await createSession({
          userId: user.id,
          ipAddress,
          userAgent,
        });

        // Resolve tpaOrgId based on org type
        let tpaOrgId: string | null = null;
        if (user.orgId) {
          const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, user.orgId),
          });
          if (org) {
            tpaOrgId = org.type === "tpa" ? org.id : org.tpaOrgId;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          orgId: user.orgId,
          tpaOrgId,
          role: user.role,
          sessionToken,
        };
      },
    }),
    // ===================================================================
    // SSO (SAML/OIDC) provider — exchanges a one-time token issued by the
    // ACS endpoint (after Jackson validates the IdP assertion) for a
    // NextAuth session. JIT provisioning is handled here.
    // ===================================================================
    Credentials({
      id: "sso",
      name: "sso",
      credentials: {
        token: { label: "SSO Token", type: "text" },
      },
      async authorize(credentials, request) {
        const headers = (request as Request | undefined)?.headers;
        const ipAddress = headers ? getClientIp(headers) : null;
        const userAgent = headers ? getClientUserAgent(headers) : null;
        const rawToken = (credentials?.token as string | undefined)?.trim();

        if (!rawToken) return null;

        const consumed = await consumeSsoLoginToken(rawToken);
        if (!consumed) {
          await logLoginEvent({
            email: "unknown",
            event: "sso_login_failed",
            ipAddress,
            userAgent,
            metadata: { reason: "token_invalid_or_expired" },
          });
          return null;
        }

        const connection = await db.query.ssoConnections.findFirst({
          where: eq(ssoConnections.id, consumed.connectionId),
        });
        if (!connection || !connection.isActive) {
          await logLoginEvent({
            email: consumed.email,
            event: "sso_login_failed",
            ipAddress,
            userAgent,
            metadata: { reason: "connection_inactive" },
          });
          return null;
        }

        // Validate email domain allowlist (if configured)
        const allowedDomains = (connection.allowedEmailDomains ?? []) as string[];
        if (allowedDomains.length > 0) {
          const domain = consumed.email.split("@")[1]?.toLowerCase();
          if (!domain || !allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
            await logLoginEvent({
              email: consumed.email,
              event: "sso_login_failed",
              ipAddress,
              userAgent,
              metadata: { reason: "domain_not_allowed" },
            });
            return null;
          }
        }

        // Find or provision the user
        let user = await db.query.users.findFirst({
          where: eq(users.email, consumed.email),
        });

        if (!user) {
          if (!connection.jitProvisioningEnabled) {
            await logLoginEvent({
              email: consumed.email,
              event: "sso_login_failed",
              ipAddress,
              userAgent,
              metadata: { reason: "jit_disabled" },
            });
            return null;
          }

          const tpaOrg = await db.query.organizations.findFirst({
            where: eq(organizations.id, connection.tpaOrgId),
          });
          if (!tpaOrg) return null;

          const fullName = [consumed.firstName, consumed.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || consumed.email;

          const role = (connection.defaultRoleForJit ?? "tpa_staff") as any;

          const [inserted] = await db
            .insert(users)
            .values({
              email: consumed.email,
              name: fullName,
              orgId: connection.tpaOrgId,
              role,
              emailVerified: new Date(), // SSO-authenticated emails are trusted
              isActive: true,
            })
            .returning();
          user = inserted;
        } else {
          // User exists — make sure they're linked to this TPA
          if (user.orgId && user.orgId !== connection.tpaOrgId) {
            // Different tenant — refuse cross-tenant login via this connection
            await logLoginEvent({
              userId: user.id,
              email: user.email,
              event: "sso_login_failed",
              ipAddress,
              userAgent,
              metadata: { reason: "wrong_tenant" },
            });
            return null;
          }
          if (!user.isActive) {
            await logLoginEvent({
              userId: user.id,
              email: user.email,
              event: "login_failed_inactive",
              ipAddress,
              userAgent,
            });
            return null;
          }
        }

        if (!user) return null;

        // Reset lockout on successful SSO and log.
        await resetFailedLoginCount(user.id);
        await logLoginEvent({
          userId: user.id,
          email: user.email,
          event: "sso_login_success",
          ipAddress,
          userAgent,
          metadata: { connectionId: connection.id },
        });

        const sessionToken = await createSession({
          userId: user.id,
          ipAddress,
          userAgent,
        });

        // Resolve tpaOrgId
        let tpaOrgId: string | null = null;
        if (user.orgId) {
          const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, user.orgId),
          });
          if (org) {
            tpaOrgId = org.type === "tpa" ? org.id : org.tpaOrgId;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          orgId: user.orgId,
          tpaOrgId,
          role: user.role,
          sessionToken,
        };
      },
    }),
  ],
});
