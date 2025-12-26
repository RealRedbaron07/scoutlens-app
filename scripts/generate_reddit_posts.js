/**
 * Auto-generate Reddit posts from player data
 * Run: node scripts/generate_reddit_posts.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load player data
const playerDataPath = path.join(__dirname, '../data/player_data.js');
const playerDataContent = fs.readFileSync(playerDataPath, 'utf8');

// Extract PLAYER_DATA object - create a context and eval
const context = { module: {}, exports: {}, require: () => {} };
const fn = new Function('module', 'exports', 'require', playerDataContent);
fn(context.module, context.exports, context.require);

// Get PLAYER_DATA from the evaluated context
let PLAYER_DATA = context.module.exports || (typeof PLAYER_DATA !== 'undefined' ? PLAYER_DATA : null);

if (!PLAYER_DATA) {
    // Fallback: try to extract from the file content directly
    const match = playerDataContent.match(/const PLAYER_DATA = ({[\s\S]*?});/);
    if (match) {
        eval('PLAYER_DATA = ' + match[1]);
    } else {
        console.error('Could not load PLAYER_DATA');
        process.exit(1);
    }
}

const undervalued = PLAYER_DATA.undervalued || [];
const top3 = undervalued.slice(0, 3);

function generateRSoccerPost() {
    const examples = top3.map(p => {
        const name = p.name || 'Unknown';
        const team = p.team || 'Unknown';
        const market = p.market_value_eur_m || 0;
        const fair = p.fair_value_eur_m || 0;
        const pct = p.undervaluation_pct || 0;
        return `- ${name} (${team}): Market €${market}M, Fair €${fair}M (+${pct.toFixed(0)}%)`;
    }).join('\n');
    
    return {
        title: 'I built a tool to find undervalued football players using Transfermarkt + xG data',
        body: `Hey r/soccer,

I've been working on ScoutLens - a tool that combines real Transfermarkt market values with xG/xA analytics to identify undervalued players.

**How it works:**
- Uses actual Transfermarkt values (not estimates)
- Combines with xG/xA per 90 stats
- Applies age curve and league multipliers
- Highlights players where market value < fair value

**Features:**
- Search 300+ players across 25+ leagues
- Filter by league, position, age, value
- Compare players side-by-side
- Track transfer rumors
- Export data (Pro feature)

**Example findings:**
${examples}

**Try it free:** https://scoutlens-app.vercel.app

No signup required. Works on mobile and desktop.

I'd love feedback on:
- What features are missing?
- Which leagues should I add?
- What data would be most useful?

Thanks!`
    };
}

function generateRFantasyPLPost() {
    const example = top3[0];
    const name = example?.name || 'Player';
    const market = example?.market_value_eur_m || 0;
    const fair = example?.fair_value_eur_m || 0;
    
    return {
        title: 'I built a tool to find undervalued FPL players using xG data',
        body: `Hey r/fantasypl,

I built ScoutLens - a tool that finds undervalued players using Transfermarkt values + xG/xA analytics.

**Why it's useful for FPL:**
- Find hidden gems before price rises
- Compare players by xG/xA per 90
- See which players are undervalued vs market
- Track contract expiries (bargain signings)

**Example:**
- ${name} is valued at €${market}M but xG says he's worth €${fair}M
- Perfect for your wildcard?

**Try it free:** https://scoutlens-app.vercel.app

Works on mobile. No signup required.

What FPL-specific features would be most useful?`
    };
}

function generateRFMPost() {
    const example = top3[0];
    const name = example?.name || 'Player';
    const market = example?.market_value_eur_m || 0;
    const fair = example?.fair_value_eur_m || 0;
    
    return {
        title: 'I built a scouting tool for FM - finds undervalued players using real data',
        body: `Hey r/footballmanagergames,

I built ScoutLens - a scouting tool that uses real Transfermarkt values + xG data to find undervalued players.

**Why it's useful for FM:**
- Find hidden gems before they're expensive
- Compare players by xG/xA per 90
- See which players are undervalued vs market
- Track contract expiries (free transfers)
- Export data to CSV for your own analysis

**Example:**
- ${name} is valued at €${market}M but xG says he's worth €${fair}M
- Perfect for your lower league save?

**Try it free:** https://scoutlens-app.vercel.app

Works on mobile. No signup required.

What FM-specific features would be most useful?`
    };
}

// Generate all posts
const posts = {
    rsoccer: generateRSoccerPost(),
    rfantasypl: generateRFantasyPLPost(),
    rfootballmanagergames: generateRFMPost(),
    generatedAt: new Date().toISOString()
};

// Save to files
const outputDir = path.join(__dirname, '../content');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Save JSON
fs.writeFileSync(
    path.join(outputDir, 'generated_reddit_posts.json'),
    JSON.stringify(posts, null, 2)
);

// Save individual posts
Object.keys(posts).forEach(key => {
    if (key === 'generatedAt') return;
    const post = posts[key];
    const content = `TITLE:\n${post.title}\n\n---\n\nBODY:\n${post.body}`;
    fs.writeFileSync(
        path.join(outputDir, `reddit_${key}.txt`),
        content
    );
});

console.log('✅ Generated Reddit posts:');
console.log('   - r/soccer: content/reddit_rsoccer.txt');
console.log('   - r/fantasypl: content/reddit_rfantasypl.txt');
console.log('   - r/footballmanagergames: content/reddit_rfootballmanagergames.txt');
console.log('   - JSON format: content/generated_reddit_posts.json');
console.log('\n📋 Ready to copy-paste!');

