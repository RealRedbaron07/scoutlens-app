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
import unicodedata
import re

def normalize_name(name):
    """Normalize name for matching (remove accents, lowercase)"""
    if not name:
        return ""
    # Remove accents
    normalized = unicodedata.normalize('NFD', name)
    normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    # Lowercase and remove extra spaces
    normalized = normalized.lower().strip()
    # Remove common prefixes/suffixes
    normalized = re.sub(r'\s+(jr|sr|ii|iii)\.?$', '', normalized)
    return normalized

def names_match(name1, name2):
    """Check if two names match (fuzzy)"""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    
    # Exact match
    if n1 == n2:
        return True
    
    # One contains the other
    if n1 in n2 or n2 in n1:
        return True
    
    # Last name match
    parts1 = n1.split()
    parts2 = n2.split()
    if parts1 and parts2:
        if parts1[-1] == parts2[-1]:  # Same last name
            # Check if first initial matches
            if parts1[0][0] == parts2[0][0]:
                return True
    
    return False

# ============================================
# KNOWN VALUES FALLBACK (for players with matching issues)
# ============================================
KNOWN_VALUES = {
    # La Liga
    'julian alvarez': 90, 'julian alvarez': 90, 'alvarez': 90,
    'robert lewandowski': 15, 'lewandowski': 15,
    'raphinha': 70, 'vinicius junior': 150, 'vinicius jr': 150,
    'kylian mbappe': 200, 'mbappe': 200,
    'jude bellingham': 160, 'bellingham': 160,
    'lamine yamal': 200, 'antoine griezmann': 30,
    'alexander sorloth': 30, 'ayoze perez': 15,
    
    # Premier League  
    'erling haaland': 200, 'haaland': 200,
    'mohamed salah': 80, 'salah': 80,
    'cole palmer': 110, 'palmer': 110,
    'bukayo saka': 140, 'saka': 140,
    'phil foden': 150, 'foden': 150,
    'alexander isak': 100, 'isak': 100,
    'bruno fernandes': 70, 'son heung-min': 60, 'son': 60,
    'ollie watkins': 65, 'watkins': 65,
    'nicolas jackson': 55, 'chris wood': 8,
    'bryan mbeumo': 50, 'mbeumo': 50,
    'matheus cunha': 55, 'cunha': 55,
    'morgan rogers': 30, 'antoine semenyo': 28,
    'dominic solanke': 55, 'cody gakpo': 65,
    'darwin nunez': 70, 'jhon duran': 40,
    'yoane wissa': 32,
    
    # Bundesliga
    'harry kane': 100, 'kane': 100,
    'jamal musiala': 130, 'musiala': 130,
    'florian wirtz': 150, 'wirtz': 150,
    'michael olise': 60, 'olise': 60,
    'omar marmoush': 55, 'marmoush': 55,
    'lois openda': 65, 'openda': 65,
    'serge gnabry': 50, 'leroy sane': 60, 'sane': 60,
    
    # Serie A
    'lautaro martinez': 110, 'lautaro': 110,
    'marcus thuram': 70, 'thuram': 70,
    'dusan vlahovic': 65, 'vlahovic': 65,
    'rafael leao': 80, 'leao': 80,
    'khvicha kvaratskhelia': 85, 'kvaratskhelia': 85,
    'ademola lookman': 55, 'lookman': 55,
    'mateo retegui': 35, 'moise kean': 40,
    
    # Ligue 1
    'bradley barcola': 70, 'barcola': 70,
    'ousmane dembele': 60, 'dembele': 60,
    'mason greenwood': 40, 'greenwood': 40,
    'jonathan david': 55,
    
    # Portuguese League
    'viktor gyokeres': 75, 'gyokeres': 75,
    'vangelis pavlidis': 35, 'pavlidis': 35,
    
    # Championship
    'rodrigo muniz': 12, 'sammie szmodics': 10,
    'josh sargent': 15, 'carlton morris': 8,
    
    # Additional unmatched players
    'jean-philippe mateta': 35, 'mateta': 35,
    'dominic calvert-lewin': 25, 'calvert-lewin': 25,
    'jarrod bowen': 45, 'bowen': 45,
    'harry wilson': 12,
    'wilson isidor': 8,
    'lukas nmecha': 12, 'nmecha': 12,
    'marcus tavernier': 15, 'tavernier': 15,
    'jaidon anthony': 10,
    'ayase ueda': 15, 'ueda': 15,
    'troy parrott': 8, 'parrott': 8,
}

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
    unmatched_names = []
    
    # Start with players who have stats (they're the ones scoring/assisting)
    for name_key, stats in fd_stats.items():
        player = stats.copy()
        original_name = stats.get('name', name_key)
        
        # Try to find TM value with fuzzy matching
        tm_data = None
        best_match = None
        
        for tm_name, tm_info in tm_values.items():
            if names_match(original_name, tm_name) or names_match(original_name, tm_info.get('team', '')):
                # Additional check: same team or league
                if (tm_info.get('league') == stats.get('league') or 
                    normalize_name(tm_info.get('team', '')) in normalize_name(stats.get('team', '')) or
                    normalize_name(stats.get('team', '')) in normalize_name(tm_info.get('team', ''))):
                    tm_data = tm_info
                    best_match = tm_name
                    break
            
            # Try matching by name alone
            if names_match(original_name, tm_name):
                if not tm_data or tm_info['market_value_eur_m'] > tm_data.get('market_value_eur_m', 0):
                    tm_data = tm_info
                    best_match = tm_name
        
        if tm_data:
            player['market_value_eur_m'] = tm_data['market_value_eur_m']
            player['tm_verified'] = True
            matched += 1
        else:
            # Check known values fallback (try multiple name variations)
            name_lower = normalize_name(original_name)
            known_value = KNOWN_VALUES.get(name_lower)
            
            # Try last name only
            if not known_value:
                last_name = name_lower.split()[-1] if name_lower.split() else name_lower
                known_value = KNOWN_VALUES.get(last_name)
            
            if known_value:
                player['market_value_eur_m'] = known_value
                player['tm_verified'] = True
                matched += 1
            else:
                unmatched_names.append(original_name)
                # Estimate market value from stats - be conservative
                gi_per_game = (player['goals'] + player['assists']) / max(player['games'], 1)
                base = 8 + (gi_per_game * 25)
                player['market_value_eur_m'] = round(min(base * get_age_multiplier(player['age']), 60), 1)
                player['tm_verified'] = False  # Mark as estimated
        
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
    
    if unmatched_names[:10]:
        print(f"   ⚠️  Unmatched (first 10): {unmatched_names[:10]}")
    
    return merged

def generate_js(players, output_path):
    """Generate player_data.js"""
    
    # Add IDs
    for i, p in enumerate(players):
        p['id'] = i + 1
    
    # Categorize
    lower_leagues = ['Championship', 'Eredivisie', 'Primeira Liga']
    
    # Only show undervalued if we have verified TM value AND meaningful undervaluation
    undervalued = sorted(
        [p for p in players if 
            p.get('tm_verified', False) and  # Must have real TM value
            p.get('undervaluation_pct', 0) > 20 and  # Meaningful gap
            p.get('undervaluation_pct', 0) < 200 and  # Not absurdly high (data error)
            p.get('goals', 0) >= 3],  # Has actual output
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

