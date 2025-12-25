#!/usr/bin/env python3
"""
ScoutLens Rumors Update Script
Manages rumors.json file: add, update, remove expired rumors
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

RUMORS_FILE = Path(__file__).parent.parent / 'data' / 'rumors.json'

def load_rumors():
    """Load rumors from JSON file"""
    if not RUMORS_FILE.exists():
        return {'last_updated': datetime.now().isoformat()[:10], 'rumors': []}
    
    with open(RUMORS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_rumors(data):
    """Save rumors to JSON file"""
    data['last_updated'] = datetime.now().isoformat()[:10]
    with open(RUMORS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved {len(data['rumors'])} rumors to {RUMORS_FILE}")

def remove_expired(rumors_data):
    """Remove expired rumors"""
    today = datetime.now().date()
    original_count = len(rumors_data['rumors'])
    
    rumors_data['rumors'] = [
        r for r in rumors_data['rumors']
        if not r.get('expires') or datetime.fromisoformat(r['expires']).date() > today
    ]
    
    removed = original_count - len(rumors_data['rumors'])
    if removed > 0:
        print(f"🗑️  Removed {removed} expired rumor(s)")
    
    return rumors_data

def add_rumor(rumors_data, player, from_team, to_team, fee, status='warm', source='Unknown', verified=False, expires_days=30):
    """Add a new rumor"""
    today = datetime.now()
    expires = (today + timedelta(days=expires_days)).isoformat()[:10]
    
    new_id = f"rumor_{len(rumors_data['rumors']) + 1:03d}"
    
    rumor = {
        'id': new_id,
        'player': player,
        'from': from_team,
        'to': to_team,
        'fee': fee,
        'status': status,  # 'hot' or 'warm'
        'source': source,
        'date': today.isoformat()[:10],
        'verified': verified,
        'expires': expires
    }
    
    rumors_data['rumors'].append(rumor)
    print(f"✅ Added rumor: {player} ({from_team} → {to_team})")
    return rumors_data

def update_rumor(rumors_data, rumor_id, **updates):
    """Update an existing rumor"""
    for rumor in rumors_data['rumors']:
        if rumor['id'] == rumor_id:
            rumor.update(updates)
            print(f"✅ Updated rumor: {rumor_id}")
            return rumors_data
    
    print(f"❌ Rumor {rumor_id} not found")
    return rumors_data

def list_rumors(rumors_data):
    """List all rumors"""
    print(f"\n📰 Current Rumors ({len(rumors_data['rumors'])}):\n")
    for r in sorted(rumors_data['rumors'], key=lambda x: x['date'], reverse=True):
        status_icon = '🔥' if r['status'] == 'hot' else '⚡'
        verified = '✓' if r.get('verified') else ''
        print(f"  {status_icon} {r['player']} {verified}")
        print(f"     {r['from']} → {r['to']}")
        print(f"     Fee: {r['fee']}")
        print(f"     Source: {r['source']} | Expires: {r.get('expires', 'Never')}")
        print()

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python update_rumors.py list                    # List all rumors")
        print("  python update_rumors.py clean                   # Remove expired rumors")
        print("  python update_rumors.py add <player> <from> <to> <fee> [status] [source]")
        print("  python update_rumors.py update <id> <field>=<value>")
        print("\nExample:")
        print("  python update_rumors.py add 'Erling Haaland' 'Man City' 'Real Madrid' '€200M' hot 'Fabrizio Romano'")
        return
    
    command = sys.argv[1]
    rumors_data = load_rumors()
    
    if command == 'list':
        list_rumors(rumors_data)
    
    elif command == 'clean':
        rumors_data = remove_expired(rumors_data)
        save_rumors(rumors_data)
    
    elif command == 'add':
        if len(sys.argv) < 6:
            print("❌ Usage: add <player> <from> <to> <fee> [status] [source]")
            return
        
        player = sys.argv[2]
        from_team = sys.argv[3]
        to_team = sys.argv[4]
        fee = sys.argv[5]
        status = sys.argv[6] if len(sys.argv) > 6 else 'warm'
        source = sys.argv[7] if len(sys.argv) > 7 else 'Unknown'
        
        rumors_data = add_rumor(rumors_data, player, from_team, to_team, fee, status, source)
        save_rumors(rumors_data)
    
    elif command == 'update':
        if len(sys.argv) < 4:
            print("❌ Usage: update <id> <field>=<value>")
            return
        
        rumor_id = sys.argv[2]
        updates = {}
        for arg in sys.argv[3:]:
            if '=' in arg:
                key, value = arg.split('=', 1)
                updates[key] = value
        
        rumors_data = update_rumor(rumors_data, rumor_id, **updates)
        save_rumors(rumors_data)
    
    else:
        print(f"❌ Unknown command: {command}")

if __name__ == '__main__':
    main()

