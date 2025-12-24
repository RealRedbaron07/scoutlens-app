// Vercel Serverless Function - Fetches LIVE player data
// Deploy to Vercel and this auto-runs as an API endpoint

const LEAGUES = {
    'PL': { name: 'Premier League', multiplier: 2.0 },
    'PD': { name: 'La Liga', multiplier: 1.4 },
    'BL1': { name: 'Bundesliga', multiplier: 1.3 },
    'SA': { name: 'Serie A', multiplier: 1.2 },
    'FL1': { name: 'Ligue 1', multiplier: 1.1 },
};

// Known Transfermarkt values (€M) - Updated Dec 2024
// Source: transfermarkt.com - update this monthly
const TRANSFERMARKT_VALUES = {
    // Premier League stars
    'Erling Haaland': 180, 'Mohamed Salah': 80, 'Cole Palmer': 110,
    'Bukayo Saka': 140, 'Phil Foden': 130, 'Alexander Isak': 100,
    'Bruno Fernandes': 70, 'Son Heung-min': 55, 'Ollie Watkins': 65,
    'Nicolas Jackson': 55, 'Chris Wood': 8, 'Bryan Mbeumo': 45,
    'Matheus Cunha': 55, 'Morgan Rogers': 30, 'Dominic Solanke': 55,
    'Jarrod Bowen': 50, 'Luis Diaz': 75, 'Darwin Nunez': 70,
    'Jhon Duran': 35, 'Antoine Semenyo': 25, 'Yoane Wissa': 30,
    
    // La Liga
    'Robert Lewandowski': 15, 'Raphinha': 70, 'Lamine Yamal': 150,
    'Vinicius Junior': 180, 'Kylian Mbappe': 180, 'Jude Bellingham': 150,
    'Antoine Griezmann': 30, 'Ayoze Perez': 15, 'Alexander Sorloth': 30,
    'Iago Aspas': 6, 'Alvaro Morata': 15, 'Williams': 70,
    
    // Bundesliga
    'Harry Kane': 100, 'Serge Gnabry': 45, 'Jamal Musiala': 130,
    'Florian Wirtz': 150, 'Victor Boniface': 45, 'Michael Olise': 60,
    'Omar Marmoush': 50, 'Loïs Openda': 65, 'Tim Kleindienst': 15,
    'Jonathan Burkardt': 22, 'Patrik Schick': 22,
    
    // Serie A
    'Lautaro Martinez': 110, 'Marcus Thuram': 65, 'Dusan Vlahovic': 65,
    'Rafael Leao': 80, 'Khvicha Kvaratskhelia': 85, 'Ademola Lookman': 45,
    'Mateo Retegui': 30, 'Moise Kean': 35,
    
    // Ligue 1
    'Bradley Barcola': 70, 'Ousmane Dembele': 60, 'Mason Greenwood': 35,
    'Jonathan David': 55, 'Alexandre Lacazette': 6
};

function getAgeMultiplier(age) {
    if (age <= 20) return 1.5;
    if (age <= 23) return 1.3;
    if (age <= 26) return 1.1;
    if (age <= 28) return 1.0;
    if (age <= 30) return 0.85;
    if (age <= 32) return 0.65;
    return 0.4;
}

function calculateAge(dob) {
    if (!dob) return 25;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || 
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function getMarketValue(name, age, goals, assists, games, leagueMultiplier) {
    // First check if we have a known Transfermarkt value
    for (const [knownName, value] of Object.entries(TRANSFERMARKT_VALUES)) {
        if (name.includes(knownName) || knownName.includes(name.split(' ').pop())) {
            return value;
        }
    }
    
    // Fallback: estimate based on performance + age + league
    const goalsPerGame = goals / Math.max(games, 1);
    const assistsPerGame = assists / Math.max(games, 1);
    const outputScore = goalsPerGame * 1.2 + assistsPerGame * 0.8;
    
    // Base value from output
    let baseValue = outputScore * 40 * leagueMultiplier;
    
    // Age adjustment
    baseValue *= getAgeMultiplier(age);
    
    // Minimum and maximum caps
    return Math.round(Math.max(3, Math.min(baseValue, 120)) * 10) / 10;
}

function calculateFairValue(goals, assists, games, minutes, age, leagueMultiplier) {
    // Performance-based fair value calculation
    const goalsPerGame = goals / Math.max(games, 1);
    const assistsPerGame = assists / Math.max(games, 1);
    
    // xG-based fair value (goals are more valuable than assists)
    const xgiPer90 = ((goals * 0.9) + (assists * 0.75)) / (minutes / 90);
    
    // Base value from pure performance
    let fairValue = xgiPer90 * 70 * leagueMultiplier;
    
    // Age premium/discount
    fairValue *= getAgeMultiplier(age);
    
    // Bonus for high volume (more games = more reliable data)
    if (games >= 15) fairValue *= 1.1;
    
    return Math.round(Math.max(5, Math.min(fairValue, 200)) * 10) / 10;
}

function processScorer(scorer, leagueInfo) {
    const player = scorer.player || {};
    const goals = scorer.goals || 0;
    const assists = scorer.assists || 0;
    const penalties = scorer.penalties || 0;
    const games = scorer.playedMatches || 1;
    const minutes = games * 75;
    
    const name = player.name || 'Unknown';
    const age = calculateAge(player.dateOfBirth);
    const position = (player.position || 'Forward')[0];
    
    // Calculate xG/xA estimates
    const npg = goals - penalties;
    const xg = npg * 0.92 + penalties * 0.76;
    const xa = assists * 0.88;
    const xgiPer90 = (xg + xa) / (minutes / 90);
    
    // Get market value (Transfermarkt-based)
    const marketValue = getMarketValue(name, age, goals, assists, games, leagueInfo.multiplier);
    
    // Calculate performance-based fair value
    const fairValue = calculateFairValue(goals, assists, games, minutes, age, leagueInfo.multiplier);
    
    // Undervaluation percentage
    const undervalPct = marketValue > 0 ? ((fairValue - marketValue) / marketValue) * 100 : 0;
    
    return {
        name,
        team: (scorer.team || {}).name || 'Unknown',
        league: leagueInfo.name,
        position,
        age,
        nationality: player.nationality || '',
        fair_value_eur_m: fairValue,
        market_value_eur_m: marketValue,
        undervaluation_pct: Math.round(undervalPct * 10) / 10,
        xgi_per_90: Math.round(xgiPer90 * 100) / 100,
        goals,
        assists,
        xG: Math.round(xg * 10) / 10,
        xA: Math.round(xa * 10) / 10,
        minutes_played: minutes,
        games
    };
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache 1 hour
    
    const API_KEY = process.env.FOOTBALL_DATA_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }
    
    try {
        const allPlayers = [];
        
        for (const [code, info] of Object.entries(LEAGUES)) {
            const response = await fetch(
                `https://api.football-data.org/v4/competitions/${code}/scorers?limit=25`,
                { headers: { 'X-Auth-Token': API_KEY } }
            );
            
            if (response.ok) {
                const data = await response.json();
                const scorers = data.scorers || [];
                scorers.forEach(s => allPlayers.push(processScorer(s, info)));
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // Assign IDs
        allPlayers.forEach((p, i) => p.id = i + 1);
        
        // Categorize
        const undervalued = allPlayers
            .filter(p => p.undervaluation_pct > 20)
            .sort((a, b) => b.undervaluation_pct - a.undervaluation_pct)
            .slice(0, 20);
            
        const topPerformers = [...allPlayers]
            .sort((a, b) => b.xgi_per_90 - a.xgi_per_90)
            .slice(0, 15);
            
        const risingStars = allPlayers
            .filter(p => p.age <= 23)
            .sort((a, b) => b.xgi_per_90 - a.xgi_per_90)
            .slice(0, 15);
        
        return res.status(200).json({
            lastUpdated: new Date().toISOString(),
            dataSource: 'football-data.org',
            season: '2024-25',
            updateFrequency: 'live',
            undervalued,
            topPerformers,
            risingStars
        });
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

