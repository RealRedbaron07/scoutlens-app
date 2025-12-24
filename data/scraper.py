#!/usr/bin/env python3
"""
ScoutLens Data Pipeline
Pulls player data from Understat (xG/xA) and FBref for lower leagues.

Usage:
    python scraper.py                    # Fetch all leagues
    python scraper.py --league EPL       # Fetch specific league
    python scraper.py --tier 2           # Fetch second-tier leagues only
    python scraper.py --output json      # Output as JSON
"""

import asyncio
import aiohttp
import json
import csv
import argparse
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

# ============================================
# LEAGUE CONFIGURATION
# ============================================

# Tier 1: Big 5 leagues (Understat coverage)
TIER1_LEAGUES = {
    'EPL': {'understat': 'EPL', 'name': 'Premier League', 'country': 'England', 'multiplier': 2.0},
    'La_Liga': {'understat': 'La_liga', 'name': 'La Liga', 'country': 'Spain', 'multiplier': 1.4},
    'Bundesliga': {'understat': 'Bundesliga', 'name': 'Bundesliga', 'country': 'Germany', 'multiplier': 1.3},
    'Serie_A': {'understat': 'Serie_A', 'name': 'Serie A', 'country': 'Italy', 'multiplier': 1.2},
    'Ligue_1': {'understat': 'Ligue_1', 'name': 'Ligue 1', 'country': 'France', 'multiplier': 1.1},
}

# Tier 2: Major secondary leagues (FBref coverage)
TIER2_LEAGUES = {
    'Eredivisie': {'fbref': 'Eredivisie', 'name': 'Eredivisie', 'country': 'Netherlands', 'multiplier': 0.7},
    'Liga_Portugal': {'fbref': 'Primeira-Liga', 'name': 'Liga Portugal', 'country': 'Portugal', 'multiplier': 0.65},
    'Belgian_Pro': {'fbref': 'Belgian-Pro-League', 'name': 'Belgian Pro League', 'country': 'Belgium', 'multiplier': 0.55},
    'Scottish_Prem': {'fbref': 'Scottish-Premiership', 'name': 'Scottish Premiership', 'country': 'Scotland', 'multiplier': 0.5},
    'Austrian_BL': {'fbref': 'Austrian-Bundesliga', 'name': 'Austrian Bundesliga', 'country': 'Austria', 'multiplier': 0.45},
    'Swiss_SL': {'fbref': 'Swiss-Super-League', 'name': 'Swiss Super League', 'country': 'Switzerland', 'multiplier': 0.45},
}

# Tier 3: Second divisions & smaller leagues
TIER3_LEAGUES = {
    'Championship': {'fbref': 'Championship', 'name': 'Championship', 'country': 'England', 'multiplier': 0.6},
    'La_Liga_2': {'fbref': 'Segunda-Division', 'name': 'La Liga 2', 'country': 'Spain', 'multiplier': 0.4},
    'Bundesliga_2': {'fbref': '2-Bundesliga', 'name': '2. Bundesliga', 'country': 'Germany', 'multiplier': 0.45},
    'Serie_B': {'fbref': 'Serie-B', 'name': 'Serie B', 'country': 'Italy', 'multiplier': 0.35},
    'Ligue_2': {'fbref': 'Ligue-2', 'name': 'Ligue 2', 'country': 'France', 'multiplier': 0.35},
    'MLS': {'fbref': 'Major-League-Soccer', 'name': 'MLS', 'country': 'USA', 'multiplier': 0.4},
    'Brazilian_Serie_A': {'fbref': 'Serie-A', 'name': 'Brasileirão', 'country': 'Brazil', 'multiplier': 0.5},
    'Argentine_Primera': {'fbref': 'Primera-Division', 'name': 'Liga Profesional', 'country': 'Argentina', 'multiplier': 0.45},
}

# Tier 4: Emerging markets
TIER4_LEAGUES = {
    'J1_League': {'fbref': 'J1-League', 'name': 'J1 League', 'country': 'Japan', 'multiplier': 0.35},
    'K_League_1': {'fbref': 'K-League-1', 'name': 'K League 1', 'country': 'South Korea', 'multiplier': 0.3},
    'Saudi_Pro': {'fbref': 'Saudi-Pro-League', 'name': 'Saudi Pro League', 'country': 'Saudi Arabia', 'multiplier': 0.4},
    'Turkish_Super': {'fbref': 'Super-Lig', 'name': 'Süper Lig', 'country': 'Turkey', 'multiplier': 0.45},
    'Greek_Super': {'fbref': 'Super-League-Greece', 'name': 'Super League', 'country': 'Greece', 'multiplier': 0.35},
    'Czech_First': {'fbref': 'Czech-First-League', 'name': 'Czech First League', 'country': 'Czechia', 'multiplier': 0.3},
    'Danish_Super': {'fbref': 'Danish-Superliga', 'name': 'Superliga', 'country': 'Denmark', 'multiplier': 0.35},
    'Norwegian_Elit': {'fbref': 'Eliteserien', 'name': 'Eliteserien', 'country': 'Norway', 'multiplier': 0.35},
    'Swedish_Allsv': {'fbref': 'Allsvenskan', 'name': 'Allsvenskan', 'country': 'Sweden', 'multiplier': 0.35},
    'Croatian_HNL': {'fbref': 'Hrvatska-NL', 'name': 'HNL', 'country': 'Croatia', 'multiplier': 0.3},
    'Serbian_Super': {'fbref': 'Serbian-SuperLiga', 'name': 'SuperLiga', 'country': 'Serbia', 'multiplier': 0.3},
    'Ukrainian_Prem': {'fbref': 'Ukrainian-Premier-League', 'name': 'UPL', 'country': 'Ukraine', 'multiplier': 0.35},
}

# Position base values (in millions EUR)
POSITION_BASE_VALUES = {
    'FW': 25, 'F': 25,
    'MF': 20, 'M': 20,
    'DF': 15, 'D': 15,
    'GK': 8,
}

# Age curve multipliers
def get_age_multiplier(age: int) -> float:
    if age <= 20: return 1.4
    if age <= 22: return 1.35
    if age <= 24: return 1.3
    if age <= 26: return 1.15
    if age <= 28: return 1.0
    if age <= 30: return 0.8
    if age <= 32: return 0.6
    return 0.4


class UnderstatScraper:
    """Scrapes player data from Understat (Big 5 leagues only)"""
    
    BASE_URL = "https://understat.com"
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        )
        return self
    
    async def __aexit__(self, *args):
        await self.session.close()
    
    async def get_league_players(self, league_key: str, season: str = "2024") -> list:
        """Fetch all players from a league"""
        league_info = TIER1_LEAGUES.get(league_key, {})
        league_id = league_info.get('understat', league_key)
        
        url = f"{self.BASE_URL}/league/{league_id}/{season}"
        
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    print(f"  ⚠️ Failed to fetch {league_key}: HTTP {response.status}")
                    return []
                html = await response.text()
        except Exception as e:
            print(f"  ⚠️ Error fetching {league_key}: {e}")
            return []
        
        # Try multiple patterns - Understat changes their format occasionally
        patterns = [
            r"var\s+playersData\s*=\s*JSON\.parse\('(.+?)'\)",
            r"playersData\s*=\s*JSON\.parse\('(.+?)'\)",
            r"var playersData\s*=\s*JSON\.parse\('(.+?)'\)",
            r"'playersData'\s*:\s*JSON\.parse\('(.+?)'\)",
        ]
        
        json_str = None
        for pattern in patterns:
            match = re.search(pattern, html, re.DOTALL)
            if match:
                json_str = match.group(1)
                break
        
        if not json_str:
            # Debug: save a snippet to see what we're dealing with
            if 'playersData' in html:
                idx = html.find('playersData')
                snippet = html[max(0, idx-50):idx+200]
                print(f"  ⚠️ Found 'playersData' but couldn't parse. Snippet:")
                print(f"      {snippet[:150]}...")
            else:
                print(f"  ⚠️ 'playersData' not found in page for {league_key}")
            return []
        
        try:
            # Decode the escaped JSON
            json_str = json_str.encode().decode('unicode_escape')
            players = json.loads(json_str)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"  ⚠️ JSON decode error for {league_key}: {e}")
            return []
        
        # Add league info to each player
        for p in players:
            p['_league_key'] = league_key
            p['_league_name'] = league_info.get('name', league_key)
            p['_league_multiplier'] = league_info.get('multiplier', 1.0)
            p['_source'] = 'understat'
        
        return players


class FBrefScraper:
    """Scrapes player data from FBref (all leagues)"""
    
    BASE_URL = "https://fbref.com/en/comps"
    
    # FBref competition IDs
    COMP_IDS = {
        # Tier 2
        'Eredivisie': '23',
        'Primeira-Liga': '32',
        'Belgian-Pro-League': '37',
        'Scottish-Premiership': '40',
        'Austrian-Bundesliga': '56',
        'Swiss-Super-League': '57',
        # Tier 3
        'Championship': '10',
        'Segunda-Division': '17',
        '2-Bundesliga': '33',
        'Serie-B': '18',
        'Ligue-2': '60',
        'Major-League-Soccer': '22',
        # Brazil/Argentina need different handling
        # Tier 4
        'J1-League': '25',
        'K-League-1': '55',
        'Saudi-Pro-League': '70',
        'Super-Lig': '26',
        'Super-League-Greece': '27',
        'Czech-First-League': '66',
        'Danish-Superliga': '50',
        'Eliteserien': '28',
        'Allsvenskan': '29',
        'Hrvatska-NL': '63',
        'Serbian-SuperLiga': '54',
        'Ukrainian-Premier-League': '39',
    }
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        )
        return self
    
    async def __aexit__(self, *args):
        await self.session.close()
    
    async def get_league_players(self, league_key: str, league_info: dict, season: str = "2024-2025") -> list:
        """Fetch player stats from FBref"""
        fbref_name = league_info.get('fbref', '')
        comp_id = self.COMP_IDS.get(fbref_name)
        
        if not comp_id:
            print(f"  ⚠️ No FBref ID for {league_key}")
            return []
        
        # FBref standard stats page
        url = f"{self.BASE_URL}/{comp_id}/stats/{fbref_name}-Stats"
        
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    print(f"  ⚠️ Failed to fetch {league_key}: HTTP {response.status}")
                    return []
                html = await response.text()
        except Exception as e:
            print(f"  ⚠️ Error fetching {league_key}: {e}")
            return []
        
        # Parse the HTML table (simplified - would need BeautifulSoup for production)
        # For now, return empty and note that FBref needs HTML parsing
        print(f"  ℹ️ FBref parsing requires BeautifulSoup - install with: pip install beautifulsoup4")
        return []


class UndervaluationModel:
    """Calculates player undervaluation scores"""
    
    @staticmethod
    def calculate_fair_value(player: dict) -> float:
        """Calculate fair market value based on performance metrics."""
        
        # Get position base value
        position = player.get('position', 'M')
        if isinstance(position, str):
            pos_key = position[0].upper() if position else 'M'
        else:
            pos_key = 'M'
        base_value = POSITION_BASE_VALUES.get(pos_key, 20)
        
        # Calculate performance metrics
        minutes = float(player.get('time', player.get('minutes', 0))) or 1
        xg = float(player.get('xG', player.get('xg', 0)))
        xa = float(player.get('xA', player.get('xa', 0)))
        
        # xG + xA per 90 minutes
        minutes_per_90 = minutes / 90
        xgi_per_90 = (xg + xa) / max(minutes_per_90, 1)
        
        # Performance ratio vs position average
        position_avg_xgi = {'F': 0.55, 'M': 0.35, 'D': 0.15, 'GK': 0.02}
        avg_xgi = position_avg_xgi.get(pos_key, 0.30)
        performance_ratio = xgi_per_90 / avg_xgi if avg_xgi > 0 else 1.0
        performance_ratio = max(0.5, min(performance_ratio, 3.0))
        
        # Age factor
        age = int(player.get('age', 25))
        age_mult = get_age_multiplier(age)
        
        # League multiplier
        league_mult = player.get('_league_multiplier', 1.0)
        
        # Calculate fair value
        fair_value = base_value * performance_ratio * age_mult * league_mult
        
        return round(max(fair_value, 0.5), 1)
    
    @staticmethod
    def calculate_metrics(player: dict) -> dict:
        """Calculate advanced metrics for a player"""
        minutes = float(player.get('time', player.get('minutes', 0))) or 1
        minutes_per_90 = minutes / 90
        
        xg = float(player.get('xG', player.get('xg', 0)))
        xa = float(player.get('xA', player.get('xa', 0)))
        goals = int(player.get('goals', 0))
        assists = int(player.get('assists', 0))
        
        return {
            'xg_per_90': round(xg / max(minutes_per_90, 1), 3),
            'xa_per_90': round(xa / max(minutes_per_90, 1), 3),
            'xgi_per_90': round((xg + xa) / max(minutes_per_90, 1), 3),
            'goals_per_90': round(goals / max(minutes_per_90, 1), 3),
            'overperformance': round(goals - xg, 2),
            'minutes_played': int(minutes),
            'games': int(player.get('games', player.get('appearances', 0)))
        }


def estimate_market_value(player: dict) -> float:
    """Rough market value estimate. In production, scrape Transfermarkt."""
    goals = int(player.get('goals', 0))
    assists = int(player.get('assists', 0))
    minutes = float(player.get('time', player.get('minutes', 0)))
    age = int(player.get('age', 25))
    
    if minutes < 450:
        return 2.0
    
    # Base estimation
    contribution = goals + (assists * 0.7)
    per_90_contrib = contribution / (minutes / 90)
    league_mult = player.get('_league_multiplier', 1.0)
    age_mult = get_age_multiplier(age)
    
    # Rough estimate
    estimated = 3 + (per_90_contrib * 25 * league_mult * age_mult)
    
    return round(max(1.0, min(estimated, 150.0)), 1)


def process_players(raw_data: dict, min_minutes: int = 450) -> list:
    """Process raw player data into undervaluation scores"""
    model = UndervaluationModel()
    processed = []
    
    for league, players in raw_data.items():
        for player in players:
            minutes = float(player.get('time', player.get('minutes', 0)))
            if minutes < min_minutes:
                continue
            
            metrics = model.calculate_metrics(player)
            fair_value = model.calculate_fair_value(player)
            market_value = estimate_market_value(player)
            
            undervaluation = fair_value - market_value
            undervaluation_pct = (undervaluation / market_value * 100) if market_value > 0 else 0
            
            processed.append({
                'id': len(processed) + 1,
                'name': player.get('player_name', player.get('name', 'Unknown')),
                'team': player.get('team_title', player.get('team', 'Unknown')),
                'league': player.get('_league_name', league.replace('_', ' ')),
                'country': player.get('_country', ''),
                'position': player.get('position', 'Unknown'),
                'age': int(player.get('age', 25)),
                'nationality': player.get('nationality', ''),
                'fair_value_eur_m': fair_value,
                'market_value_eur_m': market_value,
                'undervaluation_eur_m': round(undervaluation, 1),
                'undervaluation_pct': round(undervaluation_pct, 1),
                **metrics,
                'goals': int(player.get('goals', 0)),
                'assists': int(player.get('assists', 0)),
                'xG': round(float(player.get('xG', player.get('xg', 0))), 2),
                'xA': round(float(player.get('xA', player.get('xa', 0))), 2),
            })
    
    # Sort by undervaluation percentage
    processed.sort(key=lambda x: x['undervaluation_pct'], reverse=True)
    
    return processed


def export_csv(data: list, filepath: str):
    """Export data to CSV"""
    if not data:
        return
    
    keys = data[0].keys()
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)
    
    print(f"📄 Exported {len(data)} players to {filepath}")


def export_json(data: list, filepath: str):
    """Export data to JSON"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"📄 Exported {len(data)} players to {filepath}")


def generate_js_data(data: list, filepath: str):
    """Generate JavaScript file with player data for the app"""
    
    # Top undervalued (positive undervaluation %)
    top_undervalued = [p for p in data if p['undervaluation_pct'] > 0][:30]
    
    # Top performers by xGI/90
    top_performers = sorted(data, key=lambda x: x['xgi_per_90'], reverse=True)[:15]
    
    # Rising stars (under 23, good xGI)
    rising = sorted(
        [p for p in data if p.get('age', 30) <= 23 and p['xgi_per_90'] > 0.25],
        key=lambda x: x['xgi_per_90'],
        reverse=True
    )[:15]
    
    # Hidden gems (lower leagues, high undervaluation)
    lower_league_mults = [0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3]
    hidden_gems = [p for p in data if p['undervaluation_pct'] > 30][:20]
    
    js_content = f"""// Auto-generated player data - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Run: python scraper.py to update

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    
    // Top undervalued players
    undervalued: {json.dumps(top_undervalued, indent=4)},
    
    // Highest xGI/90 performers
    topPerformers: {json.dumps(top_performers, indent=4)},
    
    // Rising stars (U23)
    risingStars: {json.dumps(rising, indent=4)},
    
    // Hidden gems from lower leagues
    hiddenGems: {json.dumps(hidden_gems, indent=4)}
}};

if (typeof module !== 'undefined') {{
    module.exports = PLAYER_DATA;
}}
"""
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"📄 Generated JS data: {filepath}")


async def main():
    parser = argparse.ArgumentParser(description='ScoutLens Data Pipeline')
    parser.add_argument('--league', type=str, help='Specific league to fetch (e.g., EPL, Championship)')
    parser.add_argument('--tier', type=int, choices=[1, 2, 3, 4], help='Fetch specific tier only')
    parser.add_argument('--all-tiers', action='store_true', help='Fetch all tiers (takes longer)')
    parser.add_argument('--output', type=str, default='all', choices=['csv', 'json', 'js', 'all'])
    parser.add_argument('--season', type=str, default='2024', help='Season to fetch')
    parser.add_argument('--min-minutes', type=int, default=450, help='Minimum minutes played')
    args = parser.parse_args()
    
    output_dir = Path(__file__).parent
    
    print("🔭 ScoutLens Data Pipeline")
    print("=" * 50)
    
    raw_data = {}
    
    # Determine which leagues to fetch
    if args.league:
        # Single league
        all_leagues = {**TIER1_LEAGUES, **TIER2_LEAGUES, **TIER3_LEAGUES, **TIER4_LEAGUES}
        if args.league not in all_leagues:
            print(f"Unknown league: {args.league}")
            print(f"Available: {list(all_leagues.keys())}")
            return
        leagues_to_fetch = {args.league: all_leagues[args.league]}
        use_understat = args.league in TIER1_LEAGUES
    elif args.tier:
        # Specific tier
        tier_map = {1: TIER1_LEAGUES, 2: TIER2_LEAGUES, 3: TIER3_LEAGUES, 4: TIER4_LEAGUES}
        leagues_to_fetch = tier_map[args.tier]
        use_understat = args.tier == 1
    else:
        # Default: Tier 1 only (Big 5)
        leagues_to_fetch = TIER1_LEAGUES
        use_understat = True
    
    print(f"📋 Fetching {len(leagues_to_fetch)} leagues...")
    print()
    
    # Fetch from Understat (Tier 1)
    if use_understat or args.all_tiers:
        understat_leagues = {k: v for k, v in leagues_to_fetch.items() if k in TIER1_LEAGUES}
        if understat_leagues:
            print("📡 Fetching from Understat (Big 5 leagues)...")
            async with UnderstatScraper() as scraper:
                for league_key in understat_leagues:
                    print(f"  → {TIER1_LEAGUES[league_key]['name']}...")
                    players = await scraper.get_league_players(league_key, args.season)
                    if players:
                        raw_data[league_key] = players
                        print(f"    ✓ {len(players)} players")
                    await asyncio.sleep(1)  # Rate limiting
    
    # Note about FBref (Tier 2-4)
    non_understat = {k: v for k, v in leagues_to_fetch.items() if k not in TIER1_LEAGUES}
    if non_understat:
        print()
        print("ℹ️  Lower leagues require FBref scraping.")
        print("    Install: pip install beautifulsoup4 lxml")
        print("    Then enable FBref scraper in code.")
        print()
    
    if not raw_data:
        print("❌ No data fetched")
        return
    
    # Process players
    total_raw = sum(len(p) for p in raw_data.values())
    print(f"\n⚙️ Processing {total_raw} raw players...")
    
    processed = process_players(raw_data, args.min_minutes)
    
    undervalued_count = len([p for p in processed if p['undervaluation_pct'] > 20])
    print(f"✓ {len(processed)} players after filtering")
    print(f"✓ {undervalued_count} significantly undervalued (>20%)")
    
    # Export
    timestamp = datetime.now().strftime('%Y%m%d')
    
    if args.output in ['csv', 'all']:
        export_csv(processed, output_dir / f'players_{timestamp}.csv')
    
    if args.output in ['json', 'all']:
        export_json(processed, output_dir / f'players_{timestamp}.json')
    
    if args.output in ['js', 'all']:
        generate_js_data(processed, output_dir / 'player_data.js')
    
    # Print summary
    print("\n" + "=" * 50)
    print("🏆 Top 10 Most Undervalued:")
    print("-" * 50)
    
    for i, p in enumerate(processed[:10], 1):
        print(f"{i:2}. {p['name']:<25} ({p['team']})")
        print(f"    {p['league']} | Age {p.get('age', '?')} | {p['position']}")
        print(f"    Fair: €{p['fair_value_eur_m']}M | Market: €{p['market_value_eur_m']}M | Gap: +{p['undervaluation_pct']}%")
        print(f"    xGI/90: {p['xgi_per_90']} | {p['goals']}G {p['assists']}A")
        print()


if __name__ == '__main__':
    asyncio.run(main())
