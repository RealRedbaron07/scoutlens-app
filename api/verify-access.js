/**
 * ScoutLens - Pro Access Verification API
 * 
 * This serverless function verifies Pro subscription status.
 * 
 * SECURITY ARCHITECTURE:
 * - Client calls this endpoint to check Pro status (no client-side localStorage trust)
 * - In production, this endpoint should:
 *   1. Validate session cookie or JWT token
 *   2. Check payment provider (Stripe/PayPal) for active subscription
 *   3. Return verified status with a signed token
 * 
 * DATABASE INTEGRATION (Future):
 * - Connect to your database (Supabase, PlanetScale, MongoDB, etc.)
 * - Query user record by email
 * - Verify subscription status and expiry date
 * 
 * Example with Supabase:
 * const { data, error } = await supabase
 *     .from('subscriptions')
 *     .select('*')
 *     .eq('email', email)
 *     .eq('status', 'active')
 *     .single();
 */

// Simulated Pro users for testing (replace with actual database lookup)
const MOCK_PRO_USERS = new Set([
    // Add test emails here for development
    // 'test@example.com',
]);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, token } = req.body;

        // ============================================
        // OPTION 1: Verify by Email (requires database)
        // ============================================
        if (email) {
            if (typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({
                    error: 'Invalid email format',
                    isPro: false
                });
            }

            // TODO: Replace with actual database lookup
            // Example for Stripe:
            // const subscription = await stripe.subscriptions.list({
            //     customer: await getCustomerByEmail(email),
            //     status: 'active'
            // });
            // const isPro = subscription.data.length > 0;

            // Example for your own database:
            // const user = await db.query('SELECT * FROM users WHERE email = ? AND subscription_status = "active"', [email]);
            // const isPro = user.length > 0;

            // Mock implementation - always returns false unless in test set
            const isPro = MOCK_PRO_USERS.has(email.toLowerCase());

            // Generate a simple verification token (in production, use JWT)
            const verificationToken = isPro
                ? Buffer.from(JSON.stringify({
                    email,
                    verified: true,
                    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiry
                })).toString('base64')
                : null;

            return res.status(200).json({
                isPro,
                verified: true,
                token: verificationToken,
                expiresAt: isPro ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
                message: isPro
                    ? 'Pro access verified'
                    : 'No active subscription found for this email'
            });
        }

        // ============================================
        // OPTION 2: Verify by Token (for session refresh)
        // ============================================
        if (token) {
            try {
                // In production, verify JWT signature
                const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

                // Check token expiry
                if (decoded.exp && decoded.exp < Date.now()) {
                    return res.status(200).json({
                        isPro: false,
                        verified: true,
                        error: 'Token expired',
                        message: 'Please re-verify your subscription'
                    });
                }

                // TODO: Additional verification against database
                // Ensure the subscription is still active

                return res.status(200).json({
                    isPro: decoded.verified === true,
                    verified: true,
                    email: decoded.email,
                    message: 'Token verified'
                });

            } catch (e) {
                return res.status(200).json({
                    isPro: false,
                    verified: true,
                    error: 'Invalid token',
                    message: 'Token verification failed'
                });
            }
        }

        // No email or token provided
        return res.status(400).json({
            error: 'Email or token required',
            isPro: false,
            message: 'Please provide an email address or verification token'
        });

    } catch (error) {
        console.error('Error verifying access:', error);
        return res.status(500).json({
            error: 'Internal server error',
            isPro: false
        });
    }
}
