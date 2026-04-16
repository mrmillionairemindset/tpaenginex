import type { NextAuthConfig } from "next-auth";

// Auth config that works in Edge Runtime (for middleware)
// IMPORTANT: No imports of bcrypt, database, or Node.js-only modules
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    // HIPAA session policy
    maxAge: 8 * 60 * 60,      // 8 hours absolute max session lifetime
    updateAge: 15 * 60,       // idle timeout — token must be refreshed within 15 min
  },
  jwt: {
    maxAge: 8 * 60 * 60,      // 8 hours absolute max — matches session.maxAge
  },

  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },

  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      // Public routes that don't require authentication
      const publicRoutes = [
        "/",
        "/auth/signin",
        "/auth/signup",
        "/auth/error",
        "/auth/sso-callback",
        "/privacy",
        "/terms",
        "/hipaa",
        "/baa",
        "/developers",
      ];

      // API routes that don't require authentication.
      // /api/sso/authorize, /api/sso/saml/acs, /api/sso/lookup must be reachable
      // before the user has a session. The admin routes under /api/sso/connections
      // still run withAuth() and enforce their own role checks.
      const publicApiRoutes = [
        "/api/auth",
        "/api/webhooks",
        "/api/sso/authorize",
        "/api/sso/saml",
        "/api/sso/lookup",
      ];

      const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route)
      );

      const isPublicApiRoute = publicApiRoutes.some((route) =>
        pathname.startsWith(route)
      );

      // Allow public routes and public API routes
      if (isPublicRoute || isPublicApiRoute) {
        return true;
      }

      // Require authentication for all other routes
      return !!auth;
    },

    async jwt({ token, user }) {
      // Add custom fields to JWT on sign in
      if (user) {
        token.id = user.id;
        token.orgId = user.orgId;
        token.tpaOrgId = user.tpaOrgId;
        token.role = user.role;
        // Session token for device tracking / remote revocation
        if ((user as any).sessionToken) {
          token.sessionId = (user as any).sessionToken;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Add custom fields to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.orgId = token.orgId as string | null;
        session.user.tpaOrgId = token.tpaOrgId as string | null;
        session.user.role = token.role as string | null;
      }
      if (token?.sessionId) {
        (session as any).sessionId = token.sessionId;
      }
      return session;
    },
  },

  providers: [], // Providers will be added in the full config
};
