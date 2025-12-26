#!/usr/bin/env node
/**
 * Auto Promotion Setup Script
 * Generates all initial promotion content and sets up tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.join(__dirname, '../content');
const OUTPUT_DIR = path.join(__dirname, '../promotion');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Twitter Introduction Post (PIN THIS)
const twitterIntro = `🔭 Introducing ScoutLens

A free tool I built to find undervalued footballers using real Transfermarkt values + xG data.

What it does:
✅ Tracks 300+ players across 25+ leagues
✅ Shows actual market values (not estimates)
✅ Calculates undervaluation % using xG
✅ Updates daily with live transfer rumors

Try it free: [YOUR_APP_URL]

No signup required. Just data. 🚀

#FootballAnalytics #Scouting #xG`;

// Twitter Thread Template
const twitterThread = `🧵 THREAD: 5 Most Undervalued Players Right Now

Using real Transfermarkt values + xG data, here are the players clubs should be targeting:

1/ [PLAYER_NAME] - [CLUB]
   Market Value: €[VALUE]M
   Undervaluation: [X]%
   Why: [REASON]
   
   [SCREENSHOT]

2/ [PLAYER_NAME] - [CLUB]
   Market Value: €[VALUE]M
   Undervaluation: [X]%
   Why: [REASON]
   
   [SCREENSHOT]

3/ [PLAYER_NAME] - [CLUB]
   Market Value: €[VALUE]M
   Undervaluation: [X]%
   Why: [REASON]
   
   [SCREENSHOT]

4/ [PLAYER_NAME] - [CLUB]
   Market Value: €[VALUE]M
   Undervaluation: [X]%
   Why: [REASON]
   
   [SCREENSHOT]

5/ [PLAYER_NAME] - [CLUB]
   Market Value: €[VALUE]M
   Undervaluation: [X]%
   Why: [REASON]
   
   [SCREENSHOT]

All data from @ScoutLensHQ
Try it free: [YOUR_APP_URL]

#FootballAnalytics #Scouting`;

// Reddit Post Template (r/soccer)
const redditPostSoccer = `**Title:** I Built a Free Tool to Find Undervalued Footballers - Here's What I Found

**Body:**

Hey r/soccer,

I've been working on a scouting tool called ScoutLens that uses real Transfermarkt values + xG data to find undervalued players. I thought you might find it interesting.

**What it does:**
- Tracks 300+ players across 25+ leagues
- Shows actual market values (not estimates)
- Calculates undervaluation % using xG/xGI
- Updates daily with live transfer rumors

**Some interesting findings:**
1. [PLAYER_NAME] is undervalued by [X]% - Market value €[VALUE]M but xG suggests [HIGHER_VALUE]M
2. [PLAYER_NAME] is undervalued by [X]% - [REASON]
3. [PLAYER_NAME] is undervalued by [X]% - [REASON]

**Try it free:** [YOUR_APP_URL]

No signup required. Just data. Let me know what you think!

**Note:** I'm not selling anything. This is completely free. Just sharing something I built that might be useful.

---

**Edit:** Thanks for all the feedback! I've updated the tool based on your suggestions:
- [IMPROVEMENT_1]
- [IMPROVEMENT_2]`;

// Reddit Post Template (r/fantasypl)
const redditPostFantasyPL = `**Title:** Hidden Gems for Your FPL Team - Data-Driven Analysis

**Body:**

Hey r/FantasyPL,

I built a tool that analyzes undervalued players using xG data, and I thought you might find it useful for your FPL team.

**What I found:**

Here are 5 players who are undervalued based on their xG performance:

1. **[PLAYER_NAME]** - [CLUB]
   - Market Value: €[VALUE]M
   - xGI per 90: [X]
   - Undervaluation: [X]%
   - FPL Price: £[PRICE]M
   - Why: [REASON]

2. **[PLAYER_NAME]** - [CLUB]
   - Market Value: €[VALUE]M
   - xGI per 90: [X]
   - Undervaluation: [X]%
   - FPL Price: £[PRICE]M
   - Why: [REASON]

3. **[PLAYER_NAME]** - [CLUB]
   - Market Value: €[VALUE]M
   - xGI per 90: [X]
   - Undervaluation: [X]%
   - FPL Price: £[PRICE]M
   - Why: [REASON]

4. **[PLAYER_NAME]** - [CLUB]
   - Market Value: €[VALUE]M
   - xGI per 90: [X]
   - Undervaluation: [X]%
   - FPL Price: £[PRICE]M
   - Why: [REASON]

5. **[PLAYER_NAME]** - [CLUB]
   - Market Value: €[VALUE]M
   - xGI per 90: [X]
   - Undervaluation: [X]%
   - FPL Price: £[PRICE]M
   - Why: [REASON]

**Try the tool:** [YOUR_APP_URL]

All data is free and updated daily. No signup required.

What do you think? Any players I'm missing?`;

// Email Newsletter Template
const newsletterTemplate = `Subject: ScoutLens Weekly - Top 5 Undervalued Players This Week

Hey [NAME],

Welcome to ScoutLens Weekly! Here are the 5 most undervalued players this week:

1. **[PLAYER_NAME]** - [CLUB]
   Market Value: €[VALUE]M | Undervaluation: [X]%
   Why: [REASON]

2. **[PLAYER_NAME]** - [CLUB]
   Market Value: €[VALUE]M | Undervaluation: [X]%
   Why: [REASON]

3. **[PLAYER_NAME]** - [CLUB]
   Market Value: €[VALUE]M | Undervaluation: [X]%
   Why: [REASON]

4. **[PLAYER_NAME]** - [CLUB]
   Market Value: €[VALUE]M | Undervaluation: [X]%
   Why: [REASON]

5. **[PLAYER_NAME]** - [CLUB]
   Market Value: €[VALUE]M | Undervaluation: [X]%
   Why: [REASON]

**Transfer Rumors This Week:**
- [RUMOR_1]
- [RUMOR_2]
- [RUMOR_3]

**Try ScoutLens:** [YOUR_APP_URL]

Thanks for reading!
[YOUR_NAME]
ScoutLens`;

// Daily Tweet Templates
const dailyTweets = [
    `💡 Quick Insight: [PLAYER_NAME] is undervalued by [X]% according to xG data.

Market Value: €[VALUE]M
xG suggests: €[HIGHER_VALUE]M

Data from @ScoutLensHQ
[YOUR_APP_URL]`,

    `📊 The data says [CLUB] should sign [PLAYER_NAME].

Why:
✅ Undervalued by [X]%
✅ High xGI per 90 ([X])
✅ Contract expires [DATE]

Full analysis: [YOUR_APP_URL]`,

    `🔍 Hidden Gem Alert: [PLAYER_NAME]

Playing in [LEAGUE], this player is:
- Undervalued by [X]%
- xGI per 90: [X]
- Market Value: €[VALUE]M

Find more: [YOUR_APP_URL]`,

    `⚽ Transfer Rumor: [PLAYER_NAME] linked with [CLUB]

Our data shows:
- Undervaluation: [X]%
- Market Value: €[VALUE]M
- xG Performance: [X]

Is this a good deal? [YOUR_APP_URL]`,

    `📈 Rising Star: [PLAYER_NAME]

This season:
- Goals: [X]
- xGI per 90: [X]
- Undervaluation: [X]%

Why clubs should be watching: [YOUR_APP_URL]`
];

// Generate all files
const files = {
    'twitter_intro.txt': twitterIntro,
    'twitter_thread_template.txt': twitterThread,
    'reddit_rsoccer.txt': redditPostSoccer,
    'reddit_rfantasypl.txt': redditPostFantasyPL,
    'newsletter_template.txt': newsletterTemplate,
    'daily_tweets.txt': dailyTweets.join('\n\n---\n\n')
};

console.log('🚀 Generating promotion content...\n');

Object.entries(files).forEach(([filename, content]) => {
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ Created: ${filename}`);
});

// Create README
const readme = `# 🚀 Promotion Content

This folder contains all the content you need to start promoting ScoutLens.

## Files:

1. **twitter_intro.txt** - PIN THIS as your first tweet
2. **twitter_thread_template.txt** - Template for Twitter threads
3. **reddit_rsoccer.txt** - Post for r/soccer
4. **reddit_rfantasypl.txt** - Post for r/fantasypl
5. **newsletter_template.txt** - Weekly email template
6. **daily_tweets.txt** - Quick tweet templates

## How to Use:

1. Replace [YOUR_APP_URL] with your actual app URL
2. Replace [PLAYER_NAME], [CLUB], [VALUE], etc. with real data
3. Add screenshots where indicated
4. Post according to the schedule in PROJECT_RATING_AND_PROMOTION.md

## Next Steps:

1. Post twitter_intro.txt and PIN IT
2. Post your first thread using twitter_thread_template.txt
3. Post on Reddit using reddit_rsoccer.txt
4. Set up newsletter using newsletter_template.txt

Good luck! 🚀
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme, 'utf8');
console.log(`\n✅ Created: README.md`);

console.log('\n✨ All promotion content generated!');
console.log(`📁 Location: ${OUTPUT_DIR}`);
console.log('\n📝 Next steps:');
console.log('1. Replace [YOUR_APP_URL] with your actual URL');
console.log('2. Fill in player data from your app');
console.log('3. Post according to PROJECT_RATING_AND_PROMOTION.md');
console.log('\n🚀 Ready to launch!');

