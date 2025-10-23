import type { NextAuthConfig } from "next-auth";

// Auth config that works in Edge Runtime (for middleware)
// IMPORTANT: No imports of bcrypt, database, or Node.js-only modules
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
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
        "/privacy",
        "/terms",
        "/hipaa",
        "/baa",
      ];

      // API routes that don't require authentication
      const publicApiRoutes = ["/api/auth", "/api/webhooks"];

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
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      // Add custom fields to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.orgId = token.orgId as string | null;
        session.user.role = token.role as string | null;
      }
      return session;
    },
  },

  providers: [], // Providers will be added in the full config
};
