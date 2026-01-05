/**
 * ScoutLens - Pro Access Verification API
 * 
 * SIMPLE MODE (Current): No database required
 * - Returns verification info based on configuration
 * - For manual Pro activation workflow
 * 
 * HOW IT WORKS:
 * 1. User pays via PayPal.me link
 * 2. User contacts you (email/DM) with their PayPal email
 * 3. You verify payment in PayPal dashboard
 * 4. You add their email to PRO_EMAILS list below
 * 5. User enters email in app → gets Pro access
 * 
 * UPGRADE PATH:
 * When you're ready for automatic activation, add Supabase.
 * See docs/supabase-schema.sql for setup instructions.
 */

// ============================================
// MANUAL PRO USER LIST
// ============================================
// Add verified Pro user emails here after confirming PayPal payment
// Format: 'email@example.com'
const PRO_EMAILS = new Set([
    // Add your Pro users here:
    // 'customer1@email.com',
    // 'customer2@email.com',
]);

// Your own email for testing (you always have Pro access)
const OWNER_EMAIL = 'mustafaalpari@gmail.com';
PRO_EMAILS.add(OWNER_EMAIL);

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
        const { email, token } = req.body;

        // ============================================
        // VERIFY BY EMAIL
        // ============================================
        if (email) {
            const normalizedEmail = email.toLowerCase().trim();

            // Basic email validation
            if (!normalizedEmail.includes('@')) {
                return res.status(400).json({
                    error: 'Invalid email format',
                    isPro: false
                });
            }

            // Check if email is in Pro list
            const isPro = PRO_EMAILS.has(normalizedEmail);

            if (isPro) {
                // Generate simple token for session
                const verificationToken = Buffer.from(JSON.stringify({
                    email: normalizedEmail,
                    verified: true,
                    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
                })).toString('base64');

                return res.status(200).json({
                    isPro: true,
                    verified: true,
                    token: verificationToken,
                    message: 'Pro access verified! Enjoy unlimited features.'
                });
            } else {
                return res.status(200).json({
                    isPro: false,
                    verified: true,
                    message: 'No Pro subscription found for this email. After paying, contact support with your PayPal email.'
                });
            }
        }

        // ============================================
        // VERIFY BY TOKEN (session refresh)
        // ============================================
        if (token) {
            try {
                const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

                // Check token expiry
                if (decoded.exp && decoded.exp < Date.now()) {
                    return res.status(200).json({
                        isPro: false,
                        verified: true,
                        message: 'Session expired. Please verify your email again.'
                    });
                }

                // Re-check if email is still in Pro list
                if (decoded.email && PRO_EMAILS.has(decoded.email.toLowerCase())) {
                    return res.status(200).json({
                        isPro: true,
                        verified: true,
                        email: decoded.email,
                        message: 'Pro access verified'
                    });
                }

            } catch (e) {
                // Token decode failed
            }

            return res.status(200).json({
                isPro: false,
                verified: true,
                message: 'Invalid or expired session'
            });
        }

        // No email or token provided
        return res.status(400).json({
            error: 'Email required',
            isPro: false
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({
            error: 'Server error',
            isPro: false
        });
    }
}
