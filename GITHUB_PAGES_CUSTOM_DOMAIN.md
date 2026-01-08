# Host Landing Page on GitHub Pages with Custom Domain

Yes! You can host your landing page on GitHub Pages and use your own domain (like `peachsounds.com`).

## Option 1: GitHub Pages (Free)

**Cost:** FREE
**Setup time:** 10-15 minutes

### Steps:

1. **Create a GitHub Repository:**
   ```bash
   # In your landing-page directory
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/dynamicmusicvst-landing.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Settings → Pages
   - Under "Source", select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click Save

3. **Your site will be live at:**
   - `https://yourusername.github.io/dynamicmusicvst-landing/`
   - Or `https://yourusername.github.io/repository-name/`

4. **Add Custom Domain:**
   - Still in Settings → Pages
   - Under "Custom domain", enter: `peachsounds.com` (or `www.peachsounds.com`)
   - Click Save
   - GitHub will create a file called `CNAME` in your repo

5. **Add DNS Records:**
   - Go to your domain registrar (Namecheap, GoDaddy, etc.)
   - Add DNS records:
   
   **For apex domain (peachsounds.com):**
   ```
   Type: A
   Name: @
   Value: 185.199.108.153
   Value: 185.199.109.153
   Value: 185.199.110.153
   Value: 185.199.111.153
   ```
   (Add all 4 A records)
   
   **OR for www subdomain (www.peachsounds.com):**
   ```
   Type: CNAME
   Name: www
   Value: yourusername.github.io
   ```

6. **Wait for DNS propagation:**
   - Usually takes 1-24 hours
   - Check with: https://www.whatsmydns.net/

7. **Force HTTPS (Recommended):**
   - GitHub Pages will automatically enable HTTPS once DNS is set
   - In Settings → Pages, check "Enforce HTTPS"

### Your site will be live at:
- `https://peachsounds.com` ✅
- `https://www.peachsounds.com` (if you set up www)

---

## Option 2: GitHub Pages with Subdomain

If you want to keep your main domain for something else:

**Use a subdomain:**
- `beta.peachsounds.com`
- `app.peachsounds.com`
- `landing.peachsounds.com`

**Setup:**
1. In GitHub Pages settings, enter subdomain: `beta.peachsounds.com`
2. Add DNS record:
   ```
   Type: CNAME
   Name: beta
   Value: yourusername.github.io
   ```
3. Wait for DNS propagation

---

## Option 3: Netlify (Alternative - Also Free)

**Pros:** 
- Easier custom domain setup
- Better for static sites
- Free SSL automatically
- Continuous deployment from GitHub

**Steps:**

1. **Sign up at:** https://www.netlify.com/
2. **Connect GitHub:**
   - "Add new site" → "Import an existing project"
   - Connect your GitHub account
   - Select your repository
3. **Deploy:**
   - Netlify will automatically deploy
   - Your site will be at: `random-name.netlify.app`
4. **Add Custom Domain:**
   - Site settings → Domain management
   - Add custom domain: `peachsounds.com`
   - Follow DNS instructions (usually just one CNAME record)
5. **Done!**

**Netlify DNS:**
- Type: CNAME
- Name: @ (or www)
- Value: your-site.netlify.app

---

## Option 4: Vercel (Also Free)

Similar to Netlify:

1. Sign up at https://vercel.com/
2. Import GitHub repository
3. Add custom domain
4. Add DNS records
5. Done!

---

## Recommended: GitHub Pages

**Why GitHub Pages:**
- ✅ Free forever
- ✅ Easy to update (just push to GitHub)
- ✅ Automatic HTTPS
- ✅ Reliable (hosted by GitHub)
- ✅ Works great for static sites

**Limitations:**
- Only static sites (HTML, CSS, JS - perfect for your landing page!)
- No server-side code (but you don't need it)
- Custom domain setup requires DNS knowledge

---

## Quick Setup Checklist

### GitHub Pages:
- [ ] Create GitHub repository
- [ ] Push landing-page files
- [ ] Enable GitHub Pages in settings
- [ ] Add custom domain in GitHub Pages settings
- [ ] Add DNS A records (for apex) or CNAME (for www)
- [ ] Wait for DNS propagation
- [ ] Enable HTTPS
- [ ] Test: Visit `https://peachsounds.com`

### DNS Records Summary:

**For peachsounds.com (apex):**
```
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
```

**For www.peachsounds.com:**
```
CNAME  www  yourusername.github.io
```

---

## Important Notes

1. **CNAME File:**
   - GitHub creates a `CNAME` file automatically
   - Don't delete it!
   - It should contain: `peachsounds.com` (or your domain)

2. **HTTPS:**
   - GitHub provides free SSL certificates
   - Enable "Enforce HTTPS" in settings
   - Takes a few hours after DNS is set

3. **Updating Your Site:**
   - Just push changes to GitHub
   - Site updates automatically (usually within seconds)

4. **File Structure:**
   - Make sure `index.html` is in the root of your repository
   - Or in the folder you specified in Pages settings

---

## Testing

After setup:
1. Visit `https://peachsounds.com`
2. Check that all assets load (images, videos, etc.)
3. Test the email form
4. Check mobile responsiveness

---

## Troubleshooting

**Site not loading:**
- Wait longer for DNS (can take 24-48 hours)
- Check DNS records are correct
- Verify CNAME file exists in repo

**HTTPS not working:**
- Wait a few hours after DNS is set
- Check "Enforce HTTPS" is enabled
- Clear browser cache

**Assets not loading:**
- Check file paths are relative (not absolute)
- Make sure all files are in the repository
- Check browser console for 404 errors

---

## Example Repository Structure

```
dynamicmusicvst-landing/
├── index.html
├── demo-video.mp4
├── demo-video2.mp4
├── grass.png
├── grass2.png
├── icon.png
└── CNAME (created by GitHub)
```

That's it! Your landing page will be live on your custom domain.

