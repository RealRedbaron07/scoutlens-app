# 🔭 ScoutLens - Football Player Intelligence

A monetizable PWA for football player scouting and analysis. Install it like an app, charge users for premium features.

## ⚠️ Important: Data & Methodology

**ScoutLens is a snapshot analysis tool**, not a live data feed. Key things to understand:

- **"Fair Value" is an algorithmic estimate** - It's calculated based on xG, xA, age, and league context. It is NOT an official market valuation or financial metric.
- **Data freshness depends on manual updates** - The data reflects the last time the Python update scripts were run. Check the timestamp displayed in the app.
- **This is for analysis purposes only** - Values shown should be used as a scouting reference, not for financial decisions.

## 🚀 Quick Start

```bash
# Option 1: Open directly
open index.html

# Option 2: Run local server (recommended)
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## 📱 Install as Mobile App

The app is a PWA (Progressive Web App). Users can install it:

1. **iPhone/iPad**: Open in Safari → Share → "Add to Home Screen"
2. **Android**: Open in Chrome → Menu → "Install app" or "Add to Home Screen"
3. **Desktop**: Chrome shows install icon in address bar

Once installed, it works like a native app with its own icon!

---

## 💰 MONETIZATION (PayPal - Already Working!)

Your app uses **PayPal.me** links for payments. They're already configured and working:
- Monthly ($9.99): `https://paypal.me/MustafaAlpARI/9.99`
- Annual ($72): `https://paypal.me/MustafaAlpARI/72`

### How Pro Activation Works

1. **Customer pays** via PayPal link in the app
2. **Customer contacts you** with their PayPal email (via DM, email, etc.)
3. **You verify payment** in your PayPal dashboard
4. **You add their email** to `api/verify-access.js`:

```javascript
const PRO_EMAILS = new Set([
    'customer1@email.com',  // Add verified customers here
    'customer2@email.com',
]);
```

5. **Customer enters email** in app → gets Pro access!

### Optional: Hide Your Name (Hosted Buttons)

If you want anonymity, create PayPal Hosted Buttons:
1. Go to [paypal.com](https://paypal.com) → **Tools** → **PayPal Buttons**
2. Create Subscribe buttons and copy the IDs
3. Update `app.js` with your button IDs

---

## 🌐 Deploy Online (Free)

### Option A: Netlify (Easiest)
1. Go to [netlify.com](https://netlify.com) → Sign up free
2. Drag & drop the `scoutlens` folder onto the page
3. Get instant URL like `random-name.netlify.app`
4. (Optional) Connect custom domain

### Option B: Vercel
1. Go to [vercel.com](https://vercel.com) → Sign up free
2. Click **Add New** → **Project**
3. Upload the `scoutlens` folder
4. Get instant URL

### Option C: GitHub Pages (Free)
1. Create GitHub repo
2. Push the code
3. Settings → Pages → Enable
4. Get URL like `username.github.io/repo`

---

## 📊 Updating Player Data (Snapshot-Based)

The app uses snapshot data that requires periodic manual updates. Here's how to refresh the data:

### Option 1: API-Football (Recommended)
1. Sign up at [api-football.com](https://www.api-football.com/) (free tier: 100 requests/day)
2. Get your API key from the dashboard
3. Run the fetcher:

```bash
cd data
python3 fetch_api_football.py --api-key YOUR_KEY
```

### Option 2: Automatic Daily Updates (GitHub Actions)
1. Push this repo to GitHub
2. Go to Settings → Secrets → Actions
3. Add secret: `FOOTBALL_API_KEY` = your API key
4. The workflow will update data daily at 6 AM UTC

### Option 3: Manual Updates with Understat (May Break)
```bash
cd data
python3 scraper.py --output js
```
⚠️ Note: Understat frequently changes their site structure, so this may fail.

---

## 📊 Features

| Feature | Free | Pro |
|---------|------|-----|
| Player search | 5/day | Unlimited |
| Watchlist | 5 players | Unlimited |
| Player comparison | ✓ | ✓ |
| Valuation engine | ✓ | ✓ |
| Export reports | ✗ | ✓ |

---

## 🎨 Customization

### Change Pricing
Edit `index.html` and `app.js` to update displayed prices and Stripe links.

### Change Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --accent-primary: #00d4aa;  /* Main teal */
    --accent-secondary: #fbbf24; /* Gold */
}
```

### Change Branding
- Logo: Update the 🔭 emoji throughout
- Name: Search and replace "ScoutLens"

---

## 📈 Marketing Ideas

1. **Football Twitter** - Post player comparisons, valuations
2. **Reddit** - r/soccer, r/fantasypl, r/footballmanagergames  
3. **YouTube** - "Is [Player] worth €100M?" videos using the app
4. **TikTok** - Quick player analysis clips
5. **Discord** - Football communities, FPL servers

---

## 📄 Tech Stack

- Vanilla JavaScript (no build step)
- PWA (installable, works offline)
- Stripe Payment Links (no backend needed)
- Optional: API-Football for real data

---

## ❓ FAQ

**Q: Do I need a backend?**
A: For basic payments, no. Stripe Payment Links work without a server. For automatic Pro activation, use Supabase + webhooks (see `docs/supabase-schema.sql`).

**Q: How do Pro users get access?**
A: Configure webhooks in Stripe to call `/api/webhook-payment`. This automatically updates the Supabase database when someone subscribes.

**Q: Can I change the price?**
A: Yes, create new Payment Links in Stripe with different prices.

**Q: Is this legal?**
A: Yes! This uses real-world football data, not game data. No licensing issues.

---

## 📁 Documentation

Additional documentation has been moved to the `docs/` folder:

| Document | Description |
|----------|-------------|
| [supabase-schema.sql](docs/supabase-schema.sql) | Database schema for Pro subscriptions |
| [QUICK_START_GUIDE.md](docs/QUICK_START_GUIDE.md) | Detailed setup instructions |
| [SECURITY.md](docs/SECURITY.md) | Security best practices |
| [PAYPAL_SETUP.md](docs/PAYPAL_SETUP.md) | PayPal integration guide |
| [LEGAL_RISK_ASSESSMENT.md](docs/LEGAL_RISK_ASSESSMENT.md) | Legal considerations |
| [LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Pre-launch checklist |

---

## 🧪 Testing

Run the security test suite:

```bash
npm test
```

Tests cover:
- ✅ Pro access verification logic
- ✅ Token validation & expiry
- ✅ XSS prevention
- ✅ Input validation

---


## 🔐 Security

This app implements several security measures:

- **Server-side Pro verification** - Pro emails are verified on the server, not client localStorage
- **XSS protection** - All user input is escaped with `Security.escapeHtml()`
- **HTTPS enforced** - Security headers require HTTPS in production
- **CSP headers** - Content Security Policy prevents script injection

See `docs/SECURITY.md` for more details.

---

Made with ⚽ for football lovers
