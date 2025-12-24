#!/usr/bin/env python3
"""
ScoutLens - Football-Data.org Fetcher
FREE current-season data (2024-25)

Get your FREE API key:
    1. Go to https://www.football-data.org/
    2. Click "Register" (top right)
    3. Confirm email
    4. Your API key is on your account page

Usage:
    python3 fetch_footballdata.py --api-key YOUR_KEY
"""

import os
import json
import argparse
import urllib.request
import time
from datetime import datetime
from pathlib import Path

# League codes for football-data.org (free tier covers these)
LEAGUES = {
    'PL': {'name': 'Premier League', 'country': 'England', 'multiplier': 2.0},
    'PD': {'name': 'La Liga', 'country': 'Spain', 'multiplier': 1.4},
    'BL1': {'name': 'Bundesliga', 'country': 'Germany', 'multiplier': 1.3},
    'SA': {'name': 'Serie A', 'country': 'Italy', 'multiplier': 1.2},
    'FL1': {'name': 'Ligue 1', 'country': 'France', 'multiplier': 1.1},
}

# Position values
POSITION_BASE = {'Forward': 25, 'Midfield': 20, 'Defence': 15, 'Goalkeeper': 8}

def get_age_multiplier(age: int) -> float:
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4

def calculate_age(date_of_birth: str) -> int:
    """Calculate age from DOB string"""
    if not date_of_birth:
        return 25
    try:
        dob = datetime.strptime(date_of_birth, '%Y-%m-%d')
        today = datetime.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except:
        return 25

def fetch_scorers(api_key: str, league_code: str) -> list:
    """Fetch top scorers from a league"""
    url = f"https://api.football-data.org/v4/competitions/{league_code}/scorers?limit=30"
    
    req = urllib.request.Request(url, headers={
        'X-Auth-Token': api_key
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            return data.get('scorers', [])
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ''
        print(f"  ⚠️ HTTP {e.code}: {error_body[:100]}")
        return []
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
        return []

def process_scorer(scorer: dict, league_info: dict) -> dict:
    """Process scorer data into our format"""
    player = scorer.get('player', {})
    
    goals = scorer.get('goals', 0) or 0
    assists = scorer.get('assists', 0) or 0
    penalties = scorer.get('penalties', 0) or 0
    played_matches = scorer.get('playedMatches', 1) or 1
    
    # Estimate minutes (avg 75 min per game for top scorers)
    minutes = played_matches * 75
    
    # Get player info
    name = player.get('name', 'Unknown')
    nationality = player.get('nationality', '')
    position = player.get('position', 'Forward')
    age = calculate_age(player.get('dateOfBirth'))
    
    team = scorer.get('team', {}).get('name', 'Unknown')
    
    # Calculate xG/xA estimates (football-data doesn't have xG)
    # Use goals - penalties as non-penalty goals, estimate xG
    npg = goals - penalties
    xg = npg * 0.9 + penalties * 0.76  # Penalty xG is ~0.76
    xa = assists * 0.85
    
    minutes_per_90 = max(minutes / 90, 1)
    xgi_per_90 = (xg + xa) / minutes_per_90
    
    # Calculate values
    pos_short = position[0] if position else 'F'
    base_value = POSITION_BASE.get(position, 20)
    pos_avg = {'F': 0.55, 'M': 0.35, 'D': 0.15, 'G': 0.02}.get(pos_short, 0.45)
    
    perf_ratio = min(max(xgi_per_90 / pos_avg, 0.5), 3.5) if pos_avg > 0 else 1.0
    fair_value = base_value * perf_ratio * get_age_multiplier(age) * league_info['multiplier']
    
    # Market value estimate
    contrib = goals + (assists * 0.7)
    per_90 = contrib / minutes_per_90
    market_value = 5 + (per_90 * 22 * league_info['multiplier'] * get_age_multiplier(age))
    market_value = round(max(2.0, min(market_value, 180.0)), 1)
    
    underval_pct = ((fair_value - market_value) / market_value * 100) if market_value > 0 else 0
    
    return {
        'name': name,
        'team': team,
        'league': league_info['name'],
        'position': pos_short,
        'age': age,
        'nationality': nationality,
        'fair_value_eur_m': round(fair_value, 1),
        'market_value_eur_m': market_value,
        'undervaluation_pct': round(underval_pct, 1),
        'xgi_per_90': round(xgi_per_90, 2),
        'goals': goals,
        'assists': assists,
        'xG': round(xg, 1),
        'xA': round(xa, 1),
        'minutes_played': minutes,
        'games': played_matches
    }

def generate_js(all_players: list, output_path: str):
    """Generate player_data.js"""
    
    for i, p in enumerate(all_players):
        p['id'] = i + 1
    
    # Categorize
    undervalued = sorted(
        [p for p in all_players if p['undervaluation_pct'] > 20],
        key=lambda x: x['undervaluation_pct'],
        reverse=True
    )[:20]
    
    top_performers = sorted(all_players, key=lambda x: x['xgi_per_90'], reverse=True)[:15]
    
    rising = sorted(
        [p for p in all_players if p.get('age', 30) <= 23],
        key=lambda x: x['xgi_per_90'],
        reverse=True
    )[:15]
    
    js_content = f"""// Auto-generated player data - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: Football-Data.org - Current 2024-25 Season (FREE!)
// Run: python3 fetch_footballdata.py --api-key YOUR_KEY

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "football-data.org",
    season: "2024-25",
    updateFrequency: "daily",
    
    undervalued: {json.dumps(undervalued, indent=8)},
    
    topPerformers: {json.dumps(top_performers, indent=8)},
    
    risingStars: {json.dumps(rising, indent=8)}
}};

if (typeof module !== 'undefined') {{
    module.exports = PLAYER_DATA;
}}
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"\n✅ Generated {output_path}")
    print(f"   📊 {len(undervalued)} undervalued")
    print(f"   ⚡ {len(top_performers)} top performers")
    print(f"   🌟 {len(rising)} rising stars")

def main():
    parser = argparse.ArgumentParser(description='Fetch from football-data.org')
    parser.add_argument('--api-key', type=str, help='Football-data.org API key')
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('FOOTBALL_DATA_KEY')
    
    if not api_key:
        print("❌ No API key!")
        print()
        print("Get your FREE API key:")
        print("  1. Go to https://www.football-data.org/")
        print("  2. Click 'Register' (top right)")
        print("  3. Confirm email")
        print("  4. Your key is on your account page")
        print()
        print("Then run:")
        print("  python3 fetch_footballdata.py --api-key YOUR_KEY")
        return
    
    print("🔭 ScoutLens - Football-Data.org Fetcher")
    print("=" * 50)
    print("📅 Current 2024-25 Season (FREE!)")
    print()
    
    all_players = []
    
    for league_code, league_info in LEAGUES.items():
        print(f"📡 Fetching {league_info['name']}...")
        scorers = fetch_scorers(api_key, league_code)
        
        if scorers:
            players = [process_scorer(s, league_info) for s in scorers]
            all_players.extend(players)
            print(f"   ✓ {len(players)} players")
        else:
            print(f"   ⚠️ No data")
        
        time.sleep(6)  # Rate limit: 10 requests/minute for free tier
    
    if all_players:
        output_path = Path(__file__).parent / 'player_data.js'
        generate_js(all_players, str(output_path))
        print(f"\n📈 Total: {len(all_players)} players")
    else:
        print("\n❌ No data fetched")

if __name__ == '__main__':
    main()

