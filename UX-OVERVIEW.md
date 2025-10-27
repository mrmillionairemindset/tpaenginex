# WorkSafe Now Portal - UX Overview

## Application Purpose

WorkSafe Now Portal is a B2B SaaS platform that coordinates healthcare screening services (drug tests, physicals, respiratory fit tests) between **Employers** and **Healthcare Providers**.

**Business Model:**
Employers order tests for their candidates/employees → Providers coordinate appointments and manage test results → Results flow back to employers for review.

---

## User Roles & Personas

### **Employer Users**
1. **Employer Admin**
   - Full access to their organization's data
   - Can create orders, manage candidates, review results
   - Can invite other users to their organization
   - Manages organization settings

2. **Employer User**
   - Read-only access to their organization's data
   - Can view orders and results
   - Cannot create orders or modify settings

### **Provider Users**
3. **Provider Admin**
   - Oversees ALL orders across ALL employers (cross-tenant visibility)
   - Manages authorization workflows
   - Uploads and distributes authorization forms
   - Manages testing sites
   - Configures email recipients per employer organization
   - Full admin capabilities

4. **Provider Agent**
   - Assigns appointments to testing sites
   - Updates order statuses
   - Uploads test results
   - Limited to operational tasks

---

## Core Workflows

### **1. Order Creation Flow (Employer)**

**Path:** Dashboard → Orders → New Order

**Steps:**
1. Select existing candidate OR create new candidate inline
2. Fill order details:
   - Test type (drug screen, physical, fit test, etc.)
   - Urgency (standard/rush/urgent)
   - Jobsite location
   - Mask requirement (if respiratory fit test)
   - Notes
3. Submit order
4. **Automatic:** Order syncs to Google Sheets
5. **Automatic:** Providers receive in-app notifications

**UX Considerations:**
- Inline candidate creation reduces friction
- Clear form validation with helpful error messages
- Urgency indicators use color coding (amber for rush, red for urgent)
- One-click submission after form completion

---

### **2. Authorization Workflow (Provider)**

This is the most complex workflow. Providers handle authorization in two ways based on logistics:

#### **A. Concentra Flow (Most Common - 90% of orders)**

**When:** Candidate can use Concentra network (distance acceptable)

**Steps:**
1. Provider creates authorization in external Concentra Hub system
2. Provider gets PDF from Concentra
3. **Provider uploads PDF to WorkSafe Now**
4. **Automatic:**
   - PDF is validated (checks for Concentra branding, candidate name match)
   - PDF is emailed to candidate + configured employer recipients
   - Expiration timer starts automatically (based on org's authExpiryDays setting)
   - Order status updates

**UX Considerations:**
- Upload button is prominent on order details page
- PDF validation provides immediate feedback if wrong file
- Shows "Last uploaded" timestamp
- Timer displays days remaining with color-coded status (green active, red expired)
- Zero manual steps after upload

#### **B. Custom Authorization Flow (When Concentra Distance Too Far)**

**When:** Concentra location too far OR candidate complains about distance

**Steps:**
1. Provider clicks "Switch to Custom" toggle (amber warning box)
2. Provider clicks "Send Form" button
3. **Automatic:**
   - System generates pre-filled PDF from template
   - PDF is emailed to candidate + configured employer recipients
   - Expiration timer starts automatically
   - Order status updates

**UX Considerations:**
- Clear warning box explains WHY switching (distance/complaints)
- One-click toggle between Concentra/Custom
- Single "Send Form" button does everything
- No downloads, no manual steps
- Email recipients are pre-configured in Settings per employer

**Authorization Validation (Security):**
- Extracts text from uploaded PDFs
- Validates Concentra branding present
- Verifies candidate name appears in document
- Checks for authorization terminology
- Warns about missing elements but allows upload
- Blocks obviously wrong/corrupted files

---

### **3. Email Recipient Management (Provider)**

**Path:** Settings → Select Organization → Manage Recipients

**Purpose:** Configure who receives authorization form emails per employer

**Steps:**
1. Provider selects employer organization from list
2. Adds email addresses (validated in real-time)
3. Removes recipients as needed
4. Changes save automatically

**Email Distribution Logic:**
- Candidate email (always included)
- Organization's configured recipients (from Settings)
- Fallback to order requester if no recipients configured

**UX Considerations:**
- Two-column layout: org list + email management
- Shows recipient count per organization
- Add email with Enter key or button
- Real-time validation (format, duplicates)
- Info box explains how distribution works

---

### **4. Results Upload & Review (Provider → Employer)**

**Provider Uploads Results:**
1. Navigate to order details
2. Upload PDF test results
3. Order status changes to "Pending Review"
4. **Automatic:** Employer receives notification

**Employer Reviews Results:**
1. Receives in-app notification
2. Opens order to view results
3. Reviews PDF document
4. Either:
   - **Approve:** Order marked complete
   - **Reject:** Provide feedback, provider makes corrections

**UX Considerations:**
- Prominent review section when results ready
- PDF viewer or download link
- Approve/Reject buttons clearly distinguished (green/red)
- Required feedback field for rejections
- Status badge always visible showing current state

---

## Navigation Structure

### **Employer Navigation (Left Sidebar)**
- Dashboard
- Orders
  - New Order (submenu)
- Candidates

### **Provider Navigation (Left Sidebar)**
- Dashboard
- Orders
- Sites
- Organizations
- Results
- Settings

### **Header (Top Navigation)**
- Logo (links to dashboard)
- Organization Switcher (if user belongs to multiple orgs)
- **Theme Toggle (Light/Dark Mode)** ← NEW
- Notifications Bell (shows unread count)
- User Avatar Menu
  - Profile
  - Organization Settings (admins only)
  - Help Center
  - Privacy Policy, Terms, HIPAA, BAA
  - Sign Out

---

## Status System

### **Order Statuses**
Orders progress through these states:

1. **new** - Just created by employer
2. **needs_site** - Provider needs to assign testing location (deprecated in current flow)
3. **scheduled** - Appointment scheduled
4. **in_progress** - Candidate is being tested
5. **results_uploaded** - Provider uploaded results
6. **pending_review** - Employer needs to review results
7. **needs_correction** - Employer rejected results, needs fixes
8. **complete** - Final approved state
9. **cancelled** - Order cancelled

**Status Badges:**
- Color-coded for quick scanning
- Gray (new), Blue (in progress), Green (complete), Red (cancelled), Amber (needs attention)

---

## Key UX Patterns

### **1. Toast Notifications**
Used throughout for user feedback:
- Success: Green with checkmark
- Error: Red with X
- Warning: Amber with alert icon
- Detailed validation errors shown in toast with bullet lists

### **2. Modal Dialogs**
- Profile editing
- Organization settings
- Confirmation prompts (cancel order, etc.)

### **3. Dropdown Menus**
- User menu
- Notifications panel (scrollable, shows unread count)
- Organization switcher

### **4. Data Tables**
- Orders list
- Candidates list
- Sortable columns
- Filter by status
- Search functionality

### **5. Forms**
- Inline validation with clear error messages
- Required fields marked with red asterisk
- Helper text for complex fields (tooltips)
- Select dropdowns for predefined options
- Textarea for notes/feedback

### **6. Cards**
- Order details sections
- Dashboard stats
- Clear visual hierarchy with borders/shadows

### **7. Badges & Labels**
- Status badges (colored, rounded)
- Urgency indicators
- Role labels
- "Auto-started" indicators for timers

---

## Color System

### **Primary Colors**
- **Primary:** Blue (#2563EB) - Actions, links, active states
- **Success:** Green (#16A34A) - Complete status, approve actions
- **Warning:** Amber (#F59E0B) - Rush urgency, override warnings
- **Danger:** Red (#DC2626) - Cancel, reject, expired states
- **Gray:** Neutral backgrounds, borders, disabled states

### **Status Colors**
- New: Gray
- In Progress: Blue
- Complete: Green
- Cancelled: Red
- Needs Attention: Amber

### **Dark Mode Support**
- Implemented with next-themes
- System preference detection
- Manual toggle in header
- All colors have dark mode variants
- Proper contrast ratios maintained

---

## Responsive Design

### **Breakpoints**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### **Mobile Adaptations**
- Hamburger menu for sidebar navigation
- Collapsible sections
- Stacked layouts replace columns
- Touch-friendly button sizes (min 44x44px)
- Simplified navigation

### **Desktop Enhancements**
- Persistent sidebar
- Multi-column layouts
- Hover states
- Keyboard shortcuts potential

---

## Accessibility Features

### **Current Implementation**
- Semantic HTML (header, nav, main, aside)
- ARIA labels on icon buttons
- Screen reader text for visual-only indicators
- Keyboard navigation support
- Focus visible states
- Color contrast ratios meet WCAG AA

### **Opportunities for Enhancement**
- Add skip navigation link
- Implement keyboard shortcuts for power users
- Add ARIA live regions for dynamic content
- Improve focus management in modals
- Add reduced motion preferences

---

## Performance Optimizations

### **Backend**
- API routes with caching headers
- Optimistic DB queries with indexes
- Parallel data fetching where possible
- Paginated results for large datasets

### **Frontend**
- Next.js automatic code splitting
- Dynamic imports for heavy components
- Image optimization (if implemented)
- Debounced search inputs
- Memoized components for expensive renders

---

## Google Sheets Integration

### **Purpose**
Bi-directional sync between portal and Google Sheets for providers who prefer spreadsheet workflows.

### **Data Synced (19 Columns)**
- Order Number
- Candidate Name (First/Last)
- DOB, SSN Last 4
- Contact Info (Email, Phone)
- Address (Full address, City, State, ZIP)
- Test Type, Urgency
- Jobsite Location
- Mask Requirements (Yes/No, Size)
- Status
- Created At
- Notes

### **Sync Triggers**
- **Portal → Sheets:** Automatic when order created
- **Sheets → Portal:** Webhook when sheet edited (status changes, notes updates)

### **UX Impact**
- Providers can bulk update statuses in sheets
- Changes reflect in portal immediately
- Reduces duplicate data entry

---

## Security & Compliance

### **HIPAA Compliance**
- PHI encryption at rest
- Audit logs for all mutations
- Signed URLs for document access
- PII redaction from application logs

### **Multi-Tenancy**
- Row-level security (all queries filter by orgId)
- Cross-tenant access for providers (by design)
- User role enforcement on every API call
- Organization isolation verified

### **Authentication**
- NextAuth.js with database sessions
- Email/password credentials
- Session timeout configurable
- Secure cookie handling

---

## Technical Stack

### **Framework**
- Next.js 14 (App Router)
- React 18
- TypeScript

### **Styling**
- Tailwind CSS
- shadcn/ui components
- next-themes for dark mode
- Lucide icons

### **Database**
- PostgreSQL (Neon serverless)
- Drizzle ORM
- Automatic migrations

### **Email**
- Resend API
- HTML email templates
- PDF attachments

### **PDF Processing**
- pdf-lib for generation
- pdf-parse for validation
- Auto-fill template forms

### **External Integrations**
- Google Sheets API v4
- Concentra Hub (external, no API)

---

## Current UX Strengths

✅ **Automation-First**
- Zero manual steps in authorization workflows
- Auto-send emails, auto-start timers
- One-click actions for complex operations

✅ **Clear Status Visibility**
- Color-coded status badges throughout
- Timer countdown displays
- Unread notification indicators

✅ **Validation & Error Handling**
- Real-time form validation
- Detailed PDF validation with specific errors
- Helpful error messages with context

✅ **Role-Appropriate Access**
- Employers only see their data
- Providers see all data
- Permission checks on every action

✅ **Professional Design**
- Clean, modern interface
- Consistent spacing and typography
- shadcn/ui component library

---

## Opportunities for UX Enhancement

### **High Priority**

1. **Dashboard Improvements**
   - Add charts/graphs for order trends
   - Quick action cards for common tasks
   - Recent activity timeline with richer details

2. **Search & Filtering**
   - Global search across orders and candidates
   - Advanced filters (date range, test type, etc.)
   - Saved filter presets

3. **Bulk Operations**
   - Bulk status updates
   - Bulk email sending
   - Bulk export

4. **Mobile Experience**
   - Native mobile app considerations
   - PWA capabilities
   - Simplified mobile workflows

### **Medium Priority**

5. **Notifications Enhancement**
   - Email notifications (not just in-app)
   - SMS notifications for urgent items
   - Notification preferences per user

6. **Document Management**
   - In-app PDF viewer (not just download)
   - Document versioning
   - Document templates library

7. **Reporting & Analytics**
   - Employer dashboard with turnaround times
   - Provider dashboard with volume metrics
   - Exportable reports

8. **Calendar Integration**
   - Appointment scheduling with calendar view
   - iCal/Google Calendar export
   - Appointment reminders

### **Low Priority / Nice-to-Have**

9. **Keyboard Shortcuts**
   - Power user shortcuts (e.g., `n` for new order)
   - Shortcut help modal (`?`)

10. **User Preferences**
    - Timezone selection
    - Date format preferences
    - Notification preferences
    - Default views

11. **Collaborative Features**
    - Comments/notes on orders
    - @mentions in notes
    - Activity feed per order

12. **Candidate Portal**
    - Separate login for candidates
    - View their own test results
    - Upload documents
    - Update personal info

---

## Design System

### **Typography**
- Font: Inter (Google Fonts)
- Headings: Bold, larger size scale
- Body: Regular, 14-16px
- Labels: Medium weight, 12-14px
- Code/Monospace: For order numbers, emails

### **Spacing**
- Base unit: 4px (Tailwind's spacing scale)
- Common gaps: 1rem (16px), 1.5rem (24px)
- Sections: 2rem (32px) between major sections

### **Border Radius**
- Buttons: 0.375rem (6px)
- Cards: 0.5rem (8px)
- Inputs: 0.375rem (6px)

### **Shadows**
- Cards: Subtle shadow for elevation
- Dropdowns: More pronounced shadow
- Modals: Strong shadow for prominence

---

## Future Considerations

### **Scalability**
- Currently handles ~100-1000 orders/month comfortably
- Can scale to 10,000+ orders/month with current architecture
- May need caching layer (Redis) at higher volumes

### **Internationalization**
- Currently English only
- Structure supports i18n with next-intl
- Date/time formatting respects locale

### **White-Labeling**
- Currently branded as "WorkSafe Now"
- Could support custom branding per organization
- Logo, colors, domain customization potential

### **API Access**
- No public API currently
- Could expose REST/GraphQL API for integrations
- Partner integrations (HR systems, payroll, etc.)

---

## Questions for UX Developer

1. **Mobile Strategy:** Are we prioritizing mobile web, native app, or PWA?

2. **Dashboard Design:** What metrics matter most to employers vs providers?

3. **Search Experience:** Should we implement full-text search with Algolia/Typesense?

4. **Document Viewing:** In-app PDF viewer or download-only?

5. **Notification Strategy:** Email, SMS, push notifications - what's the priority?

6. **Accessibility Targets:** WCAG AA or AAA compliance?

7. **Animation:** Do we want micro-interactions and transitions? (currently minimal)

8. **Data Visualization:** Charts library preference? (Chart.js, Recharts, D3?)

9. **User Onboarding:** Do we need walkthroughs/tours for first-time users?

10. **Error States:** Are current error messages clear enough? Need illustrations?

---

## Getting Started for UX Review

### **Access the App**
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### **Test Accounts**
Create test accounts for each role to experience full workflows.

### **Key Pages to Review**
1. `/auth/signin` - Login page
2. `/dashboard` - Landing page after login
3. `/orders` - Order list
4. `/orders/new` - Create new order
5. `/orders/[id]` - Order details (MOST COMPLEX PAGE)
6. `/settings` - Email recipient management (providers only)
7. `/candidates` - Candidate management

### **Recommended Review Flow**
1. **Employer Experience:**
   - Sign in as employer
   - Create a new order
   - View order list
   - Check notification system

2. **Provider Experience:**
   - Sign in as provider
   - View all orders
   - Upload Concentra authorization
   - Configure email recipients in Settings
   - Upload test results

3. **Dark Mode:**
   - Toggle theme and review all pages
   - Check contrast ratios
   - Verify no broken styles

---

## Contact

For questions or feedback about the UX/UI, reach out to the development team or create GitHub issues with the `ux-enhancement` label.

**Current Status:** MVP complete, ready for UX review and enhancement.
