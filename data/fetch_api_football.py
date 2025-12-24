#!/usr/bin/env python3
"""
ScoutLens - API-Football Data Fetcher
Real-time player data from api-football.com

Setup:
    1. Sign up at https://www.api-football.com/ (free tier: 100 req/day)
    2. Get your API key from the dashboard
    3. Run: python fetch_api_football.py --api-key YOUR_KEY

Or set environment variable:
    export FOOTBALL_API_KEY=your_key_here
    python fetch_api_football.py
"""

import os
import json
import argparse
import urllib.request
from datetime import datetime
from pathlib import Path

# League IDs for API-Football
LEAGUES = {
    'Premier League': {'id': 39, 'country': 'England', 'multiplier': 2.0},
    'La Liga': {'id': 140, 'country': 'Spain', 'multiplier': 1.4},
    'Bundesliga': {'id': 78, 'country': 'Germany', 'multiplier': 1.3},
    'Serie A': {'id': 135, 'country': 'Italy', 'multiplier': 1.2},
    'Ligue 1': {'id': 61, 'country': 'France', 'multiplier': 1.1},
}

# Position base values (in millions EUR)
POSITION_BASE = {'Attacker': 25, 'Midfielder': 20, 'Defender': 15, 'Goalkeeper': 8}

def get_age_multiplier(age: int) -> float:
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4

def fetch_players(api_key: str, league_id: int, season: int = 2023) -> list:
    """Fetch top scorers from API-Football"""
    url = f"https://v3.football.api-sports.io/players/topscorers?league={league_id}&season={season}"
    
    req = urllib.request.Request(url, headers={
        'x-apisports-key': api_key
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            # Check for API errors
            errors = data.get('errors', {})
            if errors:
                error_msg = list(errors.values())[0] if errors else "Unknown error"
                print(f"  ⚠️ API Error: {error_msg}")
                return []
            
            return data.get('response', [])
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
        return []

def process_player(player_data: dict, league_info: dict) -> dict:
    """Process API response into our format"""
    player = player_data.get('player', {})
    stats = player_data.get('statistics', [{}])[0]
    
    goals = stats.get('goals', {}).get('total', 0) or 0
    assists = stats.get('goals', {}).get('assists', 0) or 0
    games = stats.get('games', {}).get('appearences', 0) or 1
    minutes = stats.get('games', {}).get('minutes', 0) or 1
    
    position = stats.get('games', {}).get('position', 'Midfielder')
    age = player.get('age', 25)
    
    # Calculate xGI estimate (API-Football doesn't have xG for free tier)
    # Use actual G+A as proxy
    minutes_per_90 = max(minutes / 90, 1)
    xgi_per_90 = (goals + assists) / minutes_per_90
    
    # Calculate fair value
    base = POSITION_BASE.get(position, 20)
    pos_avg = {'Attacker': 0.55, 'Midfielder': 0.35, 'Defender': 0.15, 'Goalkeeper': 0.02}
    perf_ratio = min(max(xgi_per_90 / pos_avg.get(position, 0.35), 0.5), 3.0)
    
    fair_value = base * perf_ratio * get_age_multiplier(age) * league_info['multiplier']
    market_value = estimate_market_value(goals, assists, minutes, age, league_info['multiplier'])
    underval_pct = ((fair_value - market_value) / market_value * 100) if market_value > 0 else 0
    
    return {
        'name': player.get('name', 'Unknown'),
        'team': stats.get('team', {}).get('name', 'Unknown'),
        'league': stats.get('league', {}).get('name', 'Unknown'),
        'position': position[0] if position else 'M',
        'age': age,
        'nationality': player.get('nationality', ''),
        'fair_value_eur_m': round(fair_value, 1),
        'market_value_eur_m': round(market_value, 1),
        'undervaluation_pct': round(underval_pct, 1),
        'xgi_per_90': round(xgi_per_90, 2),
        'goals': goals,
        'assists': assists,
        'xG': round(goals * 0.85, 1),  # Estimate
        'xA': round(assists * 0.9, 1),  # Estimate
        'minutes_played': minutes,
        'games': games
    }

def estimate_market_value(goals: int, assists: int, minutes: int, age: int, league_mult: float) -> float:
    if minutes < 450:
        return 2.0
    contrib = goals + (assists * 0.7)
    per_90 = contrib / (minutes / 90)
    base = 3 + (per_90 * 25 * league_mult * get_age_multiplier(age))
    return round(max(1.0, min(base, 150.0)), 1)

def generate_js(all_players: list, output_path: str):
    """Generate player_data.js file"""
    
    # Sort and categorize
    for i, p in enumerate(all_players):
        p['id'] = i + 1
    
    undervalued = sorted([p for p in all_players if p['undervaluation_pct'] > 20], 
                         key=lambda x: x['undervaluation_pct'], reverse=True)[:15]
    
    top_performers = sorted(all_players, key=lambda x: x['xgi_per_90'], reverse=True)[:10]
    
    rising = sorted([p for p in all_players if p.get('age', 30) <= 23],
                    key=lambda x: x['xgi_per_90'], reverse=True)[:10]
    
    js_content = f"""// Auto-generated player data - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: API-Football (api-football.com)
// Run: python fetch_api_football.py --api-key YOUR_KEY

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "api-football",
    updateFrequency: "daily",
    
    undervalued: {json.dumps(undervalued, indent=8)},
    
    topPerformers: {json.dumps(top_performers, indent=8)},
    
    risingStars: {json.dumps(rising, indent=8)}
}};

if (typeof module !== 'undefined') {{
    module.exports = PLAYER_DATA;
}}
"""
    
    with open(output_path, 'w') as f:
        f.write(js_content)
    
    print(f"✅ Generated {output_path}")
    print(f"   - {len(undervalued)} undervalued players")
    print(f"   - {len(top_performers)} top performers")
    print(f"   - {len(rising)} rising stars")

def main():
    parser = argparse.ArgumentParser(description='Fetch player data from API-Football')
    parser.add_argument('--api-key', type=str, help='API-Football API key')
    parser.add_argument('--season', type=int, default=2023, help='Season year (free tier: 2021-2023)')
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('FOOTBALL_API_KEY')
    
    if not api_key:
        print("❌ No API key provided!")
        print()
        print("Get a free API key from https://www.api-football.com/")
        print()
        print("Usage:")
        print("  python fetch_api_football.py --api-key YOUR_KEY")
        print()
        print("Or set environment variable:")
        print("  export FOOTBALL_API_KEY=your_key_here")
        return
    
    print("🔭 ScoutLens - API-Football Data Fetcher")
    print("=" * 50)
    
    all_players = []
    
    for league_name, league_info in LEAGUES.items():
        print(f"📡 Fetching {league_name}...")
        players = fetch_players(api_key, league_info['id'], args.season)
        
        if players:
            processed = [process_player(p, league_info) for p in players]
            all_players.extend(processed)
            print(f"   ✓ {len(processed)} players")
        else:
            print(f"   ⚠️ No data")
    
    if all_players:
        output_path = Path(__file__).parent / 'player_data.js'
        generate_js(all_players, str(output_path))
    else:
        print("❌ No player data fetched")

if __name__ == '__main__':
    main()

