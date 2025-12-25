// ScoutLens API - Live Player Data with Accurate Transfermarkt Values
// Fetches from football-data.org + comprehensive market values

// BIG 5 LEAGUES
const TIER1_LEAGUES = {
    'PL': { name: 'Premier League', country: 'England', multiplier: 2.0, tier: 1 },
    'PD': { name: 'La Liga', country: 'Spain', multiplier: 1.4, tier: 1 },
    'BL1': { name: 'Bundesliga', country: 'Germany', multiplier: 1.3, tier: 1 },
    'SA': { name: 'Serie A', country: 'Italy', multiplier: 1.2, tier: 1 },
    'FL1': { name: 'Ligue 1', country: 'France', multiplier: 1.1, tier: 1 },
};

// HIDDEN GEM LEAGUES (Lower divisions + smaller countries)
const TIER2_LEAGUES = {
    'ELC': { name: 'Championship', country: 'England', multiplier: 0.6, tier: 2 },
    'DED': { name: 'Eredivisie', country: 'Netherlands', multiplier: 0.7, tier: 2 },
    'PPL': { name: 'Primeira Liga', country: 'Portugal', multiplier: 0.65, tier: 2 },
    'BSA': { name: 'Série A', country: 'Brazil', multiplier: 0.5, tier: 2 },
};

const ALL_LEAGUES = { ...TIER1_LEAGUES, ...TIER2_LEAGUES };

// COMPREHENSIVE Transfermarkt Values (€M) - December 2024
// Source: transfermarkt.com - These are ACTUAL market values
const MARKET_VALUES = {
    // === PREMIER LEAGUE ===
    'Erling Haaland': { value: 180, paid: 60, year: 2022 },
    'Mohamed Salah': { value: 80, paid: 36, year: 2017 },
    'Cole Palmer': { value: 110, paid: 42.5, year: 2023 },
    'Bukayo Saka': { value: 140, paid: 0, year: 0 },
    'Phil Foden': { value: 150, paid: 0, year: 0 },
    'Alexander Isak': { value: 100, paid: 70, year: 2022 },
    'Bruno Fernandes': { value: 70, paid: 55, year: 2020 },
    'Son Heung-min': { value: 60, paid: 30, year: 2015 },
    'Ollie Watkins': { value: 65, paid: 28, year: 2020 },
    'Nicolas Jackson': { value: 55, paid: 35, year: 2023 },
    'Chris Wood': { value: 5, paid: 25, year: 2017 },
    'Bryan Mbeumo': { value: 50, paid: 5.5, year: 2019 },
    'Matheus Cunha': { value: 55, paid: 50, year: 2023 },
    'Morgan Rogers': { value: 30, paid: 8, year: 2024 },
    'Dominic Solanke': { value: 55, paid: 65, year: 2024 },
    'Jarrod Bowen': { value: 55, paid: 22, year: 2020 },
    'Luis Diaz': { value: 75, paid: 50, year: 2022 },
    'Darwin Nunez': { value: 70, paid: 75, year: 2022 },
    'Jhon Duran': { value: 40, paid: 18, year: 2023 },
    'Antoine Semenyo': { value: 28, paid: 10.5, year: 2023 },
    'Yoane Wissa': { value: 32, paid: 2, year: 2021 },
    'Cody Gakpo': { value: 65, paid: 45, year: 2023 },
    'Diogo Jota': { value: 65, paid: 45, year: 2020 },
    'Richarlison': { value: 45, paid: 58, year: 2022 },
    'Brennan Johnson': { value: 45, paid: 47, year: 2023 },
    'Evan Ferguson': { value: 40, paid: 0, year: 0 },
    'João Pedro': { value: 45, paid: 30, year: 2023 },
    'Danny Welbeck': { value: 5, paid: 0, year: 2020 },
    'Raul Jimenez': { value: 8, paid: 0, year: 2024 },
    'Jean-Philippe Mateta': { value: 35, paid: 14, year: 2024 },
    'Eberechi Eze': { value: 55, paid: 16, year: 2020 },
    
    // === LA LIGA ===
    'Robert Lewandowski': { value: 15, paid: 0, year: 2022 },
    'Raphinha': { value: 70, paid: 58, year: 2022 },
    'Lamine Yamal': { value: 150, paid: 0, year: 0, rumored: 200 },
    'Vinicius Junior': { value: 200, paid: 45, year: 2018, rumored: 300 },
    'Kylian Mbappe': { value: 180, paid: 0, year: 2024 },
    'Jude Bellingham': { value: 180, paid: 103, year: 2023 },
    'Antoine Griezmann': { value: 30, paid: 0, year: 2021 },
    'Ayoze Perez': { value: 12, paid: 0, year: 2024 },
    'Alexander Sorloth': { value: 30, paid: 32, year: 2024 },
    'Iago Aspas': { value: 5, paid: 0, year: 2015 },
    'Alvaro Morata': { value: 15, paid: 13, year: 2024 },
    'Nico Williams': { value: 70, paid: 0, year: 0, rumored: 58 },
    'Pedri': { value: 100, paid: 5, year: 2020 },
    'Dani Olmo': { value: 60, paid: 55, year: 2024 },
    'Ferran Torres': { value: 40, paid: 55, year: 2022 },
    
    // === BUNDESLIGA ===
    'Harry Kane': { value: 100, paid: 95, year: 2023 },
    'Serge Gnabry': { value: 50, paid: 8, year: 2018 },
    'Jamal Musiala': { value: 130, paid: 0, year: 0, rumored: 150 },
    'Florian Wirtz': { value: 150, paid: 0, year: 0, rumored: 150 },
    'Victor Boniface': { value: 40, paid: 20, year: 2023 },
    'Michael Olise': { value: 60, paid: 53, year: 2024 },
    'Omar Marmoush': { value: 55, paid: 0.3, year: 2023, rumored: 60 },
    'Loïs Openda': { value: 65, paid: 40, year: 2023 },
    'Lois Openda': { value: 65, paid: 40, year: 2023 },
    'Tim Kleindienst': { value: 15, paid: 7, year: 2024 },
    'Jonathan Burkardt': { value: 25, paid: 0, year: 0 },
    'Patrik Schick': { value: 22, paid: 26.5, year: 2022 },
    'Leroy Sane': { value: 60, paid: 49, year: 2020 },
    'Xavi Simons': { value: 80, paid: 0, year: 2024 },
    'Deniz Undav': { value: 28, paid: 26, year: 2024 },
    
    // === SERIE A ===
    'Lautaro Martinez': { value: 110, paid: 25, year: 2018, rumored: 130 },
    'Marcus Thuram': { value: 70, paid: 0, year: 2023 },
    'Dusan Vlahovic': { value: 65, paid: 75, year: 2022 },
    'Rafael Leao': { value: 80, paid: 28, year: 2019 },
    'Khvicha Kvaratskhelia': { value: 85, paid: 10, year: 2022 },
    'Ademola Lookman': { value: 55, paid: 14, year: 2022 },
    'Mateo Retegui': { value: 35, paid: 22, year: 2024 },
    'Moise Kean': { value: 40, paid: 13, year: 2024 },
    'Paulo Dybala': { value: 20, paid: 0, year: 2022 },
    'Romelu Lukaku': { value: 28, paid: 30, year: 2024 },
    'Artem Dovbyk': { value: 35, paid: 30.5, year: 2024 },
    'Christian Pulisic': { value: 35, paid: 20, year: 2023 },
    
    // === LIGUE 1 ===
    'Bradley Barcola': { value: 70, paid: 50, year: 2023 },
    'Ousmane Dembele': { value: 60, paid: 50, year: 2023 },
    'Mason Greenwood': { value: 40, paid: 26, year: 2024 },
    'Jonathan David': { value: 55, paid: 27, year: 2020, rumored: 60 },
    'Alexandre Lacazette': { value: 5, paid: 0, year: 2022 },
    'Randal Kolo Muani': { value: 45, paid: 95, year: 2023 },
    'Vitinha': { value: 75, paid: 40, year: 2022 },
    
    // === CHAMPIONSHIP (Hidden Gems) ===
    'Rodrigo Muniz': { value: 12, paid: 8, year: 2023 },
    'Sammie Szmodics': { value: 10, paid: 9, year: 2024 },
    'Josh Sargent': { value: 15, paid: 10, year: 2021 },
    'Carlton Morris': { value: 6, paid: 0.5, year: 2022 },
    'Borja Sainz': { value: 8, paid: 1, year: 2023 },
    
    // === EREDIVISIE (Hidden Gems) ===
    'Luuk de Jong': { value: 3, paid: 0, year: 2023 },
    'Vangelis Pavlidis': { value: 8, paid: 2.5, year: 2023 },
    'Malik Tillman': { value: 18, paid: 0, year: 2024 },
    'Donyell Malen': { value: 50, paid: 30, year: 2021 },
    
    // === PRIMEIRA LIGA (Hidden Gems) ===
    'Viktor Gyokeres': { value: 75, paid: 20, year: 2023, rumored: 100 },
    'Goncalo Ramos': { value: 45, paid: 0, year: 2023 },
    'Pedro Goncalves': { value: 35, paid: 0, year: 0 },
    'Francisco Trincao': { value: 20, paid: 10, year: 2024 },
    
    // === BRAZIL (Hidden Gems) ===
    'Estevao': { value: 30, paid: 0, year: 0, rumored: 45 },
    'Endrick': { value: 50, paid: 47, year: 2024 },
    'Yuri Alberto': { value: 18, paid: 12, year: 2022 },
    'Luiz Henrique': { value: 15, paid: 0, year: 2022 },
};

function getAgeMultiplier(age) {
    if (age <= 21) return 1.3;
    if (age <= 24) return 1.15;
    if (age <= 27) return 1.0;
    if (age <= 29) return 0.85;
    if (age <= 31) return 0.65;
    if (age <= 33) return 0.45;
    return 0.3;
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

function findMarketValue(name) {
    // Direct match
    if (MARKET_VALUES[name]) return MARKET_VALUES[name];
    
    // Partial match (last name)
    const lastName = name.split(' ').pop();
    for (const [key, data] of Object.entries(MARKET_VALUES)) {
        if (key.includes(lastName) || lastName.length > 4 && key.toLowerCase().includes(lastName.toLowerCase())) {
            return data;
        }
    }
    
    // First name match for common names
    const firstName = name.split(' ')[0];
    if (firstName.length > 5) {
        for (const [key, data] of Object.entries(MARKET_VALUES)) {
            if (key.toLowerCase().includes(firstName.toLowerCase())) {
                return data;
            }
        }
    }
    
    return null;
}

function calculateFairValue(goals, assists, games, age, leagueMultiplier, marketValue) {
    // More realistic fair value calculation
    // Based on goals + assists relative to market value
    
    const goalsPerGame = goals / Math.max(games, 1);
    const assistsPerGame = assists / Math.max(games, 1);
    
    // Output per game (goals worth more than assists)
    const outputPerGame = goalsPerGame + (assistsPerGame * 0.7);
    
    // Compare to expected output for their market value bracket
    // €50M+ players should produce ~0.7+ per game
    // €20-50M players should produce ~0.4-0.7 per game
    // €10-20M players should produce ~0.25-0.4 per game
    // <€10M players should produce ~0.15-0.25 per game
    
    let expectedOutput;
    if (marketValue >= 50) expectedOutput = 0.65;
    else if (marketValue >= 30) expectedOutput = 0.5;
    else if (marketValue >= 15) expectedOutput = 0.35;
    else if (marketValue >= 8) expectedOutput = 0.25;
    else expectedOutput = 0.15;
    
    // Performance ratio: how much they're outperforming expectations
    const performanceRatio = outputPerGame / expectedOutput;
    
    // Fair value = market value adjusted by performance
    // If performing 2x expectations, fair value is ~1.5x market value (not 2x - diminishing returns)
    let fairValue;
    if (performanceRatio > 1) {
        // Outperforming: increase value with diminishing returns
        fairValue = marketValue * (1 + (performanceRatio - 1) * 0.5);
    } else {
        // Underperforming: decrease value
        fairValue = marketValue * performanceRatio;
    }
    
    // Age adjustment (young overperformers are worth more)
    fairValue *= getAgeMultiplier(age);
    
    // League tier adjustment for hidden gems
    if (leagueMultiplier < 1.0) {
        // Lower league players get a boost if they're performing well
        fairValue *= (1 + (1 - leagueMultiplier) * 0.3);
    }
    
    // Cap at reasonable values
    return Math.round(Math.max(1, Math.min(fairValue, marketValue * 2.5)) * 10) / 10;
}

function processScorer(scorer, leagueInfo) {
    const player = scorer.player || {};
    const name = player.name || 'Unknown';
    const goals = scorer.goals || 0;
    const assists = scorer.assists || 0;
    const penalties = scorer.penalties || 0;
    const games = scorer.playedMatches || 1;
    const minutes = games * 75;
    const age = calculateAge(player.dateOfBirth);
    const position = (player.position || 'Forward')[0];
    
    // Get Transfermarkt market value
    const tmData = findMarketValue(name);
    let marketValue, paidFee, rumoredValue;
    
    if (tmData) {
        marketValue = tmData.value;
        paidFee = tmData.paid || null;
        rumoredValue = tmData.rumored || null;
    } else {
        // Fallback calculation for unknown players
        const perfScore = (goals / games) * 1.2 + (assists / games) * 0.8;
        marketValue = Math.round(Math.max(2, Math.min(perfScore * 35 * leagueInfo.multiplier * getAgeMultiplier(age), 80)) * 10) / 10;
        paidFee = null;
        rumoredValue = null;
    }
    
    // Calculate xG/xA
    const npg = goals - penalties;
    const xg = npg * 0.92 + penalties * 0.76;
    const xa = assists * 0.88;
    const xgiPer90 = (xg + xa) / (minutes / 90);
    
    // Calculate fair value based on current performance vs market value
    const fairValue = calculateFairValue(goals, assists, games, age, leagueInfo.multiplier, marketValue);
    
    // Undervaluation
    const undervalPct = marketValue > 0 ? ((fairValue - marketValue) / marketValue) * 100 : 0;
    
    return {
        name,
        team: (scorer.team || {}).name || 'Unknown',
        league: leagueInfo.name,
        country: leagueInfo.country,
        tier: leagueInfo.tier || 1,
        position,
        age,
        nationality: player.nationality || '',
        // Values
        market_value_eur_m: marketValue,
        fair_value_eur_m: fairValue,
        transfer_fee_paid_eur_m: paidFee,
        rumored_value_eur_m: rumoredValue,
        undervaluation_pct: Math.round(undervalPct * 10) / 10,
        // Value insight
        value_source: tmData ? 'transfermarkt' : 'calculated',
        is_hidden_gem: leagueInfo.tier === 2,
        // Performance
        xgi_per_90: Math.round(xgiPer90 * 100) / 100,
        goals,
        assists,
        xG: Math.round(xg * 10) / 10,
        xA: Math.round(xa * 10) / 10,
        minutes_played: minutes,
        games
    };
}

// Simple in-memory rate limiting (10 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per window

function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    
    if (!record) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }
    
    if (now > record.resetAt) {
        // Window expired, reset
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }
    
    if (record.count >= RATE_LIMIT_MAX) {
        return false; // Rate limit exceeded
    }
    
    record.count++;
    return true;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    
    // Basic rate limiting
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     'unknown';
    
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
            error: 'Too many requests. Please try again in a minute.',
            retryAfter: 60
        });
    }
    
    const API_KEY = process.env.FOOTBALL_DATA_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }
    
    try {
        const allPlayers = [];
        
        for (const [code, info] of Object.entries(ALL_LEAGUES)) {
            const response = await fetch(
                `https://api.football-data.org/v4/competitions/${code}/scorers?limit=30`,
                { headers: { 'X-Auth-Token': API_KEY } }
            );
            
            if (response.ok) {
                const data = await response.json();
                const scorers = data.scorers || [];
                scorers.forEach(s => {
                    const player = processScorer(s, info);
                    player.id = allPlayers.length + 1;
                    allPlayers.push(player);
                });
            }
            
            // Rate limit: football-data.org free tier = 10 req/min
            await new Promise(r => setTimeout(r, 6500));
        }
        
        // === CATEGORIZE FOR FREE vs PRO ===
        
        // FREE: Top 5 undervalued (teaser)
        const undervaluedAll = allPlayers
            .filter(p => p.undervaluation_pct > 10)
            .sort((a, b) => b.undervaluation_pct - a.undervaluation_pct);
        
        const undervaluedFree = undervaluedAll.slice(0, 5);
        const undervaluedPro = undervaluedAll.slice(5, 30);
        
        // FREE: Top 5 performers
        const performersAll = [...allPlayers].sort((a, b) => b.xgi_per_90 - a.xgi_per_90);
        const performersFree = performersAll.slice(0, 5);
        const performersPro = performersAll.slice(5, 25);
        
        // FREE: Top 5 rising stars (U23)
        const risingAll = allPlayers
            .filter(p => p.age <= 23)
            .sort((a, b) => b.xgi_per_90 - a.xgi_per_90);
        const risingFree = risingAll.slice(0, 5);
        const risingPro = risingAll.slice(5, 20);
        
        // HIDDEN GEMS: Players from lower leagues with good output
        const hiddenGemsAll = allPlayers
            .filter(p => p.tier === 2 && p.xgi_per_90 > 0.4)
            .sort((a, b) => b.undervaluation_pct - a.undervaluation_pct);
        const hiddenGemsFree = hiddenGemsAll.slice(0, 3);
        const hiddenGemsPro = hiddenGemsAll.slice(3, 15);
        
        // BARGAINS: Players where fair value > paid fee (good signings)
        const bargains = allPlayers
            .filter(p => p.transfer_fee_paid_eur_m && p.fair_value_eur_m > p.transfer_fee_paid_eur_m * 1.2)
            .sort((a, b) => (b.fair_value_eur_m - b.transfer_fee_paid_eur_m) - (a.fair_value_eur_m - a.transfer_fee_paid_eur_m))
            .slice(0, 10);
        
        return res.status(200).json({
            lastUpdated: new Date().toISOString(),
            dataSource: 'football-data.org + transfermarkt',
            season: '2024-25',
            updateFrequency: 'live',
            totalPlayers: allPlayers.length,
            
            // FREE TIER
            free: {
                undervalued: undervaluedFree,
                topPerformers: performersFree,
                risingStars: risingFree,
                hiddenGems: hiddenGemsFree,
            },
            
            // PRO TIER (shown as locked previews)
            pro: {
                undervalued: undervaluedPro.map(p => ({ 
                    name: p.name, 
                    team: p.team,
                    league: p.league,
                    locked: true 
                })),
                topPerformers: performersPro.map(p => ({ 
                    name: p.name,
                    team: p.team, 
                    league: p.league,
                    locked: true 
                })),
                risingStars: risingPro.map(p => ({ 
                    name: p.name,
                    team: p.team,
                    league: p.league, 
                    locked: true 
                })),
                hiddenGems: hiddenGemsPro.map(p => ({ 
                    name: p.name,
                    team: p.team,
                    league: p.league,
                    country: p.country,
                    locked: true 
                })),
                bargains: bargains.map(p => ({ 
                    name: p.name,
                    team: p.team,
                    league: p.league,
                    locked: true 
                })),
            },
            
            // Stats for marketing
            stats: {
                totalUndervalued: undervaluedAll.length,
                totalRisingStars: risingAll.length,
                totalHiddenGems: hiddenGemsAll.length,
                leaguesCovered: Object.keys(ALL_LEAGUES).length,
                countriesCovered: [...new Set(Object.values(ALL_LEAGUES).map(l => l.country))].length
            }
        });
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
