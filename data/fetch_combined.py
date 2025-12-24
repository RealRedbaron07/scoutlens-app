#!/usr/bin/env python3
"""
Combined data fetcher:
- Market values from Transfermarkt API (real values)
- Season stats from Football-Data.org (goals, assists, etc.)
"""

import urllib.request
import json
import time
from datetime import datetime
import os
import sys
import argparse

# ============================================
# TRANSFERMARKT API (for market values)
# ============================================
TM_API_BASE = "https://transfermarkt-api.fly.dev"

TM_LEAGUES = {
    'GB1': {'name': 'Premier League', 'fd_code': 'PL', 'multiplier': 2.0},
    'ES1': {'name': 'La Liga', 'fd_code': 'PD', 'multiplier': 1.4},
    'L1': {'name': 'Bundesliga', 'fd_code': 'BL1', 'multiplier': 1.3},
    'IT1': {'name': 'Serie A', 'fd_code': 'SA', 'multiplier': 1.2},
    'FR1': {'name': 'Ligue 1', 'fd_code': 'FL1', 'multiplier': 1.1},
    'GB2': {'name': 'Championship', 'fd_code': 'ELC', 'multiplier': 0.6},
    'NL1': {'name': 'Eredivisie', 'fd_code': 'DED', 'multiplier': 0.7},
    'PO1': {'name': 'Primeira Liga', 'fd_code': 'PPL', 'multiplier': 0.65},
}

def fetch_json(url, headers=None):
    """Fetch JSON from URL"""
    default_headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
    }
    if headers:
        default_headers.update(headers)
    
    req = urllib.request.Request(url, headers=default_headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return None

def parse_market_value(value_str):
    """Parse market value string to millions EUR"""
    if not value_str:
        return None
    
    value_str = str(value_str).lower().replace('€', '').replace(',', '.').strip()
    
    try:
        if 'm' in value_str:
            return float(value_str.replace('m', '').strip())
        elif 'k' in value_str:
            return round(float(value_str.replace('k', '').strip()) / 1000, 2)
        elif 'bn' in value_str:
            return float(value_str.replace('bn', '').strip()) * 1000
        else:
            num = float(value_str)
            if num > 1000:
                return round(num / 1000000, 2)
            return num
    except:
        return None

def fetch_transfermarkt_values():
    """Fetch market values from Transfermarkt API"""
    print("📊 Fetching Transfermarkt market values...")
    
    tm_values = {}  # name -> {market_value, team, age, position, nationality}
    
    for tm_id, league_info in TM_LEAGUES.items():
        print(f"   {league_info['name']}...", end=" ")
        
        url = f"{TM_API_BASE}/competitions/{tm_id}/clubs"
        data = fetch_json(url)
        
        if not data or 'clubs' not in data:
            print("⚠️ failed")
            continue
        
        count = 0
        for club in data.get('clubs', [])[:10]:
            club_id = club.get('id')
            club_name = club.get('name', 'Unknown')
            
            squad_url = f"{TM_API_BASE}/clubs/{club_id}/players"
            squad_data = fetch_json(squad_url)
            
            if squad_data and 'players' in squad_data:
                for p in squad_data['players']:
                    mv = parse_market_value(p.get('marketValue'))
                    if mv and mv >= 1:
                        name = p.get('name', 'Unknown')
                        tm_values[name.lower()] = {
                            'market_value_eur_m': mv,
                            'team': club_name,
                            'league': league_info['name'],
                            'age': p.get('age', 25),
                            'position': p.get('position', 'Forward'),
                            'nationality': p.get('nationality', ''),
                        }
                        count += 1
            
            time.sleep(0.2)
        
        print(f"✓ {count}")
        time.sleep(0.5)
    
    print(f"   Total: {len(tm_values)} players with TM values")
    return tm_values

# ============================================
# FOOTBALL-DATA.ORG API (for season stats)
# ============================================

def get_age_multiplier(age):
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4

def calculate_age(dob_str):
    if not dob_str:
        return 25
    try:
        dob = datetime.strptime(dob_str, '%Y-%m-%d')
        today = datetime.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except:
        return 25

def fetch_football_data_stats(api_key):
    """Fetch season stats from Football-Data.org"""
    print("\n⚽ Fetching Football-Data.org stats...")
    
    fd_leagues = {
        'PL': 'Premier League',
        'PD': 'La Liga', 
        'BL1': 'Bundesliga',
        'SA': 'Serie A',
        'FL1': 'Ligue 1',
        'ELC': 'Championship',
        'DED': 'Eredivisie',
        'PPL': 'Primeira Liga',
    }
    
    all_stats = {}  # name -> stats
    
    for code, name in fd_leagues.items():
        print(f"   {name}...", end=" ")
        
        url = f"https://api.football-data.org/v4/competitions/{code}/scorers?limit=30"
        data = fetch_json(url, headers={'X-Auth-Token': api_key})
        
        if not data or 'scorers' not in data:
            print("⚠️ failed")
            time.sleep(1)
            continue
        
        count = 0
        for scorer in data.get('scorers', []):
            player = scorer.get('player', {})
            team = scorer.get('team', {})
            
            player_name = player.get('name', 'Unknown')
            goals = scorer.get('goals', 0) or 0
            assists = scorer.get('assists', 0) or 0
            penalties = scorer.get('penalties', 0) or 0
            played = scorer.get('playedMatches', 1) or 1
            
            # Estimate minutes
            minutes = played * 75
            
            # Estimate xG/xA
            npg = goals - penalties
            xg = npg * 0.9 + penalties * 0.76
            xa = assists * 0.85
            xgi_per_90 = (xg + xa) / max(minutes / 90, 1)
            
            all_stats[player_name.lower()] = {
                'name': player_name,
                'team': team.get('name', 'Unknown'),
                'league': name,
                'age': calculate_age(player.get('dateOfBirth')),
                'nationality': player.get('nationality', ''),
                'position': player.get('position', 'Forward')[0] if player.get('position') else 'F',
                'goals': goals,
                'assists': assists,
                'xG': round(xg, 1),
                'xA': round(xa, 1),
                'xgi_per_90': round(xgi_per_90, 2),
                'minutes_played': minutes,
                'games': played,
            }
            count += 1
        
        print(f"✓ {count}")
        time.sleep(1)  # Rate limit
    
    print(f"   Total: {len(all_stats)} players with stats")
    return all_stats

# ============================================
# MERGE AND GENERATE
# ============================================

def merge_data(tm_values, fd_stats):
    """Merge Transfermarkt values with Football-Data stats"""
    print("\n🔄 Merging data...")
    
    merged = []
    matched = 0
    
    # Start with players who have stats (they're the ones scoring/assisting)
    for name_lower, stats in fd_stats.items():
        player = stats.copy()
        
        # Try to find TM value
        tm_data = tm_values.get(name_lower)
        
        # Also try partial matching
        if not tm_data:
            for tm_name, tm_info in tm_values.items():
                # Match by last name
                if name_lower.split()[-1] == tm_name.split()[-1]:
                    tm_data = tm_info
                    break
        
        if tm_data:
            player['market_value_eur_m'] = tm_data['market_value_eur_m']
            matched += 1
        else:
            # Estimate market value from stats
            gi_per_game = (player['goals'] + player['assists']) / max(player['games'], 1)
            base = 10 + (gi_per_game * 30)
            player['market_value_eur_m'] = round(min(base * get_age_multiplier(player['age']), 80), 1)
        
        # Calculate fair value based on performance
        gi_per_game = (player['goals'] + player['assists']) / max(player['games'], 1)
        
        if gi_per_game >= 1.3:
            fair_base = 100
        elif gi_per_game >= 1.0:
            fair_base = 70
        elif gi_per_game >= 0.8:
            fair_base = 50
        elif gi_per_game >= 0.6:
            fair_base = 35
        elif gi_per_game >= 0.45:
            fair_base = 22
        else:
            fair_base = 12
        
        league_mult = {'Premier League': 2.0, 'La Liga': 1.4, 'Bundesliga': 1.3, 
                       'Serie A': 1.2, 'Ligue 1': 1.1, 'Championship': 0.6,
                       'Eredivisie': 0.7, 'Primeira Liga': 0.65}.get(player['league'], 1.0)
        
        player['fair_value_eur_m'] = round(
            min(fair_base * get_age_multiplier(player['age']) * league_mult, 200), 1
        )
        
        # Undervaluation
        mv = player['market_value_eur_m']
        fv = player['fair_value_eur_m']
        player['undervaluation_pct'] = round(((fv - mv) / mv * 100) if mv > 0 else 0, 1)
        
        merged.append(player)
    
    # Add high-value TM players who might not be top scorers
    for name_lower, tm_data in tm_values.items():
        if name_lower not in fd_stats and tm_data['market_value_eur_m'] >= 50:
            player = {
                'name': name_lower.title(),
                'team': tm_data['team'],
                'league': tm_data['league'],
                'age': tm_data['age'],
                'nationality': tm_data.get('nationality', ''),
                'position': tm_data.get('position', 'F')[0] if tm_data.get('position') else 'F',
                'market_value_eur_m': tm_data['market_value_eur_m'],
                'fair_value_eur_m': tm_data['market_value_eur_m'],  # Assume fairly valued
                'undervaluation_pct': 0,
                'goals': 0,
                'assists': 0,
                'xG': 0,
                'xA': 0,
                'xgi_per_90': 0,
                'minutes_played': 0,
                'games': 0,
            }
            merged.append(player)
    
    print(f"   Matched TM values: {matched}/{len(fd_stats)}")
    print(f"   Total merged: {len(merged)}")
    
    return merged

def generate_js(players, output_path):
    """Generate player_data.js"""
    
    # Add IDs
    for i, p in enumerate(players):
        p['id'] = i + 1
    
    # Categorize
    lower_leagues = ['Championship', 'Eredivisie', 'Primeira Liga']
    
    undervalued = sorted(
        [p for p in players if p.get('undervaluation_pct', 0) > 15 and p.get('goals', 0) > 0],
        key=lambda x: x['undervaluation_pct'],
        reverse=True
    )[:20]
    
    top_performers = sorted(
        [p for p in players if p.get('xgi_per_90', 0) > 0],
        key=lambda x: x['xgi_per_90'],
        reverse=True
    )[:15]
    
    rising = sorted(
        [p for p in players if p.get('age', 30) <= 23 and p.get('goals', 0) > 0],
        key=lambda x: x['xgi_per_90'],
        reverse=True
    )[:15]
    
    hidden_gems = sorted(
        [p for p in players if p['league'] in lower_leagues and p.get('goals', 0) > 0],
        key=lambda x: x['xgi_per_90'],
        reverse=True
    )[:20]
    
    js_content = f"""// Auto-generated - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Sources: Transfermarkt (values) + Football-Data.org (stats)
// Run: python3 fetch_combined.py --api-key YOUR_KEY

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "Transfermarkt + Football-Data.org",
    season: "2024-25",
    updateFrequency: "daily",
    totalPlayers: {len(players)},
    leaguesCovered: 8,
    
    undervalued: {json.dumps(undervalued, indent=8)},
    
    topPerformers: {json.dumps(top_performers, indent=8)},
    
    risingStars: {json.dumps(rising, indent=8)},
    
    hiddenGems: {json.dumps(hidden_gems, indent=8)}
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
    print(f"   💎 {len(hidden_gems)} hidden gems")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-key', help='Football-Data.org API key')
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('FOOTBALL_DATA_KEY')
    
    if not api_key:
        print("❌ Need Football-Data.org API key")
        print("   Usage: python3 fetch_combined.py --api-key YOUR_KEY")
        sys.exit(1)
    
    print("🔭 ScoutLens - Combined Data Fetcher")
    print("=" * 50)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    
    # 1. Get TM values
    tm_values = fetch_transfermarkt_values()
    
    # 2. Get FD stats
    fd_stats = fetch_football_data_stats(api_key)
    
    # 3. Merge
    players = merge_data(tm_values, fd_stats)
    
    # 4. Generate JS
    output_path = os.path.join(os.path.dirname(__file__), 'player_data.js')
    generate_js(players, output_path)
    
    print(f"\n📈 Total: {len(players)} players")
    
    # Sample
    print("\n📋 Sample (with stats + values):")
    for p in sorted(players, key=lambda x: x.get('xgi_per_90', 0), reverse=True)[:5]:
        print(f"   {p['name']}: €{p['market_value_eur_m']}M | {p['goals']}G {p['assists']}A | xGI/90: {p['xgi_per_90']}")

if __name__ == '__main__':
    main()

