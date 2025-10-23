# SendGrid Inbound Parse Setup for auth@wsnportal.com

This guide explains how to configure SendGrid Inbound Parse to receive emails at `auth@wsnportal.com` and automatically start authorization timers.

## Prerequisites

- SendGrid account (free tier works fine)
- Domain `wsnportal.com` with DNS access
- Deployed application with webhook endpoint

## Step 1: DNS Configuration

Add MX record for receiving emails:

```
Type: MX
Host: auth.wsnportal.com
Points to: mx.sendgrid.net
Priority: 10
TTL: 3600
```

## Step 2: SendGrid Inbound Parse Configuration

1. Log into SendGrid dashboard
2. Go to **Settings** → **Inbound Parse**
3. Click **Add Host & URL**
4. Configure:
   - **Domain**: `auth.wsnportal.com`
   - **URL**: `https://your-domain.com/api/webhooks/inbound-email`
   - **Spam Check**: ✓ Check incoming emails for spam
   - **Send Raw**: ☐ (leave unchecked)

## Step 3: Verify Setup

### Test Email Processing

Send a test email to `auth@wsnportal.com`:

```
To: auth@wsnportal.com
Subject: Concentra Authorization Confirmation
Body:
Authorization Number: AUTH-12345
Employee Name: John Doe
Date of Birth: 01/15/1985
```

### Check Logs

Monitor your application logs for:
```
Received inbound email: { to: 'auth@wsnportal.com', from: '...', subject: '...' }
Timer started automatically for order: <order-id>
```

## Step 4: Provider Instructions

Share these instructions with providers:

---

### **How to Auto-Start Authorization Timer**

After creating an authorization in Concentra HUB:

**Option A: Forward Email**
1. Open the Concentra confirmation email
2. Click "Forward"
3. Send to: `auth@wsnportal.com`
4. Timer starts automatically!

**Option B: CC on Creation**
1. When entering authorization in Concentra HUB
2. Add `auth@wsnportal.com` to CC field (if available)
3. Timer starts when email arrives

**Option C: Manual (Fallback)**
1. Go to order in WorkSafe Now Portal
2. Click "Start Timer Manually" button

---

## Email Parsing Logic

The webhook endpoint looks for these patterns:

### Authorization Number
```
Authorization Number: AUTH-12345
Confirmation #: CNF-98765
Auth #: 123456
```

### Candidate Information
```
Employee Name: John Doe
Patient: Jane Smith
Candidate: Robert Johnson
```

### Date of Birth
```
DOB: 01/15/1985
Date of Birth: 01/15/1985
Birth Date: 01/15/1985
```

## Troubleshooting

### Email Not Being Received

1. **Check DNS**: Verify MX record is properly configured
   ```bash
   dig MX auth.wsnportal.com
   ```

2. **Check SendGrid**: Look in SendGrid → Activity → Inbound Parse logs

3. **Check Webhook**: Verify endpoint is accessible
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/inbound-email
   ```

### Timer Not Starting

1. **Check logs**: Look for parsing errors
2. **Verify order exists**: Make sure order was created before email arrived
3. **Check matching logic**: Ensure candidate name/DOB match exactly
4. **Manual fallback**: Use "Start Timer Manually" button

### No Matching Order Found

When webhook can't match email to an order:
- Check that order exists in system
- Verify candidate name spelling matches
- Check that timer hasn't already been started
- Use manual matching in admin interface (TODO: build this)

## Security Considerations

- ✅ Webhook endpoint is public (by design for SendGrid)
- ✅ Only emails to `auth@wsnportal.com` are processed
- ✅ Duplicate timer starts are prevented
- ✅ Email content is logged for audit trail
- ⚠️ Consider adding webhook signature verification (SendGrid provides this)

## Future Enhancements

- [ ] Add webhook signature verification for security
- [ ] Store email attachments (PDF confirmations)
- [ ] Send notification to employer when timer auto-starts
- [ ] Admin interface for manual email-to-order matching
- [ ] Support for other provider systems (LabCorp, Quest, etc.)
- [ ] Machine learning to improve matching accuracy

## Cost

SendGrid Free Tier:
- 100 emails/day inbound
- More than enough for typical usage
- Upgrade to paid plan if needed
