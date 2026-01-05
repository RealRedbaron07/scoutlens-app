/**
 * ScoutLens - Pro Access Verification API
 * 
 * Production-ready endpoint that verifies Pro subscription status
 * using Supabase as the backend database.
 * 
 * SETUP REQUIRED:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Run docs/supabase-schema.sql in the SQL Editor
 * 3. Add environment variables to Vercel:
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_KEY: Your service_role key (NOT anon key)
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for full access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
function getSupabaseClient() {
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase environment variables');
        return null;
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });
}

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

        // Initialize Supabase
        const supabase = getSupabaseClient();

        // Fallback to mock mode if Supabase not configured
        if (!supabase) {
            console.warn('⚠️ Supabase not configured - running in mock mode');
            return res.status(200).json({
                isPro: false,
                verified: true,
                message: 'Database not configured - mock mode',
                mockMode: true
            });
        }

        // ============================================
        // OPTION 1: Verify by Email
        // ============================================
        if (email) {
            if (typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({
                    error: 'Invalid email format',
                    isPro: false
                });
            }

            // Query the profiles table
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('id, email, is_pro, subscription_status, subscription_end_date')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows returned (not an error, just no user)
                console.error('Database error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    isPro: false
                });
            }

            // User not found
            if (!profile) {
                return res.status(200).json({
                    isPro: false,
                    verified: true,
                    message: 'No subscription found for this email'
                });
            }

            // Check if subscription is active AND not expired
            const now = new Date();
            const endDate = profile.subscription_end_date
                ? new Date(profile.subscription_end_date)
                : null;

            const isActive = profile.is_pro === true &&
                profile.subscription_status === 'active' &&
                (!endDate || endDate > now);

            // Generate a simple verification token (in production, use JWT)
            const verificationToken = isActive
                ? Buffer.from(JSON.stringify({
                    email: profile.email,
                    verified: true,
                    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiry
                })).toString('base64')
                : null;

            return res.status(200).json({
                isPro: isActive,
                verified: true,
                token: verificationToken,
                subscriptionStatus: profile.subscription_status,
                expiresAt: endDate ? endDate.toISOString() : null,
                message: isActive
                    ? 'Pro access verified'
                    : 'Subscription not active'
            });
        }

        // ============================================
        // OPTION 2: Verify by Token (session refresh)
        // ============================================
        if (token) {
            try {
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

                // Re-verify against database to ensure subscription is still active
                if (decoded.email) {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('is_pro, subscription_status, subscription_end_date')
                        .eq('email', decoded.email)
                        .single();

                    if (error || !profile) {
                        return res.status(200).json({
                            isPro: false,
                            verified: true,
                            message: 'Subscription no longer valid'
                        });
                    }

                    const now = new Date();
                    const endDate = profile.subscription_end_date
                        ? new Date(profile.subscription_end_date)
                        : null;

                    const isActive = profile.is_pro === true &&
                        profile.subscription_status === 'active' &&
                        (!endDate || endDate > now);

                    return res.status(200).json({
                        isPro: isActive,
                        verified: true,
                        email: decoded.email,
                        message: isActive ? 'Token verified' : 'Subscription expired'
                    });
                }

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
