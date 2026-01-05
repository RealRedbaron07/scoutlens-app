# 🧪 Test Mode Guide

## How to Enable Test Mode (See All Players)

### Option 1: Browser Console (Easiest)
1. Open your app in browser
2. Press `F12` (or right-click → Inspect)
3. Go to **Console** tab
4. Type this and press Enter:
```javascript
localStorage.setItem('scoutlens_pro', JSON.stringify({isPro: true, email: 'test@example.com', activatedAt: new Date().toISOString()}));
location.reload();
```

5. Refresh the page - you'll now see ALL players!

### Option 2: Add Test Button (Permanent)
Add this to your HTML temporarily for testing.

---

## Testing Email Feature

### Current Status:
- ✅ Email forms are working
- ✅ They store email locally
- ⚠️ **Not connected to Beehiiv yet** (needs setup)

### To Test:
1. Click "📧 Get Weekly List" button
2. Enter your email
3. Click "Subscribe Free"
4. You should see: "✅ Subscribed! Check your inbox Monday."
5. Check browser console - you'll see: "Email submitted: your@email.com"

### To Connect to Beehiiv:
1. Sign up at [beehiiv.com](https://beehiiv.com)
2. Create publication: "ScoutLens Weekly"
3. Get your form endpoint URL
4. Update `app.js` line ~1738 in `handleEmailSubmit()` function
5. Replace the local storage with actual API call

---

## Testing All Features

### ✅ What Works:
- View all players (with test mode)
- Search players
- Filter by league, position, age, value
- Sort by different metrics
- Save players to watchlist
- Compare players
- View player details
- Transfer rumors
- Email subscription (stores locally)

### ⚠️ What Needs Setup:
- Email integration (Beehiiv)
- Pro payment verification (server-side)
- Live data updates (API keys)

---

## Quick Test Checklist

- [ ] Enable test mode (see all players)
- [ ] Test search functionality
- [ ] Test filters (league, position, age, value)
- [ ] Test sorting
- [ ] Add player to watchlist
- [ ] Compare 2-3 players
- [ ] View player detail modal
- [ ] Test email subscription
- [ ] Check transfer rumors tab
- [ ] Test on mobile (responsive)

---

**Ready to test!** 🚀

