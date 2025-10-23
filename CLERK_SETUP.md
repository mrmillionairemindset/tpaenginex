# Clerk Setup Instructions

## Step 1: Create Clerk Account

1. Go to https://clerk.com
2. Sign up for free account
3. Create new application: **"RapidScreen Platform"**

## Step 2: Enable Organizations

1. In Clerk Dashboard, go to **Configure** → **Organizations**
2. Enable **Organizations** feature
3. Click **Save**

## Step 3: Configure Organization Roles

Go to **Organizations** → **Roles** and create these 4 roles:

### Role 1: Employer Admin
- **Name**: Employer Admin
- **Key**: `employer_admin` ⚠️ (lowercase, underscores only)
- **Description**: Full access to employer organization
- **Permissions**: `org:sys:memberships:manage`, `org:sys:domains:manage`

### Role 2: Employer User
- **Name**: Employer User
- **Key**: `employer_user` ⚠️ (lowercase, underscores only)
- **Description**: Read-only access to employer orders
- **Permissions**: (none - read-only)

### Role 3: Provider Admin
- **Name**: Provider Admin
- **Key**: `provider_admin` ⚠️ (lowercase, underscores only)
- **Description**: Full provider access - manage all orders and sites
- **Permissions**: `org:sys:memberships:manage`, `org:sys:domains:manage`

### Role 4: Provider Agent
- **Name**: Provider Agent
- **Key**: `provider_agent` ⚠️ (lowercase, underscores only)
- **Description**: Assign sites, update status, upload results
- **Permissions**: (none - custom permissions handled in app)

## Step 4: Get API Keys

1. Go to **API Keys** in Clerk Dashboard
2. Copy your keys:
   - **Publishable Key** (starts with `pk_test_...`)
   - **Secret Key** (starts with `sk_test_...`)

## Step 5: Add Keys to .env.local

Open `.env.local` and add your Clerk keys:

```env
# Clerk Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_HERE
```

**Important**: Never commit `.env.local` to git!

## Step 6: Test the Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Click **Sign Up** to create your first user

4. Create an organization when prompted

5. You should be redirected to the dashboard!

## Troubleshooting

### Issue: "Clerk publishable key not found"
- Make sure keys are in `.env.local` (not `.env.example`)
- Restart the dev server after adding keys

### Issue: "Organization not found"
- Make sure Organizations are enabled in Clerk Dashboard
- Check that you created an organization after signing up

### Issue: Role not working
- Verify role keys exactly match: `org:employer:admin`, etc.
- Check Clerk Dashboard → Organizations → Roles

## Next Steps

Once Clerk is set up and you can sign in:
- Module 3 is complete ✅
- Continue to Module 4: UI/UX Design System
