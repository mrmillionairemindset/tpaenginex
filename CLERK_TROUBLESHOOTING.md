# Clerk Organization Creation Error - Troubleshooting

## Error: 500 when creating organization

### Quick Fixes (Try in Order):

#### 1. Verify Organizations Feature is Enabled
1. Go to Clerk Dashboard → **Configure** → **Organizations**
2. Ensure **"Enable Organizations"** toggle is **ON** (blue)
3. Scroll to bottom and click **"Save"**
4. Wait 30 seconds
5. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
6. Try creating organization again

#### 2. Check Role Configuration
1. Go to **Organizations** → **Roles**
2. Verify exactly 4 roles exist:
   - `employer_admin`
   - `employer_user`
   - `provider_admin`
   - `provider_agent`
3. Keys must be **lowercase with underscores only**
4. Delete and recreate roles if there are any typos

#### 3. Verify API Keys
1. Confirm you're in the right Clerk application
2. Go to **API Keys**
3. Copy keys again and update `.env.local`
4. Restart dev server: `npm run dev`

#### 4. Check Clerk Plan Limits
1. Go to **Settings** → **Billing**
2. Verify your plan supports organizations
   - **Free tier**: Supports organizations ✅
   - If upgraded plan: May have limits

#### 5. Browser/Cache Issues
1. Open in **Incognito/Private** window
2. Try different browser
3. Clear cookies for `clerk.accounts.dev`

## Still Not Working?

### Temporary Workaround: Create Organization via Clerk Dashboard

Instead of letting users create organizations, you can create them manually:

1. In Clerk Dashboard → **Organizations**
2. Click **"New Organization"**
3. Name: "RapidScreen Provider"
4. Click **"Create"**
5. Then in your app, user can **join** that organization instead

### Alternative: Skip Multi-Tenancy for Initial Testing

We can temporarily disable the organization requirement:
1. Remove organization requirement from middleware
2. Test authentication without orgs
3. Add orgs back later

Let me know which approach you want to try!
