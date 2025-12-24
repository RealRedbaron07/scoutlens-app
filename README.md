# 🔭 ScoutLens - Football Player Intelligence

A monetizable PWA for football player scouting and analysis. Install it like an app, charge users for premium features.

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

## 💰 MONETIZATION SETUP (Do This Today!)

### Step 1: Create Stripe Account (5 min)
1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete basic verification (name, email)
3. You can start in Test Mode immediately

### Step 2: Create Payment Links (5 min)
1. Go to **Stripe Dashboard** → **Payment Links** (or [dashboard.stripe.com/payment-links](https://dashboard.stripe.com/payment-links))
2. Click **+ New**
3. Create **Monthly Plan**:
   - Product name: "ScoutLens Pro Monthly"
   - Price: $9.00 USD
   - Billing: Recurring → Monthly
   - Click **Create Link**
   - Copy the link (looks like `https://buy.stripe.com/xxxxx`)

4. Create **Annual Plan**:
   - Product name: "ScoutLens Pro Annual"  
   - Price: $72.00 USD
   - Billing: Recurring → Yearly
   - Click **Create Link**
   - Copy the link

### Step 3: Add Links to App (1 min)
Open `app.js` and find these lines near the top:

```javascript
// Stripe Payment Links
STRIPE_MONTHLY_LINK: 'https://buy.stripe.com/test_XXXXXX', // $9/month
STRIPE_ANNUAL_LINK: 'https://buy.stripe.com/test_YYYYYY'   // $72/year
```

Replace with your actual Stripe links:

```javascript
STRIPE_MONTHLY_LINK: 'https://buy.stripe.com/your-actual-monthly-link',
STRIPE_ANNUAL_LINK: 'https://buy.stripe.com/your-actual-annual-link'
```

### Step 4: Go Live
1. In Stripe Dashboard, toggle from **Test mode** to **Live mode**
2. Complete any remaining verification
3. Create new Payment Links in Live mode
4. Update `app.js` with live links

**That's it! You're ready to accept payments.**

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

## 🔌 Real Player Data (Optional)

The app works with demo data out of the box. For real player data:

1. Sign up at [api-football.com](https://www.api-football.com/) (free tier: 100 requests/day)
2. Get your API key
3. In `app.js`, update:

```javascript
API_KEY: 'your-api-key-here',
DEMO_MODE: false,
```

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
A: No! Stripe Payment Links handle payments without any server code.

**Q: How do I know who paid?**
A: Stripe Dashboard shows all customers. For automatic Pro activation, you'd need a backend (future enhancement).

**Q: Can I change the price?**
A: Yes, create new Payment Links in Stripe with different prices.

**Q: Is this legal?**
A: Yes! This uses real-world football data, not game data. No licensing issues.

---

Made with ⚽ for football lovers
