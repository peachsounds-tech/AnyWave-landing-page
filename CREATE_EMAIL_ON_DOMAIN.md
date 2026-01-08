# How to Create Email Addresses on Your Domain

Once you own `peachsounds.com`, here are the main ways to create email addresses:

## Option 1: SendGrid (Recommended for Automated Emails)

**Best for:** Sending automated emails (like your early access emails)
**Cost:** Free (100 emails/day) or paid plans
**Setup time:** 15-30 minutes

### Steps:

1. **Sign up for SendGrid:**
   - Go to https://sendgrid.com/
   - Create a free account

2. **Verify Your Domain:**
   - Dashboard → Settings → Sender Authentication → Domain Authentication
   - Click "Authenticate Your Domain"
   - Enter `peachsounds.com`
   - Choose "I'll use SendGrid to send all my email" (for automated emails)

3. **Add DNS Records:**
   - SendGrid will give you DNS records to add:
     - CNAME records (for tracking)
     - TXT records (for verification)
   - Go to your domain registrar (Namecheap, GoDaddy, etc.)
   - Add these records to your domain's DNS settings
   - Wait for verification (usually 1-24 hours)

4. **Create Email Addresses:**
   - Once verified, you can use ANY email address on your domain
   - Examples: `beta@peachsounds.com`, `support@peachsounds.com`, `hello@peachsounds.com`
   - No need to "create" them - just use them in your EmailJS template!

5. **Use in EmailJS:**
   - Connect SendGrid to EmailJS
   - In your template, set "From Email" to `beta@peachsounds.com`
   - Done!

**Note:** SendGrid is for SENDING emails, not receiving. You can't check `beta@peachsounds.com` inbox.

---

## Option 2: Google Workspace (For Full Email Inbox)

**Best for:** Having a real inbox you can check (like Gmail)
**Cost:** $6/user/month (or free with Google Workspace Starter)
**Setup time:** 30 minutes

### Steps:

1. **Sign up for Google Workspace:**
   - Go to https://workspace.google.com/
   - Choose a plan (Business Starter is $6/month)
   - Enter your domain: `peachsounds.com`

2. **Verify Domain Ownership:**
   - Google will give you a TXT record
   - Add it to your domain's DNS
   - Verify in Google Workspace dashboard

3. **Create Email Addresses:**
   - Google Workspace → Users → Add User
   - Create `beta@peachsounds.com`
   - Set a password
   - User can now log in and check email at Gmail.com

4. **For Automated Emails:**
   - You can still use SendGrid for automated emails
   - Or use Google Workspace SMTP (more complex)

**Pros:** Real inbox, can receive emails, professional
**Cons:** Costs money, more complex setup

---

## Option 3: Microsoft 365 (Alternative to Google)

**Best for:** Full email inbox (like Outlook)
**Cost:** $6/user/month
**Setup time:** 30 minutes

Similar to Google Workspace:
1. Sign up for Microsoft 365
2. Verify domain
3. Create users/email addresses
4. Users get Outlook inbox

---

## Option 4: Your Hosting Provider's Email

**Best for:** If you have web hosting
**Cost:** Usually included with hosting
**Setup time:** 10 minutes

If you host your website with a provider (like Bluehost, SiteGround, etc.):

1. **Log into hosting control panel** (cPanel, etc.)
2. **Go to Email section**
3. **Create email account:**
   - Email: `beta`
   - Domain: `peachsounds.com`
   - Password: (set one)
4. **Access email:**
   - Webmail: `webmail.peachsounds.com`
   - Or configure in email client (Outlook, Mail app, etc.)

**Pros:** Usually free with hosting
**Cons:** Less professional, limited features

---

## Option 5: Zoho Mail (Free Option)

**Best for:** Free email inbox
**Cost:** FREE (up to 5 users)
**Setup time:** 20 minutes

1. **Sign up at:** https://www.zoho.com/mail/
2. **Add your domain**
3. **Verify domain** (add DNS records)
4. **Create email addresses** (free for up to 5 users)
5. **Access via webmail or email client**

**Pros:** Free, real inbox
**Cons:** Less features than paid options

---

## Recommended Setup for Your Use Case

Since you need `beta@peachsounds.com` for automated early access emails:

### Best Combination:

1. **SendGrid** (for sending automated emails)
   - Free tier: 100 emails/day
   - Set up domain authentication
   - Use `beta@peachsounds.com` as sender
   - Connect to EmailJS

2. **Zoho Mail** (if you want to receive emails at that address)
   - Free for personal use
   - Create `beta@peachsounds.com` inbox
   - Can receive replies, support emails, etc.

### Quick Setup:

**For Sending (SendGrid):**
```
1. Sign up SendGrid → Verify domain → Use in EmailJS
2. Time: 15-30 minutes
3. Cost: FREE
```

**For Receiving (Optional - Zoho):**
```
1. Sign up Zoho → Add domain → Create email
2. Time: 20 minutes  
3. Cost: FREE
```

---

## DNS Records Explained

When you verify a domain, you typically add:

- **TXT records:** For verification (proves you own the domain)
- **CNAME records:** For email routing and tracking
- **MX records:** For receiving emails (if using inbox service)

Your domain registrar (where you bought the domain) has a DNS management section where you add these.

---

## Step-by-Step: SendGrid Setup (Most Common)

1. **Buy domain** (if not owned): Namecheap, GoDaddy, etc.
2. **Sign up SendGrid:** https://sendgrid.com/
3. **Verify domain:**
   - SendGrid Dashboard → Settings → Domain Authentication
   - Add `peachsounds.com`
   - Copy the DNS records
4. **Add DNS records:**
   - Go to your domain registrar
   - Find DNS Management / DNS Settings
   - Add the CNAME and TXT records SendGrid provided
   - Save
5. **Wait for verification:** Usually 1-24 hours
6. **Use email address:**
   - Once verified, you can use `beta@peachsounds.com`
   - No need to "create" it - just use it!
   - Set it in EmailJS template as "From Email"

That's it! Once verified, `beta@peachsounds.com` will work for sending emails.

