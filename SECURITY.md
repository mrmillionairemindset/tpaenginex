# Security Status

## Known Vulnerabilities

Tracked via `npm audit`. Status as of 2026-04-14.

### Production Dependencies

| Package | Severity | Advisory | Status | Notes |
|---------|----------|----------|--------|-------|
| `next` 14.x | High x2 / Moderate x2 | GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8, GHSA-q4gf-8mx6-v5v3 | **Deferred** | Fix requires Next 14 → 16 major upgrade. Large surface area; needs dedicated testing sprint. Mitigations in place: rate limiting on public endpoints, input validation on all routes, no self-hosted image optimizer (using Vercel's). |
| `drizzle-orm` <0.45.2 | High | GHSA-gpj5-g38j-94v9 (SQL injection via improperly escaped identifiers) | **FIXED** 2026-04-14 | Upgraded to ^0.45.2. All SQL built via parameterized Drizzle query builder. |

### Development Dependencies (not deployed)

| Package | Severity | Advisory | Status | Notes |
|---------|----------|----------|--------|-------|
| `esbuild` / `drizzle-kit` | Moderate | GHSA-67mh-4wv8-2f99 | **Deferred** | Dev server only. Not reachable from production runtime. Fix requires drizzle-kit major upgrade. |
| `@next/eslint-plugin-next` / `glob` | High | GHSA-5j98-mcp5-4vw2 | **Deferred** | Build-time linting only. No production code path. |

### Security Measures in Production

1. **TOTP secrets encrypted at rest** with AES-256-GCM + scrypt KDF (`src/lib/crypto.ts`)
2. **Webhook signing secrets encrypted at rest**
3. **API keys** stored as SHA-256 hashes (format-verifiable, not guessable)
4. **Password hashes** use bcrypt rounds=12
5. **Backup codes** bcrypt-hashed, single-use enforcement
6. **Account lockout** after 5 failed login attempts (15 min)
7. **Rate limiting** on public endpoints (form submission, pre-auth check)
8. **HIPAA session policy**: 8-hour absolute max, 15-min idle timeout
9. **CSP / secure headers** via Next.js defaults
10. **PII redaction** in Sentry events and Pino logs (password, token, ssn, dob)
11. **Audit logging** on all mutation endpoints with IP + User-Agent
12. **IP allowlists** configurable per API key
13. **Impersonation sessions** time-limited, reason-required, audit-logged
14. **GDPR**: data export + 30-day grace account deletion

## Response Plan

- **New critical vulnerabilities**: patch within 48 hours; out-of-cycle release if needed
- **High severity**: patch within 14 days
- **Moderate severity**: patch within the next minor release
- **Low / dev-only**: patch opportunistically

Report vulnerabilities to: security@tpaengx.example.com (replace with real address)
