// ScoutLens Rumors API
// Fetches and filters rumors with auto-expiration

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // In production, fetch from database or external API
        // For now, using static JSON file
        const fs = require('fs');
        const path = require('path');
        
        const rumorsPath = path.join(process.cwd(), 'data', 'rumors.json');
        const rumorsData = JSON.parse(fs.readFileSync(rumorsPath, 'utf8'));
        
        // Filter expired rumors
        const today = new Date();
        const activeRumors = rumorsData.rumors.filter(r => {
            if (!r.expires) return true;
            const expiry = new Date(r.expires);
            return expiry > today;
        }).sort((a, b) => {
            // Sort by date (newest first), then by status (hot first)
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            
            const statusOrder = { 'hot': 1, 'warm': 2, 'cold': 3 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });
        
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json({
            lastUpdated: rumorsData.lastUpdated,
            count: activeRumors.length,
            rumors: activeRumors
        });
        
    } catch (error) {
        console.error('Error fetching rumors:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch rumors',
            rumors: [] // Return empty array on error
        });
    }
}

