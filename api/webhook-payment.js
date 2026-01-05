/**
 * ScoutLens - PayPal Payment Webhook Handler
 * 
 * Receives webhooks from PayPal when a payment/subscription event occurs,
 * and updates the Supabase database to activate Pro access.
 * 
 * SETUP REQUIRED:
 * 1. Configure webhook in PayPal Developer Dashboard:
 *    - Go to: https://developer.paypal.com/dashboard/webhooks
 *    - Add webhook URL: https://your-domain.vercel.app/api/webhook-payment
 *    - Subscribe to events:
 *      • BILLING.SUBSCRIPTION.ACTIVATED
 *      • BILLING.SUBSCRIPTION.CANCELLED
 *      • BILLING.SUBSCRIPTION.EXPIRED
 *      • PAYMENT.SALE.COMPLETED
 * 
 * 2. Add environment variables to Vercel:
 *    - PAYPAL_WEBHOOK_ID: Your webhook ID from PayPal dashboard
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_KEY: Your service_role key
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION
// ============================================

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

function getSupabaseClient() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });
}

// ============================================
// PAYPAL WEBHOOK SIGNATURE VERIFICATION
// ============================================
async function verifyPayPalWebhook(req) {
    // In production, verify the webhook signature using PayPal's API
    // See: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

    // Required headers from PayPal
    const transmissionId = req.headers['paypal-transmission-id'];
    const timestamp = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !timestamp || !transmissionSig) {
        console.warn('Missing PayPal signature headers');
        return false;
    }

    // TODO: Implement full signature verification
    // For now, we check that required headers are present
    // In production, call PayPal's verify-webhook-signature API

    console.log('📥 PayPal webhook received:', {
        transmissionId,
        timestamp,
        hasSignature: !!transmissionSig
    });

    return true; // In production, return actual verification result
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function updateSubscription(email, updates) {
    const supabase = getSupabaseClient();

    // Upsert: Update if exists, insert if not
    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            email: email.toLowerCase().trim(),
            ...updates,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'email'
        })
        .select()
        .single();

    if (error) {
        console.error('Database error:', error);
        throw error;
    }

    console.log(`✅ Updated subscription for ${email}:`, updates);
    return data;
}

async function activateProSubscription(email, subscriptionId, endDate = null) {
    return updateSubscription(email, {
        is_pro: true,
        subscription_status: 'active',
        paypal_subscription_id: subscriptionId,
        subscription_end_date: endDate
    });
}

async function cancelSubscription(email) {
    return updateSubscription(email, {
        is_pro: false,
        subscription_status: 'cancelled'
    });
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================
export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify the webhook is from PayPal
        const isValid = await verifyPayPalWebhook(req);
        if (!isValid) {
            console.error('Invalid PayPal webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const eventType = req.body.event_type;
        const resource = req.body.resource;

        console.log(`📥 PayPal webhook: ${eventType}`);

        // Check if Supabase is configured
        if (!supabaseUrl || !supabaseServiceKey) {
            console.warn('⚠️ Supabase not configured - webhook received but cannot update database');
            return res.status(200).json({
                received: true,
                warning: 'Database not configured'
            });
        }

        switch (eventType) {
            // ============================================
            // SUBSCRIPTION ACTIVATED (new subscription)
            // ============================================
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.CREATED': {
                const email = resource.subscriber?.email_address;
                const subscriptionId = resource.id;
                const nextBillingTime = resource.billing_info?.next_billing_time;

                if (email) {
                    await activateProSubscription(
                        email,
                        subscriptionId,
                        nextBillingTime || null
                    );
                    console.log(`✅ PayPal Pro activated for ${email}`);
                } else {
                    console.warn('No email in subscription data:', resource);
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION RENEWED (recurring payment)
            // ============================================
            case 'BILLING.SUBSCRIPTION.RENEWED': {
                const email = resource.subscriber?.email_address;
                const subscriptionId = resource.id;
                const nextBillingTime = resource.billing_info?.next_billing_time;

                if (email) {
                    await activateProSubscription(
                        email,
                        subscriptionId,
                        nextBillingTime || null
                    );
                    console.log(`🔄 PayPal subscription renewed for ${email}`);
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION CANCELLED
            // ============================================
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED': {
                const email = resource.subscriber?.email_address;
                if (email) {
                    await cancelSubscription(email);
                    console.log(`❌ PayPal subscription cancelled for ${email}`);
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION EXPIRED
            // ============================================
            case 'BILLING.SUBSCRIPTION.EXPIRED': {
                const email = resource.subscriber?.email_address;
                if (email) {
                    await updateSubscription(email, {
                        is_pro: false,
                        subscription_status: 'expired'
                    });
                    console.log(`⏰ PayPal subscription expired for ${email}`);
                }
                break;
            }

            // ============================================
            // ONE-TIME PAYMENT COMPLETED
            // ============================================
            case 'PAYMENT.SALE.COMPLETED': {
                // Handle one-time payments (non-subscription)
                const payerEmail = resource.payer?.email_address ||
                    resource.payer_info?.email;

                if (payerEmail) {
                    // Give 30 days of Pro access for one-time payment
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + 30);

                    await updateSubscription(payerEmail, {
                        is_pro: true,
                        subscription_status: 'active',
                        subscription_end_date: endDate.toISOString()
                    });
                    console.log(`✅ PayPal payment completed for ${payerEmail} (30 days Pro)`);
                } else {
                    console.warn('No payer email in payment data:', resource);
                }
                break;
            }

            // ============================================
            // PAYMENT FAILED
            // ============================================
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
                const email = resource.subscriber?.email_address;
                if (email) {
                    await updateSubscription(email, {
                        subscription_status: 'past_due'
                    });
                    console.log(`⚠️ PayPal payment failed for ${email}`);
                }
                break;
            }

            default:
                console.log(`Unhandled PayPal event: ${eventType}`);
        }

        // Always return 200 to acknowledge receipt
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        // Still return 200 to prevent PayPal retries for processing errors
        return res.status(200).json({
            received: true,
            error: error.message
        });
    }
}
