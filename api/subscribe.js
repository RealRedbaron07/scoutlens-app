/**
 * ScoutLens - Email Subscription API
 * Collects email subscriptions for future newsletter integration
 * 
 * To upgrade to a real newsletter service (Beehiiv, ConvertKit, etc.):
 * 1. Replace this endpoint with your newsletter service API
 * 2. Or keep this and add a webhook to forward emails to your service
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { email } = req.body;
        
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // TODO: Replace with your newsletter service integration
        // Example for Beehiiv:
        // const response = await fetch('https://api.beehiiv.com/v2/forms/YOUR_FORM_ID/subscribe', {
        //     method: 'POST',
        //     headers: {
        //         'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ email })
        // });
        
        // For now: Just log and return success
        // In production, you'd store this in a database or send to your newsletter service
        console.log('📧 New subscription:', email);
        
        // Return success (emails are also stored client-side)
        return res.status(200).json({
            success: true,
            message: 'Email collected successfully',
            // In production, return actual subscription status from your service
            subscribed: true
        });
        
    } catch (error) {
        console.error('Error processing subscription:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

