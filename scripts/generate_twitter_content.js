/**
 * Auto-generate Twitter content from player data
 * Run: node scripts/generate_twitter_content.js
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
const PLAYER_DATA = context.module.exports || (typeof PLAYER_DATA !== 'undefined' ? PLAYER_DATA : null);

if (!PLAYER_DATA) {
    // Fallback: try to extract from the file content directly
    const match = playerDataContent.match(/const PLAYER_DATA = ({[\s\S]*?});/);
    if (match) {
        eval('const PLAYER_DATA = ' + match[1]);
    } else {
        console.error('Could not load PLAYER_DATA');
        process.exit(1);
    }
}

// Get top undervalued players
const undervalued = PLAYER_DATA.undervalued || [];
const top5 = undervalued.slice(0, 5);

// Generate Twitter thread
function generateThread() {
    let output = [];
    
    // Thread starter
    output.push(`🔭 THREAD: 5 Most Undervalued Players Right Now

These players are outperforming their market price based on xG data.

Let's break it down 🧵👇`);
    
    // Each player
    top5.forEach((player, index) => {
        const num = index + 1;
        const flag = getFlagEmoji(player.nationality || '');
        const name = player.name || 'Unknown';
        const team = player.team || 'Unknown';
        const marketValue = player.market_value_eur_m || 0;
        const fairValue = player.fair_value_eur_m || 0;
        const undervalPct = player.undervaluation_pct || 0;
        const goals = player.goals || 0;
        const assists = player.assists || 0;
        const xgi = player.xgi_per_90 || 0;
        const age = player.age || 0;
        const league = player.league || 'Unknown';
        
        output.push(`${num}/ ${flag} ${name} (${team})

Market value: €${marketValue}M
Our fair value: €${fairValue}M
Undervalued by: +${undervalPct.toFixed(0)}%

• ${goals} goals, ${assists} assists
• xGI/90: ${xgi.toFixed(2)} ${xgi > 0.7 ? '(elite)' : ''}
• Age: ${age} ${age >= 24 && age <= 26 ? '(prime years)' : ''}
• ${league} proven

${getInsight(player)}`);
    });
    
    // Thread closer
    output.push(`📊 How we calculate this:

Fair Value = Performance × Age × League

• xG + xA per 90
• Age curve (24-26 = peak)
• League multiplier

Try it yourself: scoutlens-app.vercel.app

Follow for weekly updates 🔭`);
    
    return output;
}

// Generate quick posts
function generateQuickPosts() {
    const posts = [];
    const players = undervalued.slice(0, 10);
    
    players.forEach(player => {
        const name = player.name || 'Unknown';
        const position = player.position || 'F';
        const marketValue = player.market_value_eur_m || 0;
        const xgi = player.xgi_per_90 || 0;
        const age = player.age || 0;
        const undervalPct = player.undervaluation_pct || 0;
        
        posts.push(`🔭 Found another hidden gem:

${name} - ${position}
Market Value: €${marketValue}M
xG/90: ${xgi.toFixed(2)}
Age: ${age}

Why he's undervalued:
✅ ${getReason1(player)}
✅ ${getReason2(player)}

Full analysis: scoutlens-app.vercel.app

#FootballAnalytics #TransferMarket`);
    });
    
    return posts;
}

// Helper functions
function getFlagEmoji(nationality) {
    const flags = {
        'France': '🇫🇷', 'Ghana': '🇬🇭', 'Brazil': '🇧🇷', 'England': '🇬🇧',
        'Spain': '🇪🇸', 'Germany': '🇩🇪', 'Italy': '🇮🇹', 'Portugal': '🇵🇹',
        'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Argentina': '🇦🇷', 'Colombia': '🇨🇴',
        'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'USA': '🇺🇸', 'Japan': '🇯🇵',
        'South Korea': '🇰🇷', 'Nigeria': '🇳🇬', 'Senegal': '🇸🇳', 'Morocco': '🇲🇦'
    };
    return flags[nationality] || '⚽';
}

function getInsight(player) {
    const age = player.age || 0;
    const league = player.league || '';
    const undervalPct = player.undervaluation_pct || 0;
    
    if (undervalPct > 150) return "Someone's getting a bargain.";
    if (age <= 23) return "Future star at today's prices.";
    if (league.includes('Premier League') || league.includes('La Liga')) return "Top 6 clubs should be watching.";
    return "Hidden gem alert.";
}

function getReason1(player) {
    const league = player.league || '';
    const age = player.age || 0;
    
    if (league.includes('Championship') || league.includes('Eredivisie')) {
        return "Playing in lower league but elite xG";
    }
    if (age >= 24 && age <= 26) {
        return "Prime age not factored into value";
    }
    return "Market value doesn't reflect performance";
}

function getReason2(player) {
    const contract = player.contract_status || '';
    const xgi = player.xgi_per_90 || 0;
    
    if (contract === 'expiring') {
        return "Contract expiring soon = bargain";
    }
    if (xgi > 0.7) {
        return "Elite xGI/90 for this price";
    }
    return "Consistent output this season";
}

// Generate introduction tweet
function generateIntro() {
    return `🔭 Introducing ScoutLens

I built a tool to find undervalued football players using real Transfermarkt values + xG data.

How it works:
✅ Real market values (not estimates)
✅ xG/xA analytics
✅ 25+ leagues covered
✅ Free to use

Try it free: scoutlens-app.vercel.app

#FootballAnalytics #TransferMarket`;
}

// Main execution
console.log('🔭 Generating Twitter content...\n');

const intro = generateIntro();
const thread = generateThread();
const quickPosts = generateQuickPosts();

// Save to file
const output = {
    intro,
    thread,
    quickPosts,
    generatedAt: new Date().toISOString()
};

const outputPath = path.join(__dirname, '../content/generated_twitter_content.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

// Also create human-readable files
const introPath = path.join(__dirname, '../content/twitter_intro.txt');
const threadPath = path.join(__dirname, '../content/twitter_thread.txt');
const postsPath = path.join(__dirname, '../content/twitter_quick_posts.txt');

fs.writeFileSync(introPath, intro);
fs.writeFileSync(threadPath, thread.join('\n\n---\n\n'));
fs.writeFileSync(postsPath, quickPosts.join('\n\n---\n\n'));

console.log('✅ Generated Twitter content:');
console.log(`   - Introduction tweet: content/twitter_intro.txt`);
console.log(`   - Thread (${thread.length} tweets): content/twitter_thread.txt`);
console.log(`   - Quick posts (${quickPosts.length}): content/twitter_quick_posts.txt`);
console.log(`   - JSON format: content/generated_twitter_content.json`);
console.log('\n📋 Ready to copy-paste!');

