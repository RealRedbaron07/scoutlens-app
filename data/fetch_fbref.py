#!/usr/bin/env python3
"""
ScoutLens - FBref Data Fetcher
Free, current-season xG/xA data from fbref.com

Usage:
    pip3 install requests beautifulsoup4 pandas lxml
    python3 fetch_fbref.py
"""

import json
import time
import re
from datetime import datetime
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("❌ Missing dependencies! Install with:")
    print("   pip3 install requests beautifulsoup4 pandas lxml")
    exit(1)

# League configurations
LEAGUES = {
    'Premier League': {
        'url': 'https://fbref.com/en/comps/9/stats/Premier-League-Stats',
        'country': 'England',
        'multiplier': 2.0
    },
    'La Liga': {
        'url': 'https://fbref.com/en/comps/12/stats/La-Liga-Stats',
        'country': 'Spain',
        'multiplier': 1.4
    },
    'Bundesliga': {
        'url': 'https://fbref.com/en/comps/20/stats/Bundesliga-Stats',
        'country': 'Germany',
        'multiplier': 1.3
    },
    'Serie A': {
        'url': 'https://fbref.com/en/comps/11/stats/Serie-A-Stats',
        'country': 'Italy',
        'multiplier': 1.2
    },
    'Ligue 1': {
        'url': 'https://fbref.com/en/comps/13/stats/Ligue-1-Stats',
        'country': 'France',
        'multiplier': 1.1
    },
}

# Position base values (millions EUR)
POSITION_BASE = {'FW': 25, 'MF': 20, 'DF': 15, 'GK': 8}

def get_age_multiplier(age: int) -> float:
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4

def estimate_market_value(goals: int, assists: int, minutes: int, age: int, league_mult: float, position: str) -> float:
    """Estimate market value based on output"""
    if minutes < 400:
        return 2.0
    
    contrib = goals + (assists * 0.7)
    per_90 = contrib / (minutes / 90)
    base = POSITION_BASE.get(position, 20)
    
    value = base * 0.3 + (per_90 * 20 * league_mult * get_age_multiplier(age))
    return round(max(1.0, min(value, 180.0)), 1)

def fetch_league_stats(league_name: str, league_info: dict) -> list:
    """Fetch player stats from FBref"""
    url = league_info['url']
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"  ⚠️ Error fetching {league_name}: {e}")
        return []
    
    soup = BeautifulSoup(response.text, 'lxml')
    
    # Find the standard stats table
    table = soup.find('table', {'id': 'stats_standard'})
    if not table:
        # Try alternate table IDs
        table = soup.find('table', {'id': re.compile(r'stats_standard')})
    
    if not table:
        print(f"  ⚠️ Could not find stats table for {league_name}")
        return []
    
    players = []
    tbody = table.find('tbody')
    if not tbody:
        return []
    
    for row in tbody.find_all('tr'):
        # Skip header rows
        if row.get('class') and 'thead' in row.get('class', []):
            continue
        
        cells = row.find_all(['td', 'th'])
        if len(cells) < 10:
            continue
        
        try:
            # Extract player data
            player_cell = row.find('td', {'data-stat': 'player'})
            if not player_cell:
                continue
            
            name = player_cell.get_text(strip=True)
            if not name or name == 'Player':
                continue
            
            # Get nationality
            nation_cell = row.find('td', {'data-stat': 'nationality'})
            nationality = nation_cell.get_text(strip=True) if nation_cell else ''
            # Clean up nationality (sometimes has flag codes)
            nationality = nationality.split()[-1] if nationality else ''
            
            # Get position
            pos_cell = row.find('td', {'data-stat': 'position'})
            position = pos_cell.get_text(strip=True) if pos_cell else 'MF'
            position = position.split(',')[0] if position else 'MF'  # Take first position if multiple
            
            # Get team
            team_cell = row.find('td', {'data-stat': 'team'})
            team = team_cell.get_text(strip=True) if team_cell else 'Unknown'
            
            # Get age
            age_cell = row.find('td', {'data-stat': 'age'})
            age_text = age_cell.get_text(strip=True) if age_cell else '25'
            age = int(age_text.split('-')[0]) if age_text else 25
            
            # Get games
            games_cell = row.find('td', {'data-stat': 'games'})
            games = int(games_cell.get_text(strip=True) or 0) if games_cell else 0
            
            # Get minutes
            minutes_cell = row.find('td', {'data-stat': 'minutes'})
            minutes_text = minutes_cell.get_text(strip=True).replace(',', '') if minutes_cell else '0'
            minutes = int(minutes_text) if minutes_text else 0
            
            # Get goals
            goals_cell = row.find('td', {'data-stat': 'goals'})
            goals = int(goals_cell.get_text(strip=True) or 0) if goals_cell else 0
            
            # Get assists
            assists_cell = row.find('td', {'data-stat': 'assists'})
            assists = int(assists_cell.get_text(strip=True) or 0) if assists_cell else 0
            
            # Get xG (expected goals)
            xg_cell = row.find('td', {'data-stat': 'xg'})
            xg = float(xg_cell.get_text(strip=True) or 0) if xg_cell else goals * 0.85
            
            # Get xAG (expected assists)
            xag_cell = row.find('td', {'data-stat': 'xg_assist'})
            xa = float(xag_cell.get_text(strip=True) or 0) if xag_cell else assists * 0.9
            
            # Skip players with minimal minutes
            if minutes < 400:
                continue
            
            # Calculate metrics
            minutes_per_90 = max(minutes / 90, 1)
            xgi_per_90 = (xg + xa) / minutes_per_90
            
            # Calculate fair value
            pos_short = position[:2] if len(position) >= 2 else 'MF'
            base_value = POSITION_BASE.get(pos_short, 20)
            pos_avg_xgi = {'FW': 0.55, 'MF': 0.35, 'DF': 0.15, 'GK': 0.02}.get(pos_short, 0.35)
            
            perf_ratio = min(max(xgi_per_90 / pos_avg_xgi, 0.5), 3.5) if pos_avg_xgi > 0 else 1.0
            fair_value = base_value * perf_ratio * get_age_multiplier(age) * league_info['multiplier']
            
            market_value = estimate_market_value(goals, assists, minutes, age, league_info['multiplier'], pos_short)
            underval_pct = ((fair_value - market_value) / market_value * 100) if market_value > 0 else 0
            
            players.append({
                'name': name,
                'team': team,
                'league': league_name,
                'position': pos_short[0] if pos_short else 'M',
                'age': age,
                'nationality': nationality,
                'fair_value_eur_m': round(fair_value, 1),
                'market_value_eur_m': round(market_value, 1),
                'undervaluation_pct': round(underval_pct, 1),
                'xgi_per_90': round(xgi_per_90, 2),
                'goals': goals,
                'assists': assists,
                'xG': round(xg, 1),
                'xA': round(xa, 1),
                'minutes_played': minutes,
                'games': games
            })
            
        except (ValueError, AttributeError) as e:
            continue
    
    return players

def generate_js(all_players: list, output_path: str):
    """Generate player_data.js file"""
    
    # Assign IDs
    for i, p in enumerate(all_players):
        p['id'] = i + 1
    
    # Top undervalued (positive undervaluation, sorted by %)
    undervalued = sorted(
        [p for p in all_players if p['undervaluation_pct'] > 25 and p['minutes_played'] >= 600],
        key=lambda x: x['undervaluation_pct'], 
        reverse=True
    )[:20]
    
    # Top performers by xGI/90
    top_performers = sorted(
        [p for p in all_players if p['minutes_played'] >= 600],
        key=lambda x: x['xgi_per_90'], 
        reverse=True
    )[:15]
    
    # Rising stars (U23)
    rising = sorted(
        [p for p in all_players if p.get('age', 30) <= 23 and p['minutes_played'] >= 400],
        key=lambda x: x['xgi_per_90'], 
        reverse=True
    )[:15]
    
    js_content = f"""// Auto-generated player data - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Source: FBref (fbref.com) - Current 2024-25 Season
// Run: python3 fetch_fbref.py

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "fbref",
    season: "2024-25",
    updateFrequency: "weekly",
    
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
    print(f"   📊 {len(undervalued)} undervalued players")
    print(f"   ⚡ {len(top_performers)} top performers")  
    print(f"   🌟 {len(rising)} rising stars (U23)")

def main():
    print("🔭 ScoutLens - FBref Data Fetcher")
    print("=" * 50)
    print("📅 Fetching CURRENT 2024-25 season data (FREE!)")
    print()
    
    all_players = []
    
    for league_name, league_info in LEAGUES.items():
        print(f"📡 Fetching {league_name}...")
        players = fetch_league_stats(league_name, league_info)
        
        if players:
            all_players.extend(players)
            print(f"   ✓ {len(players)} players")
        else:
            print(f"   ⚠️ No data")
        
        # Rate limiting - be nice to FBref
        time.sleep(3)
    
    if all_players:
        output_path = Path(__file__).parent / 'player_data.js'
        generate_js(all_players, str(output_path))
        
        print(f"\n📈 Total: {len(all_players)} players from Big 5 leagues")
    else:
        print("\n❌ No player data fetched")

if __name__ == '__main__':
    main()

