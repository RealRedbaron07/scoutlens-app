/**
 * ScoutLens - Payment Webhook Handler
 * 
 * Receives webhooks from Stripe or PayPal when a payment/subscription event occurs,
 * and updates the Supabase database accordingly.
 * 
 * SETUP REQUIRED:
 * 1. Configure webhook in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 *    - Endpoint URL: https://your-domain.vercel.app/api/webhook-payment
 *    - Events to listen for: checkout.session.completed, customer.subscription.updated,
 *                            customer.subscription.deleted, invoice.payment_succeeded
 * 
 * 2. Add environment variables to Vercel:
 *    - STRIPE_WEBHOOK_SECRET: Your Stripe webhook signing secret (whsec_...)
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_KEY: Your service_role key
 * 
 * 3. For PayPal, configure IPN or Webhooks in PayPal Developer Dashboard
 *    - Add PAYPAL_WEBHOOK_ID to environment variables
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION
// ============================================

// Webhook secrets - ADD THESE TO VERCEL ENVIRONMENT VARIABLES
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

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
// STRIPE WEBHOOK VERIFICATION
// ============================================
async function verifyStripeSignature(req) {
    // In production, use Stripe's official library for verification
    // npm install stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const signature = req.headers['stripe-signature'];
    if (!signature || !STRIPE_WEBHOOK_SECRET) {
        return null;
    }

    // TODO: Replace with actual Stripe signature verification
    // const event = stripe.webhooks.constructEvent(
    //     req.body, // raw body
    //     signature,
    //     STRIPE_WEBHOOK_SECRET
    // );

    // For now, just parse the body (NOT SECURE - implement real verification)
    console.warn('⚠️ Stripe signature verification not fully implemented');
    return req.body;
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

async function activateProSubscription(email, customerId, endDate = null) {
    return updateSubscription(email, {
        is_pro: true,
        subscription_status: 'active',
        stripe_customer_id: customerId,
        subscription_end_date: endDate
    });
}

async function cancelSubscription(email) {
    return updateSubscription(email, {
        is_pro: false,
        subscription_status: 'cancelled'
    });
}

async function expireSubscription(email) {
    return updateSubscription(email, {
        is_pro: false,
        subscription_status: 'expired'
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
        // Determine payment provider from headers or body
        const isStripe = req.headers['stripe-signature'];
        const isPayPal = req.headers['paypal-transmission-id'];

        if (isStripe) {
            return await handleStripeWebhook(req, res);
        } else if (isPayPal) {
            return await handlePayPalWebhook(req, res);
        } else {
            console.warn('Unknown webhook source');
            return res.status(400).json({ error: 'Unknown payment provider' });
        }

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
}

// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================
async function handleStripeWebhook(req, res) {
    // Verify the webhook signature
    const event = await verifyStripeSignature(req);
    if (!event) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = event.type || req.body.type;
    const data = event.data?.object || req.body.data?.object;

    console.log(`📥 Stripe webhook: ${eventType}`);

    try {
        switch (eventType) {
            // ============================================
            // CHECKOUT COMPLETED (new subscription)
            // ============================================
            case 'checkout.session.completed': {
                const email = data.customer_email || data.customer_details?.email;
                const customerId = data.customer;

                if (email) {
                    // Calculate subscription end date (1 month or 1 year from now)
                    const mode = data.mode; // 'subscription' or 'payment'
                    let endDate = null;

                    if (mode === 'subscription') {
                        // Subscription will be managed by subscription.updated events
                        endDate = null; // Will be set by subscription event
                    } else {
                        // One-time payment - set 30 day access
                        endDate = new Date();
                        endDate.setDate(endDate.getDate() + 30);
                    }

                    await activateProSubscription(email, customerId, endDate?.toISOString());
                    console.log(`✅ Pro activated for ${email}`);
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION UPDATED (renewal, plan change)
            // ============================================
            case 'customer.subscription.updated': {
                const status = data.status;
                const customerId = data.customer;
                const currentPeriodEnd = data.current_period_end;

                // Get customer email from Stripe (requires API call in production)
                // const customer = await stripe.customers.retrieve(customerId);
                // const email = customer.email;

                // For now, get from metadata or use customer lookup
                const email = data.metadata?.email;

                if (email && status === 'active') {
                    await activateProSubscription(
                        email,
                        customerId,
                        new Date(currentPeriodEnd * 1000).toISOString()
                    );
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION CANCELLED
            // ============================================
            case 'customer.subscription.deleted': {
                const email = data.metadata?.email;
                if (email) {
                    await cancelSubscription(email);
                    console.log(`❌ Subscription cancelled for ${email}`);
                }
                break;
            }

            // ============================================
            // PAYMENT FAILED
            // ============================================
            case 'invoice.payment_failed': {
                const email = data.customer_email;
                if (email) {
                    // Optionally: Mark as past_due but don't immediately cancel
                    await updateSubscription(email, {
                        subscription_status: 'past_due'
                    });
                    console.log(`⚠️ Payment failed for ${email}`);
                }
                break;
            }

            default:
                console.log(`Unhandled Stripe event: ${eventType}`);
        }

        // Always return 200 to acknowledge receipt
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Error processing Stripe webhook:', error);
        // Still return 200 to prevent Stripe retries for processing errors
        return res.status(200).json({ received: true, error: error.message });
    }
}

// ============================================
// PAYPAL WEBHOOK HANDLER
// ============================================
async function handlePayPalWebhook(req, res) {
    // PayPal webhook verification
    // In production, verify the webhook signature using PayPal SDK
    // See: https://developer.paypal.com/docs/api/webhooks/v1/

    console.warn('⚠️ PayPal signature verification not fully implemented');

    const eventType = req.body.event_type;
    const resource = req.body.resource;

    console.log(`📥 PayPal webhook: ${eventType}`);

    try {
        switch (eventType) {
            // ============================================
            // SUBSCRIPTION ACTIVATED
            // ============================================
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.CREATED': {
                const email = resource.subscriber?.email_address;
                const subscriptionId = resource.id;
                const nextBillingTime = resource.billing_info?.next_billing_time;

                if (email) {
                    await updateSubscription(email, {
                        is_pro: true,
                        subscription_status: 'active',
                        paypal_subscription_id: subscriptionId,
                        subscription_end_date: nextBillingTime || null
                    });
                    console.log(`✅ PayPal Pro activated for ${email}`);
                }
                break;
            }

            // ============================================
            // SUBSCRIPTION CANCELLED
            // ============================================
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.EXPIRED': {
                const email = resource.subscriber?.email_address;
                if (email) {
                    await cancelSubscription(email);
                    console.log(`❌ PayPal subscription cancelled for ${email}`);
                }
                break;
            }

            // ============================================
            // PAYMENT COMPLETED (one-time or recurring)
            // ============================================
            case 'PAYMENT.SALE.COMPLETED': {
                // Handle one-time payments
                const email = resource.payer?.payer_info?.email;
                if (email) {
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + 30); // 30 days access

                    await activateProSubscription(email, null, endDate.toISOString());
                    console.log(`✅ PayPal payment completed for ${email}`);
                }
                break;
            }

            default:
                console.log(`Unhandled PayPal event: ${eventType}`);
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Error processing PayPal webhook:', error);
        return res.status(200).json({ received: true, error: error.message });
    }
}
