import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { users, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { DefaultSession } from "next-auth";
import { authConfig } from "./auth.config";

// Extend NextAuth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      tpaOrgId: string | null;
      role: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    orgId?: string | null;
    tpaOrgId?: string | null;
    role?: string | null;
  }
}

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

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
        };
      },
    }),
  ],
});
