#!/usr/bin/env python3
"""
Fetch REAL market values from Transfermarkt via API
Auto-updates via GitHub Actions
"""

import urllib.request
import json
import time
from datetime import datetime
import os
import sys

# Free Transfermarkt API (no key needed)
TM_API_BASE = "https://transfermarkt-api.fly.dev"

# League IDs on Transfermarkt
LEAGUES = {
    'GB1': {'name': 'Premier League', 'multiplier': 2.0},
    'ES1': {'name': 'La Liga', 'multiplier': 1.4},
    'L1': {'name': 'Bundesliga', 'multiplier': 1.3},
    'IT1': {'name': 'Serie A', 'multiplier': 1.2},
    'FR1': {'name': 'Ligue 1', 'multiplier': 1.1},
    'GB2': {'name': 'Championship', 'multiplier': 0.6},
    'NL1': {'name': 'Eredivisie', 'multiplier': 0.7},
    'PO1': {'name': 'Primeira Liga', 'multiplier': 0.65},
}

def fetch_json(url):
    """Fetch JSON from URL"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
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
            # Assume it's already a number
            num = float(value_str)
            if num > 1000:
                return round(num / 1000000, 2)
            return num
    except:
        return None

def get_age_multiplier(age):
    """Age-based value multiplier"""
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4

def fetch_league_top_scorers(league_id):
    """Fetch top scorers with market values from a league"""
    url = f"{TM_API_BASE}/competitions/{league_id}/clubs"
    data = fetch_json(url)
    
    if not data or 'clubs' not in data:
        return []
    
    players = []
    
    # For each club, get their players
    for club in data.get('clubs', [])[:10]:  # Top 10 clubs per league
        club_id = club.get('id')
        if not club_id:
            continue
            
        # Fetch club players
        players_url = f"{TM_API_BASE}/clubs/{club_id}/players"
        players_data = fetch_json(players_url)
        
        if players_data and 'players' in players_data:
            for p in players_data['players'][:15]:  # Top 15 per club
                market_value = parse_market_value(p.get('marketValue'))
                if market_value:
                    players.append({
                        'name': p.get('name', 'Unknown'),
                        'team': club.get('name', 'Unknown'),
                        'market_value_eur_m': market_value,
                        'age': p.get('age', 25),
                        'position': p.get('position', 'Forward'),
                        'nationality': p.get('nationality', ''),
                    })
        
        time.sleep(0.5)  # Rate limit
    
    return players

def fetch_all_players():
    """Fetch players from all leagues"""
    all_players = []
    
    print("🔭 Fetching REAL Transfermarkt Values")
    print("=" * 50)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()
    
    for league_id, league_info in LEAGUES.items():
        print(f"📡 Fetching {league_info['name']}...")
        
        # Try to get top scorers first
        url = f"{TM_API_BASE}/competitions/{league_id}/clubs"
        data = fetch_json(url)
        
        if data and 'clubs' in data:
            league_players = []
            
            for club in data.get('clubs', [])[:8]:  # Top 8 clubs
                club_id = club.get('id')
                club_name = club.get('name', 'Unknown')
                
                # Get club squad
                squad_url = f"{TM_API_BASE}/clubs/{club_id}/players"
                squad_data = fetch_json(squad_url)
                
                if squad_data and 'players' in squad_data:
                    for p in squad_data['players']:
                        mv = parse_market_value(p.get('marketValue'))
                        if mv and mv >= 1:  # Only players worth €1M+
                            league_players.append({
                                'name': p.get('name', 'Unknown'),
                                'team': club_name,
                                'league': league_info['name'],
                                'market_value_eur_m': mv,
                                'age': p.get('age', 25),
                                'position': p.get('position', 'Forward')[0] if p.get('position') else 'F',
                                'nationality': p.get('nationality', ''),
                            })
                
                time.sleep(0.3)  # Rate limit
            
            # Sort by market value and take top 30
            league_players.sort(key=lambda x: x['market_value_eur_m'], reverse=True)
            all_players.extend(league_players[:30])
            print(f"   ✓ {len(league_players[:30])} players")
        else:
            print(f"   ⚠️ Failed")
        
        time.sleep(1)  # Rate limit between leagues
    
    return all_players

def calculate_fair_values(players):
    """Calculate fair values based on market value + performance potential"""
    for p in players:
        mv = p['market_value_eur_m']
        age = p.get('age', 25)
        
        # Fair value = market value adjusted for age potential
        # Young players may be undervalued (more growth potential)
        age_factor = get_age_multiplier(age)
        
        # Simple fair value model
        if age <= 23:
            # Young players - fair value could be higher
            p['fair_value_eur_m'] = round(mv * 1.15, 1)
        elif age <= 27:
            # Prime years - fair value ≈ market value
            p['fair_value_eur_m'] = mv
        else:
            # Older players - fair value might be lower
            p['fair_value_eur_m'] = round(mv * 0.95, 1)
        
        # Calculate undervaluation
        p['undervaluation_pct'] = round(
            ((p['fair_value_eur_m'] - mv) / mv * 100) if mv > 0 else 0, 1
        )
    
    return players

def generate_player_data_js(players, output_path):
    """Generate player_data.js with real TM values"""
    
    # Add IDs
    for i, p in enumerate(players):
        p['id'] = i + 1
        # Add placeholder stats (will be merged with football-data.org)
        p['goals'] = p.get('goals', 0)
        p['assists'] = p.get('assists', 0)
        p['xG'] = p.get('xG', 0)
        p['xA'] = p.get('xA', 0)
        p['xgi_per_90'] = p.get('xgi_per_90', 0)
        p['minutes_played'] = p.get('minutes_played', 0)
        p['games'] = p.get('games', 0)
    
    # Categorize
    undervalued = sorted(
        [p for p in players if p.get('undervaluation_pct', 0) > 10],
        key=lambda x: x['undervaluation_pct'],
        reverse=True
    )[:20]
    
    top_value = sorted(players, key=lambda x: x['market_value_eur_m'], reverse=True)[:15]
    
    rising = sorted(
        [p for p in players if p.get('age', 30) <= 23],
        key=lambda x: x['market_value_eur_m'],
        reverse=True
    )[:15]
    
    lower_leagues = ['Championship', 'Eredivisie', 'Primeira Liga']
    hidden_gems = sorted(
        [p for p in players if p['league'] in lower_leagues],
        key=lambda x: x['market_value_eur_m'],
        reverse=True
    )[:20]
    
    js_content = f"""// Auto-generated - REAL Transfermarkt values - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: Transfermarkt via API
// Run: python3 fetch_transfermarkt.py

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "transfermarkt.com (live)",
    season: "2024-25",
    updateFrequency: "daily",
    totalPlayers: {len(players)},
    leaguesCovered: {len(LEAGUES)},
    
    undervalued: {json.dumps(undervalued, indent=8)},
    
    topPerformers: {json.dumps(top_value, indent=8)},
    
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
    print(f"   📊 {len(undervalued)} undervalued (young talents)")
    print(f"   💰 {len(top_value)} most valuable")
    print(f"   🌟 {len(rising)} rising stars (U23)")
    print(f"   💎 {len(hidden_gems)} hidden gems")
    
    return True

def main():
    print()
    
    # Fetch all players with real TM values
    players = fetch_all_players()
    
    if not players:
        print("❌ No players fetched. Using fallback...")
        sys.exit(1)
    
    # Calculate fair values
    players = calculate_fair_values(players)
    
    # Generate output
    output_path = os.path.join(os.path.dirname(__file__), 'player_data.js')
    generate_player_data_js(players, output_path)
    
    print(f"\n📈 Total: {len(players)} players with REAL Transfermarkt values")
    
    # Sample output
    print("\n📋 Sample values:")
    for p in sorted(players, key=lambda x: x['market_value_eur_m'], reverse=True)[:5]:
        print(f"   {p['name']} ({p['team']}): €{p['market_value_eur_m']}M")

if __name__ == '__main__':
    main()
