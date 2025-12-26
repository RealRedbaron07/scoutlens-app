/**
 * Automated setup script
 * Run: node scripts/auto_setup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

console.log('🔭 ScoutLens Auto-Setup\n');

// Step 1: Generate all content
console.log('📝 Step 1: Generating content...');
try {
    await import('./generate_twitter_content.js');
    console.log('   ✅ Twitter content generated');
} catch (e) {
    console.log('   ⚠️  Twitter content generation failed:', e.message);
}

try {
    await import('./generate_reddit_posts.js');
    console.log('   ✅ Reddit posts generated');
} catch (e) {
    console.log('   ⚠️  Reddit posts generation failed:', e.message);
}

// Step 2: Create content directory structure
console.log('\n📁 Step 2: Setting up directories...');
const contentDir = path.join(__dirname, '../content');
if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
    console.log('   ✅ Created content/ directory');
} else {
    console.log('   ✅ content/ directory exists');
}

// Step 3: Create README for content
console.log('\n📋 Step 3: Creating content guide...');
const contentReadme = `# Generated Content

This directory contains auto-generated social media content.

## Files

### Twitter
- \`twitter_intro.txt\` - Introduction tweet (pin this)
- \`twitter_thread.txt\` - 5-player thread (post weekly)
- \`twitter_quick_posts.txt\` - Quick value posts (use daily)
- \`generated_twitter_content.json\` - JSON format (for automation)

### Reddit
- \`reddit_rsoccer.txt\` - Post for r/soccer
- \`reddit_rfantasypl.txt\` - Post for r/fantasypl
- \`reddit_rfootballmanagergames.txt\` - Post for r/footballmanagergames
- \`generated_reddit_posts.json\` - JSON format (for automation)

## Usage

1. Copy-paste content from .txt files
2. Customize with your actual data if needed
3. Post during peak hours (7-9 AM or 6-8 PM UK time)

## Regenerate

Run these commands to regenerate content with latest player data:

\`\`\`bash
node scripts/generate_twitter_content.js
node scripts/generate_reddit_posts.js
\`\`\`

Content is generated from \`data/player_data.js\`.
`;

fs.writeFileSync(path.join(contentDir, 'README.md'), contentReadme);
console.log('   ✅ Created content/README.md');

// Step 4: Check Google Analytics setup
console.log('\n📊 Step 4: Checking Google Analytics...');
const indexPath = path.join(__dirname, '../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

if (indexContent.includes('G-XXXXXXXXXX')) {
    console.log('   ⚠️  Google Analytics needs your Measurement ID');
    console.log('   📝 Edit index.html line 76-83 and replace G-XXXXXXXXXX');
} else if (indexContent.includes('gtag')) {
    console.log('   ✅ Google Analytics code found');
} else {
    console.log('   ⚠️  Google Analytics not detected');
}

// Step 5: Summary
console.log('\n✅ Setup Complete!\n');
console.log('📋 Next Steps:');
console.log('   1. Review generated content in content/ directory');
console.log('   2. Add Google Analytics ID to index.html (if not done)');
console.log('   3. Create Twitter account and post introduction tweet');
console.log('   4. Post on Reddit using generated templates');
console.log('   5. Set up newsletter (Beehiiv/Mailchimp)');
console.log('\n📁 All content ready in: content/');
console.log('📖 Full guide: START_HERE.md\n');

