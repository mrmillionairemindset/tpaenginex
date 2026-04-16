import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { extractSubdomain } from "@/lib/subdomain";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const hostname = req.headers.get("host") || "";
  const subdomain = extractSubdomain(hostname);

  if (subdomain) {
    // Tenant subdomain detected — pass it down via request header
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-subdomain", subdomain);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
