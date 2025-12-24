# 🚀 ScoutLens Launch Checklist

## TODAY (Get Live)

### 1. Deploy the App (10 min)
- [ ] Go to [netlify.com](https://netlify.com)
- [ ] Drag the `scoutlens` folder onto the page
- [ ] Get your URL (e.g., `scoutlens.netlify.app`)
- [ ] Optional: Connect custom domain

### 2. Set Up Email Capture (15 min)
- [ ] Create account at [beehiiv.com](https://beehiiv.com) (free)
- [ ] Create a publication called "ScoutLens Weekly"
- [ ] Get your subscribe form embed code
- [ ] Update the email forms in `index.html` to submit to Beehiiv

Example Beehiiv integration:
```html
<form action="https://api.beehiiv.com/v2/forms/XXXXX/subscribe" method="POST">
    <input type="email" name="email" placeholder="your@email.com" required>
    <button type="submit">Subscribe Free</button>
</form>
```

### 3. Create Twitter Account (10 min)
- [ ] Create `@ScoutLensHQ` or similar
- [ ] Profile: "Finding mispriced footballers with xG data. Free weekly analysis. 🔭"
- [ ] Link to your deployed app
- [ ] Post first thread (use template from `content/twitter_templates.md`)

### 4. First Content (30 min)
- [ ] Post your first "5 Most Undervalued Players" thread
- [ ] Include screenshots from the app
- [ ] Tag relevant football accounts
- [ ] Engage with replies

---

## THIS WEEK

### Data Updates
- [ ] Install Python dependencies: `pip install aiohttp`
- [ ] Run `python data/scraper.py` to fetch latest data
- [ ] Update `data/player_data.js` with new output
- [ ] Redeploy to Netlify (just drag folder again)

### Content
- [ ] Monday: Undervalued XI thread
- [ ] Wednesday: Single player deep dive
- [ ] Friday: Rising Stars thread
- [ ] Sunday: Accountability post

### Growth
- [ ] Follow 50 football analytics accounts
- [ ] Reply to 10 tweets per day with data insights
- [ ] Quote tweet pundits with "the data says..."
- [ ] Post during peak hours (7-9am UK, 6-8pm UK)

---

## WEEK 2+

### Monetization (Once you have 500+ followers)
- [ ] Create Stripe Payment Links
- [ ] Add premium tier to newsletter ($5-9/month)
- [ ] Gate "Top 20 list" behind paywall
- [ ] Keep core content free for growth

### Automation
- [ ] Set up cron job for weekly data scraping
- [ ] Create script to auto-generate thread drafts
- [ ] Schedule tweets with Buffer or TweetDeck

---

## SUCCESS METRICS

| Week | Target |
|------|--------|
| 1 | 300 followers, 50 email subs |
| 2 | 600 followers, 150 email subs |
| 3 | 1000 followers, 300 email subs |
| 4 | First paid subscriber |

**If you don't hit Week 3 targets:** Pivot the angle or content format.

---

## FILE STRUCTURE

```
scoutlens/
├── index.html          # Main app
├── styles.css          # Styling
├── app.js              # App logic
├── manifest.json       # PWA config
├── sw.js               # Service worker
├── data/
│   ├── scraper.py      # Data pipeline
│   └── player_data.js  # Player data (update weekly)
├── content/
│   └── twitter_templates.md  # Content templates
└── LAUNCH_CHECKLIST.md # This file
```

---

## QUICK WINS

1. **Screenshot the app** for visual content
2. **Tag player fan accounts** - they RT
3. **Reply with data** to transfer rumors
4. **Post during matches** when players score
5. **"I told you so" posts** when picks perform

---

## RESOURCES

- [Understat](https://understat.com) - xG data source
- [Transfermarkt](https://transfermarkt.com) - Market values
- [Beehiiv](https://beehiiv.com) - Newsletter platform
- [Netlify](https://netlify.com) - Free hosting
- [Buffer](https://buffer.com) - Tweet scheduling

---

**The model is not your edge. The distribution is.**

Ship fast. Post consistently. Iterate based on engagement.

🔭

