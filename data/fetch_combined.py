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
# CONTRACT EXPIRY DATES (year)
# Players with expiring contracts = BARGAINS
# ============================================
CONTRACT_EXPIRY = {
    # Expiring 2025 (FREE AGENTS SOON!)
    'mohamed salah': 2025, 'salah': 2025,
    'trent alexander-arnold': 2025, 'alexander-arnold': 2025,
    'virgil van dijk': 2025, 'van dijk': 2025,
    'joshua kimmich': 2025, 'kimmich': 2025,
    'alphonso davies': 2025, 'davies': 2025,
    'jonathan david': 2025,
    'leroy sane': 2025, 'sane': 2025,
    'jonathan tah': 2025, 'tah': 2025,
    'kevin de bruyne': 2025, 'de bruyne': 2025,
    'son heung-min': 2025, 'son': 2025,
    
    # Expiring 2026 (good value)
    'erling haaland': 2027, 'haaland': 2027,
    'kylian mbappe': 2029, 'mbappe': 2029,
    'vinicius junior': 2027, 'vinicius': 2027,
    'jude bellingham': 2029, 'bellingham': 2029,
    'bukayo saka': 2027, 'saka': 2027,
    'phil foden': 2027, 'foden': 2027,
    'cole palmer': 2033, 'palmer': 2033,
    'lamine yamal': 2030, 'yamal': 2030,
    'florian wirtz': 2027, 'wirtz': 2027,
    'jamal musiala': 2026, 'musiala': 2026,
    'pedri': 2026,
    'gavi': 2026,
    
    # Hidden gems with expiring contracts
    'viktor gyokeres': 2028, 'gyokeres': 2028,
    'omar marmoush': 2027, 'marmoush': 2027,
    'michael olise': 2028, 'olise': 2028,
    'nico williams': 2027, 'williams': 2027,
    'alejandro garnacho': 2028, 'garnacho': 2028,
    'khvicha kvaratskhelia': 2027, 'kvaratskhelia': 2027,
}

# ============================================
# RELEASE CLAUSES (public/reported - mainly La Liga)
# Source: Various reports, club announcements
# ============================================
RELEASE_CLAUSES = {
    # La Liga (most have mandatory release clauses)
    'lamine yamal': 1000, 'yamal': 1000,  # €1B
    'pedri': 1000,
    'gavi': 1000,
    'vinicius junior': 1000, 'vinicius': 1000,
    'jude bellingham': 1000, 'bellingham': 1000,
    'kylian mbappe': 1000, 'mbappe': 1000,  # Reported
    'rodrygo': 1000,
    'aurelien tchouameni': 1000,
    'eduardo camavinga': 1000, 'camavinga': 1000,
    'fermin lopez': 500,
    'pau cubarsi': 500, 'cubarsi': 500,
    'nico williams': 58, 'williams': 58,  # Athletic Bilbao
    'alexander sorloth': 38,
    'julian alvarez': 100, 'alvarez': 100,  # Atlético
    'antoine griezmann': 30, 'griezmann': 30,  # Low due to age clause
    'alvaro morata': 15,
    'samu omorodion': 80,
    
    # Premier League (some reported)
    'erling haaland': 200, 'haaland': 200,  # Rumored future clause
    'darwin nunez': None,  # No clause
    'cole palmer': None,
    
    # Bundesliga
    'florian wirtz': 150, 'wirtz': 150,  # Reported
    'jamal musiala': None, 'musiala': None,
    
    # Serie A
    'khvicha kvaratskhelia': 120, 'kvaratskhelia': 120,  # Reported
    'rafael leao': 175, 'leao': 175,
    'lautaro martinez': 110, 'lautaro': 110,
    
    # Portuguese League
    'viktor gyokeres': 100, 'gyokeres': 100,  # Sporting
}

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

# ============================================
# LEAGUES CONFIG - 20+ LEAGUES FOR HIDDEN GEMS
# ============================================
TM_LEAGUES = {
    # TIER 1: Big 5 Leagues
    'GB1': {'name': 'Premier League', 'fd_code': 'PL', 'multiplier': 2.0, 'tier': 1},
    'ES1': {'name': 'La Liga', 'fd_code': 'PD', 'multiplier': 1.4, 'tier': 1},
    'L1': {'name': 'Bundesliga', 'fd_code': 'BL1', 'multiplier': 1.3, 'tier': 1},
    'IT1': {'name': 'Serie A', 'fd_code': 'SA', 'multiplier': 1.2, 'tier': 1},
    'FR1': {'name': 'Ligue 1', 'fd_code': 'FL1', 'multiplier': 1.1, 'tier': 1},
    
    # TIER 2: Strong Secondary Leagues (Hidden Gem Territory)
    'GB2': {'name': 'Championship', 'fd_code': 'ELC', 'multiplier': 0.6, 'tier': 2},
    'NL1': {'name': 'Eredivisie', 'fd_code': 'DED', 'multiplier': 0.7, 'tier': 2},
    'PO1': {'name': 'Primeira Liga', 'fd_code': 'PPL', 'multiplier': 0.65, 'tier': 2},
    'BE1': {'name': 'Belgian Pro League', 'fd_code': None, 'multiplier': 0.55, 'tier': 2},
    'TR1': {'name': 'Süper Lig', 'fd_code': None, 'multiplier': 0.5, 'tier': 2},
    'A1': {'name': 'Austrian Bundesliga', 'fd_code': None, 'multiplier': 0.45, 'tier': 2},
    'RU1': {'name': 'Russian Premier', 'fd_code': None, 'multiplier': 0.4, 'tier': 2},
    
    # TIER 3: Talent Hotbeds (Best for Hidden Gems!)
    'AR1': {'name': 'Argentina Primera', 'fd_code': None, 'multiplier': 0.4, 'tier': 3},
    'BR1': {'name': 'Brasileirão', 'fd_code': 'BSA', 'multiplier': 0.5, 'tier': 3},
    'MX1': {'name': 'Liga MX', 'fd_code': None, 'multiplier': 0.35, 'tier': 3},
    'SC1': {'name': 'Scottish Premiership', 'fd_code': None, 'multiplier': 0.35, 'tier': 3},
    'GR1': {'name': 'Greek Super League', 'fd_code': None, 'multiplier': 0.35, 'tier': 3},
    'DK1': {'name': 'Danish Superliga', 'fd_code': None, 'multiplier': 0.35, 'tier': 3},
    'SE1': {'name': 'Allsvenskan', 'fd_code': None, 'multiplier': 0.3, 'tier': 3},
    'NO1': {'name': 'Eliteserien', 'fd_code': None, 'multiplier': 0.3, 'tier': 3},
    'CH1': {'name': 'Swiss Super League', 'fd_code': None, 'multiplier': 0.4, 'tier': 3},
    'HR1': {'name': 'Croatian HNL', 'fd_code': None, 'multiplier': 0.25, 'tier': 3},
    'RS1': {'name': 'Serbian SuperLiga', 'fd_code': None, 'multiplier': 0.25, 'tier': 3},
    'UA1': {'name': 'Ukrainian Premier', 'fd_code': None, 'multiplier': 0.3, 'tier': 3},
    'CZ1': {'name': 'Czech First League', 'fd_code': None, 'multiplier': 0.25, 'tier': 3},
    'PL1': {'name': 'Ekstraklasa', 'fd_code': None, 'multiplier': 0.25, 'tier': 3},
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
    
    # Football-Data.org free tier leagues
    fd_leagues = {
        # Big 5
        'PL': 'Premier League',
        'PD': 'La Liga', 
        'BL1': 'Bundesliga',
        'SA': 'Serie A',
        'FL1': 'Ligue 1',
        # Hidden Gem Leagues (available on free tier)
        'ELC': 'Championship',
        'DED': 'Eredivisie',
        'PPL': 'Primeira Liga',
        'BSA': 'Brasileirão',  # Brazil - lots of hidden gems!
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
            player['valuation_confidence'] = 'verified'  # Direct TM match
            player['valuation_source'] = 'Transfermarkt'
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
                player['valuation_confidence'] = 'high'
                player['valuation_source'] = 'Transfermarkt (manual)'
                matched += 1
            else:
                unmatched_names.append(original_name)
                # Estimate market value from stats - be conservative
                gi_per_game = (player['goals'] + player['assists']) / max(player['games'], 1)
                base = 8 + (gi_per_game * 25)
                player['market_value_eur_m'] = round(min(base * get_age_multiplier(player['age']), 60), 1)
                player['tm_verified'] = False
                player['valuation_confidence'] = 'estimated'
                player['valuation_source'] = 'Performance estimate'
        
        # Add release clause if known
        name_normalized = normalize_name(original_name)
        release_clause = RELEASE_CLAUSES.get(name_normalized)
        if not release_clause:
            # Try last name
            last_name = name_normalized.split()[-1] if name_normalized.split() else ''
            release_clause = RELEASE_CLAUSES.get(last_name)
        
        player['release_clause_eur_m'] = release_clause  # None if unknown
        
        # Add contract expiry if known
        contract_expiry = CONTRACT_EXPIRY.get(name_normalized)
        if not contract_expiry:
            last_name = name_normalized.split()[-1] if name_normalized.split() else ''
            contract_expiry = CONTRACT_EXPIRY.get(last_name)
        
        player['contract_expiry'] = contract_expiry  # Year or None
        
        # Flag if contract expiring soon (2025 = free agent soon!)
        if contract_expiry:
            if contract_expiry <= 2025:
                player['contract_status'] = 'expiring'
            elif contract_expiry <= 2026:
                player['contract_status'] = 'short'
            else:
                player['contract_status'] = 'long'
        else:
            player['contract_status'] = None
        
        # Add tier info for hidden gem identification
        league_info = None
        for tm_id, info in TM_LEAGUES.items():
            if info['name'] == player.get('league'):
                league_info = info
                break
        
        player['league_tier'] = league_info['tier'] if league_info else 2
        player['is_hidden_gem'] = player['league_tier'] >= 2
        
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
    tier2_leagues = ['Championship', 'Eredivisie', 'Primeira Liga', 'Belgian Pro League', 
                     'Süper Lig', 'Austrian Bundesliga', 'Russian Premier']
    tier3_leagues = ['Argentina Primera', 'Brasileirão', 'Liga MX', 'Scottish Premiership',
                     'Greek Super League', 'Danish Superliga', 'Allsvenskan', 'Eliteserien',
                     'Swiss Super League', 'Croatian HNL', 'Serbian SuperLiga', 
                     'Ukrainian Premier', 'Czech First League', 'Ekstraklasa']
    
    lower_leagues = tier2_leagues + tier3_leagues
    
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
    
    # Contract expiring soon = bargains
    expiring_contracts = sorted(
        [p for p in players if p.get('contract_status') == 'expiring'],
        key=lambda x: x.get('market_value_eur_m', 0),
        reverse=True
    )[:15]
    
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
    
    # Hidden gems: players from lower leagues with good output
    hidden_gems = sorted(
        [p for p in players if 
            p.get('is_hidden_gem', False) and 
            p.get('goals', 0) >= 3 and
            p.get('tm_verified', False)],
        key=lambda x: (x.get('xgi_per_90', 0), -x.get('market_value_eur_m', 100)),
        reverse=True
    )[:25]
    
    # Best bargains: high value players with expiring contracts
    bargains = sorted(
        [p for p in players if 
            p.get('contract_expiry') and 
            p.get('contract_expiry') <= 2026 and
            p.get('market_value_eur_m', 0) >= 20],
        key=lambda x: x.get('market_value_eur_m', 0),
        reverse=True
    )[:15]
    
    # Count unique leagues
    unique_leagues = set(p.get('league') for p in players if p.get('league'))
    
    js_content = f"""// Auto-generated - {datetime.now().strftime('%Y-%m-%d %H:%M')}
// Sources: Transfermarkt (values) + Football-Data.org (stats)
// 25+ Leagues for Hidden Gem Discovery
// Run: python3 fetch_combined.py --api-key YOUR_KEY

const PLAYER_DATA = {{
    lastUpdated: "{datetime.now().isoformat()}",
    dataSource: "Transfermarkt + Football-Data.org",
    season: "2024-25",
    updateFrequency: "daily",
    totalPlayers: {len(players)},
    leaguesCovered: {len(unique_leagues)},
    
    undervalued: {json.dumps(undervalued, indent=8)},
    
    expiringContracts: {json.dumps(expiring_contracts, indent=8)},
    
    bargains: {json.dumps(bargains, indent=8)},
    
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

