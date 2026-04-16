import { Suspense } from "react";
import { headers } from "next/headers";
import { resolveTenantBySubdomain, type TenantBranding } from "@/lib/subdomain";
import SignInForm from "./signin-form";

export default async function SignInPage() {
  const headersList = headers();
  const subdomain = headersList.get("x-tenant-subdomain");

  let branding: TenantBranding | null = null;
  if (subdomain) {
    try {
      branding = await resolveTenantBySubdomain(subdomain);
    } catch (err) {
      // If branding lookup fails, fall back to default — don't break the page
      console.error("Failed to resolve tenant branding:", err);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SignInForm branding={branding} />
    </Suspense>
  );
}
