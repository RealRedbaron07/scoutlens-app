# Generated Content

This directory contains auto-generated social media content.

## Files

### Twitter
- `twitter_intro.txt` - Introduction tweet (pin this)
- `twitter_thread.txt` - 5-player thread (post weekly)
- `twitter_quick_posts.txt` - Quick value posts (use daily)
- `generated_twitter_content.json` - JSON format (for automation)

### Reddit
- `reddit_rsoccer.txt` - Post for r/soccer
- `reddit_rfantasypl.txt` - Post for r/fantasypl
- `reddit_rfootballmanagergames.txt` - Post for r/footballmanagergames
- `generated_reddit_posts.json` - JSON format (for automation)

## Usage

1. Copy-paste content from .txt files
2. Customize with your actual data if needed
3. Post during peak hours (7-9 AM or 6-8 PM UK time)

## Regenerate

Run these commands to regenerate content with latest player data:

```bash
node scripts/generate_twitter_content.js
node scripts/generate_reddit_posts.js
```

Content is generated from `data/player_data.js`.
