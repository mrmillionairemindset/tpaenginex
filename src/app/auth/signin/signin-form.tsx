"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { TenantBranding } from "@/lib/subdomain";

interface SignInFormProps {
  branding: TenantBranding | null;
}

type Step = "credentials" | "totp" | "sso";

export default function SignInForm({ branding }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");

  const handleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sso/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ssoEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.found || !data?.tenant) {
        setError("No SSO connection found for that email domain.");
        setLoading(false);
        return;
      }
      window.location.href = `/api/sso/authorize?tenant=${encodeURIComponent(data.tenant)}`;
    } catch {
      setError("Unexpected error looking up SSO.");
      setLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Pre-check: validate credentials and find out if 2FA is required
      const preCheckRes = await fetch("/api/auth/pre-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (preCheckRes.status === 429) {
        const data = await preCheckRes.json();
        setError(data.error || "Too many attempts. Please try again later.");
        return;
      }

      if (!preCheckRes.ok) {
        setError("Invalid email or password");
        return;
      }

      const { requires2fa } = await preCheckRes.json();

      if (requires2fa) {
        // Show 2FA step — don't actually sign in yet
        setStep("totp");
        return;
      }

      // No 2FA → proceed with signIn
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const codeValue = useBackupCode ? backupCode.trim() : totpToken.trim();
    if (!codeValue) {
      setError(useBackupCode ? "Enter a backup code" : "Enter your 6-digit code");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        totpToken: useBackupCode ? "" : codeValue,
        backupCode: useBackupCode ? codeValue : "",
        redirect: false,
      });

      if (result?.error) {
        setError(useBackupCode ? "Invalid backup code" : "Invalid 2FA code");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep("credentials");
    setTotpToken("");
    setBackupCode("");
    setUseBackupCode(false);
    setError("");
  };

  const displayName = branding?.brandName || branding?.orgName;
  const logoSrc = branding?.logoUrl || "/tpa-engine-x-logo.png";
  const logoAlt = displayName || "TPAEngineX";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <img src={logoSrc} alt={logoAlt} className="h-16 w-auto mb-6" />
          {branding && displayName && (
            <h1 className="text-center text-2xl font-semibold text-foreground mb-2">
              {displayName}
            </h1>
          )}
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            {step === "credentials"
              ? "Sign in to your account"
              : step === "sso"
              ? "Sign in with SSO"
              : "Two-factor authentication"}
          </h2>
          {step === "credentials" && branding?.loginMessage ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {branding.loginMessage}
            </p>
          ) : step === "credentials" ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Or{" "}
              <Link
                href="/auth/signup"
                className="font-medium text-primary hover:text-primary/80"
              >
                create a new account
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {useBackupCode
                ? "Enter one of your backup codes"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {step === "credentials" && (
          <form className="mt-8 space-y-6" onSubmit={handleCredentialsSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-foreground mb-1">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <Link href="/auth/forgot-password" className="font-medium text-primary hover:text-primary/80">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setStep("sso"); setError(""); }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Sign in with SSO (SAML)
            </button>
          </form>
        )}

        {step === "sso" && (
          <form className="mt-8 space-y-6" onSubmit={handleSsoSubmit}>
            <div>
              <label htmlFor="sso-email" className="block text-sm font-medium text-foreground mb-1">
                Work email
              </label>
              <input
                id="sso-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="you@company.com"
                value={ssoEmail}
                onChange={(e) => setSsoEmail(e.target.value)}
                disabled={loading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll route you to your organization&apos;s identity provider.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Redirecting..." : "Continue"}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(""); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to password sign in
              </button>
            </div>
          </form>
        )}

        {step === "totp" && (
          <form className="mt-8 space-y-6" onSubmit={handleTotpSubmit}>
            {!useBackupCode ? (
              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-foreground mb-1">
                  Verification code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  className="block w-full rounded-md border border-input bg-background px-3 py-3 text-center text-2xl font-mono tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="backup-code" className="block text-sm font-medium text-foreground mb-1">
                  Backup code
                </label>
                <input
                  id="backup-code"
                  type="text"
                  required
                  autoFocus
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                  placeholder="XXXXX-XXXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Each backup code can only be used once.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Verifying..." : "Verify & sign in"}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => { setUseBackupCode(!useBackupCode); setError(""); }}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                {useBackupCode ? "Use authenticator code instead" : "Use a backup code"}
              </button>
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
