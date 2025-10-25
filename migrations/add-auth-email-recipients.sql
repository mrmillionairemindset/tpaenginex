-- Add email recipients for authorization forms at organization level
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auth_form_recipients TEXT[];

-- Add comment for clarity
COMMENT ON COLUMN organizations.auth_form_recipients IS 'Array of email addresses to receive authorization forms for this organization';
