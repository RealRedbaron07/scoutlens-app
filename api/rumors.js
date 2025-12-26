/**
 * ScoutLens - Transfer Rumors API
 * Fetches live transfer rumors from free sources
 * Updates automatically - no manual data needed
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate'); // Cache 30 min, serve stale for 1 hour
    
    try {
        const rumors = await fetchTransferRumors();
        res.status(200).json({
            last_updated: new Date().toISOString(),
            rumors: rumors
        });
    } catch (error) {
        console.error('Error fetching rumors:', error);
        // Return empty array on error, not fallback (user wants live data only)
        res.status(200).json({
            error: 'Failed to fetch live rumors',
            last_updated: new Date().toISOString(),
            rumors: []
        });
    }
}

/**
 * Fetch transfer rumors from free RSS feeds
 * Uses BBC Sport and Sky Sports RSS (free, no API key)
 */
async function fetchTransferRumors() {
    const rumors = [];
    
    // Free RSS sources (no API key needed)
    const sources = [
        {
            name: 'BBC Sport',
            url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
            parser: parseRSSFeed
        },
        {
            name: 'Sky Sports',
            url: 'https://feeds.skynews.com/feeds/rss/sports.xml',
            parser: parseRSSFeed
        }
    ];
    
    // Fetch from all sources in parallel
    const fetchPromises = sources.map(async (source) => {
        try {
            const response = await fetch(source.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ScoutLens/1.0)',
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                },
                // Add timeout
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const text = await response.text();
            const items = source.parser(text);
            
            // Filter for transfer-related news
            const transferItems = items
                .filter(item => isTransferRelated(item.title, item.description))
                .slice(0, 5); // Max 5 per source
            
            return transferItems.map(item => extractRumorFromItem(item, source.name));
        } catch (error) {
            console.warn(`Failed to fetch from ${source.name}:`, error.message);
            return [];
        }
    });
    
    const results = await Promise.all(fetchPromises);
    const allRumors = results.flat().filter(r => r !== null);
    
    // Remove duplicates, sort by date, limit to 15
    return deduplicateRumors(allRumors)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 15);
}

/**
 * Parse RSS feed (generic parser for both BBC and Sky)
 */
function parseRSSFeed(xmlText) {
    const items = [];
    
    // Try CDATA format first (BBC)
    let itemRegex = /<item>(.*?)<\/item>/gs;
    let matches = xmlText.matchAll(itemRegex);
    
    for (const match of matches) {
        const itemXml = match[1];
        
        // Try CDATA format
        let titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        let descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        
        // Fallback to regular format
        if (!titleMatch) {
            titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
        }
        if (!descMatch) {
            descMatch = itemXml.match(/<description>(.*?)<\/description>/);
        }
        
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        
        if (titleMatch) {
            const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim() : '';
            const link = linkMatch ? linkMatch[1] : '';
            
            let date = new Date().toISOString().split('T')[0];
            if (dateMatch) {
                try {
                    date = new Date(dateMatch[1]).toISOString().split('T')[0];
                } catch (e) {
                    // Use today if date parsing fails
                }
            }
            
            items.push({ title, description, link, date });
        }
    }
    
    return items;
}

/**
 * Check if news item is transfer-related
 */
function isTransferRelated(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const transferKeywords = [
        'transfer', 'signing', 'deal', 'move', 'join', 'leave', 'exit',
        'contract', 'agreement', 'target', 'interest', 'rumor', 'rumour',
        'bid', 'offer', 'negotiation', 'talks', 'linked', 'set to', 'agreed'
    ];
    
    return transferKeywords.some(keyword => text.includes(keyword));
}

/**
 * Extract rumor data from news item
 */
function extractRumorFromItem(item, source) {
    const title = item.title || '';
    const description = item.description || '';
    const combined = `${title} ${description}`;
    
    // Try to extract player name (common patterns: "First Last" or "First Last-Name")
    const playerPatterns = [
        /([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)/,  // "Mohamed Salah" or "Trent Alexander-Arnold"
        /([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)/        // "Virgil van Dijk"
    ];
    
    let player = null;
    for (const pattern of playerPatterns) {
        const match = title.match(pattern);
        if (match) {
            player = match[1];
            break;
        }
    }
    
    if (!player) return null;
    
    // Try to extract clubs
    const fromPatterns = [
        /(?:from|at|leaving|exit|departure)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:star|player|defender|midfielder|forward)/i
    ];
    
    const toPatterns = [
        /(?:to|join|sign|move|linked with|target)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /(?:set for|agreed|deal with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ];
    
    let from = 'Unknown';
    let to = 'Multiple Clubs';
    
    for (const pattern of fromPatterns) {
        const match = combined.match(pattern);
        if (match) {
            from = match[1];
            break;
        }
    }
    
    for (const pattern of toPatterns) {
        const match = combined.match(pattern);
        if (match) {
            to = match[1];
            break;
        }
    }
    
    // Determine status
    const text = combined.toLowerCase();
    const isHot = text.includes('confirmed') || text.includes('done deal') || 
                  text.includes('agreed') || text.includes('signed') ||
                  text.includes('complete');
    
    // Extract fee
    const feePatterns = [
        /(?:€|£|\$)(\d+(?:\.\d+)?)\s*(?:m|million)/i,
        /(\d+(?:\.\d+)?)\s*(?:million|m)\s*(?:€|£|\$)/i,
        /free\s*(?:transfer|agent|deal)/i,
        /contract\s+expires/i
    ];
    
    let fee = 'Fee undisclosed';
    for (const pattern of feePatterns) {
        const match = text.match(pattern);
        if (match) {
            if (text.includes('free') || text.includes('contract expires')) {
                fee = 'Free (contract expires)';
            } else if (match[1]) {
                fee = `€${match[1]}M`;
            }
            break;
        }
    }
    
    // Get expiry date (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    return {
        id: `rumor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        player: player,
        from: from,
        to: to,
        fee: fee,
        status: isHot ? 'hot' : 'warm',
        source: source,
        date: item.date || new Date().toISOString().split('T')[0],
        verified: source === 'BBC Sport' || source === 'Sky Sports',
        expires: expiryDate.toISOString().split('T')[0]
    };
}

/**
 * Remove duplicate rumors
 */
function deduplicateRumors(rumors) {
    const seen = new Set();
    return rumors.filter(rumor => {
        const key = `${rumor.player.toLowerCase()}_${rumor.from.toLowerCase()}_${rumor.to.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
