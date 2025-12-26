# 🧪 Quick Test Guide

## Test 1: See All Players (Enable Test Mode)

**Open browser console (F12) and run:**
```javascript
localStorage.setItem('scoutlens_pro', JSON.stringify({isPro: true, email: 'test@example.com', activatedAt: new Date().toISOString()}));
localStorage.setItem('scoutlens_test_mode', 'true');
location.reload();
```

**Result:** You'll see ALL players, not just the first 5!

---

## Test 2: Email Subscription

1. Click the **"📧 Get Weekly List"** button (top right)
2. Enter your email: `test@example.com`
3. Click **"Subscribe Free"**
4. You should see: **"✅ Subscribed! Check your inbox Monday."**

**Check Console (F12):** You should see: `📧 Email submitted: test@example.com`

**Verify it worked:**
```javascript
localStorage.getItem('scoutlens_email')
// Should return: "test@example.com"
```

---

## Test 3: Full Feature Checklist

- [ ] **Search:** Type a player name in search box
- [ ] **Filters:** Click ⚙️ button → Try filtering by league/position
- [ ] **Sort:** Change "Sort By" dropdown
- [ ] **Player Card:** Click any player card → See detail modal
- [ ] **Watchlist:** Click ★ on a player → Check "Saved" tab
- [ ] **Compare:** Check 2-3 players → Click "Compare" button
- [ ] **Rumors:** Click "Rumors" tab → See transfer rumors
- [ ] **Email:** Test email subscription (see Test 2 above)

---

## Test 4: Mobile Responsive

1. Open browser DevTools (F12)
2. Click device toggle (or press Ctrl+Shift+M)
3. Test on iPhone/Android sizes
4. Check:
   - [ ] Filter panel slides in from bottom
   - [ ] Navigation works
   - [ ] Player cards stack properly
   - [ ] Search bar is accessible

---

## Common Issues & Fixes

### "I can't see all players"
→ Enable test mode (see Test 1 above)

### "Email form doesn't work"
→ Check browser console for errors
→ Make sure you're clicking the right button (📧 Get Weekly List)

### "Filters don't work"
→ Make sure filter panel is open (click ⚙️ button)
→ Try clicking "Apply Filters" button

### "Nothing loads"
→ Check browser console for errors
→ Make sure `data/player_data.js` exists
→ Try hard refresh (Ctrl+Shift+R)

---

## Ready to Launch?

Once all tests pass:
1. ✅ All players visible (with test mode)
2. ✅ Email subscription works
3. ✅ All features functional
4. ✅ Mobile responsive

**You're ready!** Follow `LAUNCH_DAY_CHECKLIST.md` next.

