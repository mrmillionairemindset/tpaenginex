# RapidScreen Platform

A HIPAA-compliant healthcare screening coordination platform connecting employers with testing facilities.

## ✅ Current Status

**Module 1: COMPLETE** - Project setup finished
- ✅ Dependencies installed (925 packages)
- ✅ TypeScript configured
- ✅ Tailwind CSS configured
- ✅ Folder structure created
- ✅ Environment template ready

**Module 2: COMPLETE** - Database ready
- ✅ Drizzle ORM configured
- ✅ Schema created (8 tables, 5 enums)
- ✅ Database client configured
- ✅ Connected to Neon Postgres
- ✅ Schema pushed successfully
- ✅ Seed data loaded (1 org, 3 sites)

**Module 3: COMPLETE** - Authentication ready (Clerk setup needed)
- ✅ Middleware with clerkMiddleware
- ✅ ClerkProvider in root layout
- ✅ RBAC utilities (4 roles)
- ✅ User context helper with DB sync
- ✅ API middleware (withAuth, withPermission)
- ✅ Sign-in/sign-up pages
- ✅ Home page with auth UI
- ⚠️ **Action Required**: Add Clerk API keys to `.env.local`

**Next:** Module 4 - UI/UX Design System & Components

## 🚀 Quick Start

### 1. Read the Build Plan

```bash
cat claude.md
```

This file contains the complete architecture overview and module build order.

### 2. Review Module Documentation

All modules are in `/modules/` directory (gitignored for development use only):

```
Phase 1: Foundation
  ├── Module 1: Project Setup & Configuration
  ├── Module 2: Database Schema & Drizzle ORM
  └── Module 3: Authentication & Multi-tenant RBAC (Clerk)

Phase 2: UI/UX & Compliance
  ├── Module 4: UI/UX Design System & Components
  ├── Module 5: Layout (Header, Footer, Navigation)
  └── Module 6: Compliance Pages (Privacy, Terms, HIPAA, BAA)

Phase 3: Core Backend
  ├── Module 7: Core API Routes (Orders, Candidates, Sites)
  ├── Module 8: File Storage & Document Management
  ├── Module 9: Queue System & Background Jobs
  └── Module 10: Email/SMS Notifications

Phase 4: Integrations
  ├── Module 11: Google Sheets Integration
  ├── Module 12: Site Matching & Geolocation
  └── Module 13: Concentra Authorization Module

Phase 5: User Interface
  └── Module 14: Dashboard & User Pages
```

### 3. Build in Order

**IMPORTANT**: Build modules sequentially. Each depends on previous modules.

```bash
# Start with Module 1
cat modules/module-01-project-setup.md

# Follow instructions in each module
# ✓ Complete Module 1
# ✓ Complete Module 2
# ... continue through Module 14
```

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Redis (Upstash recommended)
- Clerk account (authentication)
- AWS S3 or Cloudflare R2 (file storage)
- Resend account (email)
- Twilio account (SMS)
- Google Cloud account (Maps API + Sheets)

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (multi-tenant)
- **Queue**: BullMQ + Redis
- **Storage**: S3/R2
- **Email**: Resend
- **SMS**: Twilio
- **Maps**: Google Maps API
- **UI**: Tailwind CSS + shadcn/ui

## 🔐 Security & Compliance

- **HIPAA-ready**: Encryption at rest/transit, audit logs, BAA templates
- **Multi-tenant**: Organization-based isolation with Clerk
- **RBAC**: Role-based access control (4 roles)
- **Audit trail**: All mutations logged with before/after states
- **PII protection**: Signed URLs, redacted logs

## 🎯 User Roles

1. **Employer Admin**: Create orders, manage team
2. **Employer User**: View orders (read-only)
3. **Provider Admin**: Assign sites, manage all orders
4. **Provider Agent**: Assign sites, upload results

## 📚 Documentation Structure

### `claude.md`
Master build plan with architecture decisions, deployment strategy, and module checklist.

### `/modules/module-XX-name.md`
Each module contains:
- Objective
- Dependencies
- Estimated time
- Complete code files
- Terminal commands
- Acceptance criteria
- Next steps

## 🚢 Deployment

**Recommended Stack**:
- **App**: Vercel (Next.js + API routes)
- **Database**: Neon Postgres
- **Redis**: Upstash
- **Workers**: Vercel (cron) or Railway (BullMQ)
- **Storage**: Cloudflare R2
- **Monitoring**: Sentry

See `claude.md` for detailed deployment instructions.

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run db:studio        # Open Drizzle Studio
npm run worker:notifications  # Start notification worker
npm run worker:geocode   # Start geocoding worker

# Database
npm run db:generate      # Generate migrations
npm run db:push          # Push schema to DB (dev)
npm run db:migrate       # Run migrations (prod)
npm run db:seed          # Seed test data

# Build
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run type-check      # TypeScript check
```

## 📖 Module Completion Checklist

Track your progress in `claude.md`:

- [ ] Module 1: Project Setup
- [ ] Module 2: Database Schema
- [ ] Module 3: Authentication & RBAC
- [ ] Module 4: UI/UX Design System
- [ ] Module 5: Layout Components
- [ ] Module 6: Compliance Pages
- [ ] Module 7: Core API Routes
- [ ] Module 8: File Storage
- [ ] Module 9: Queue System
- [ ] Module 10: Email/SMS
- [ ] Module 11: Google Sheets
- [ ] Module 12: Site Matching
- [ ] Module 13: Concentra Authorization
- [ ] Module 14: Dashboard Pages

## ⚠️ Important Notes

1. **Module order matters**: Don't skip ahead. Each module builds on previous ones.
2. **Legal review required**: Have compliance pages (Module 6) reviewed by legal counsel before production.
3. **Environment variables**: Copy `.env.example` to `.env` and fill in all values before starting.
4. **Clerk setup**: Configure organizations and roles in Clerk Dashboard before Module 3.
5. **Google Sheets**: Set up service account before Module 11.
6. **Concentra integration**: Currently uses PDF generation (safe, compliant). Swap for API when available.

## 🤝 Support

For questions about implementation:
1. Review the specific module documentation in `/modules/`
2. Check `claude.md` for architecture decisions
3. Ensure all prerequisites are met
4. Verify environment variables are set

## 📄 License

Proprietary - All rights reserved

---

**Built with**: Next.js, Drizzle ORM, Clerk, BullMQ, Tailwind CSS, shadcn/ui
**Compliance**: HIPAA-ready with encryption, audit logs, and BAA templates
**Status**: Development - Follow module build order for implementation
