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

## 💰 MONETIZATION SETUP (PayPal)

Your app is configured to use **PayPal** for payments. Here's how it works:

### Current Setup (PayPal.me)
Your app uses PayPal.me links which work immediately:
- Monthly: `https://paypal.me/MustafaAlpARI/9.99`
- Annual: `https://paypal.me/MustafaAlpARI/72`

### Upgrade to Hosted Buttons (For Anonymity)
If you want to hide your personal name from customers:

1. Go to [paypal.com](https://paypal.com) → **Tools** → **PayPal Buttons**
2. Create a **Subscribe** button for monthly ($9.99/month)
3. Create a **Subscribe** button for annual ($72/year)
4. Copy the `hosted_button_id` from each button
5. In `app.js`, update these lines:

```javascript
const PAYPAL_MONTHLY_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_MONTHLY_ID';
const PAYPAL_ANNUAL_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_ANNUAL_ID';
let USE_PAYPAL_BUTTONS = true; // ← Change to true
```

### Setting Up Automatic Pro Activation
To automatically activate Pro when someone pays:

1. **Create Supabase database** (see `docs/supabase-schema.sql`)
2. **Configure PayPal Webhooks**:
   - Go to [developer.paypal.com/dashboard/webhooks](https://developer.paypal.com/dashboard/webhooks)
   - Add webhook URL: `https://YOUR-DOMAIN.vercel.app/api/webhook-payment`
   - Subscribe to events: `BILLING.SUBSCRIPTION.ACTIVATED`, `PAYMENT.SALE.COMPLETED`
3. **Add environment variables** in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PAYPAL_WEBHOOK_ID`

See `docs/PAYPAL_SETUP.md` for detailed instructions.

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

- **Server-side Pro verification** - Pro status is verified via Supabase, not localStorage
- **XSS protection** - All user input is escaped with `Security.escapeHtml()`
- **Webhook signature verification** - Payment webhooks verify PayPal signatures
- **Environment variables** - Secrets are stored in environment variables, not code

See `docs/SECURITY.md` for more details.

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id
```

---

Made with ⚽ for football lovers
