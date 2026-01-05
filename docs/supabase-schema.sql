-- ============================================
-- ScoutLens Database Schema for Supabase
-- ============================================
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql
--
-- This creates the profiles table for managing Pro subscriptions.

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Stores user subscription information
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    is_pro BOOLEAN DEFAULT FALSE,
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled', 'expired', 'trial')),
    subscription_end_date TIMESTAMPTZ,
    stripe_customer_id TEXT,
    paypal_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(is_pro, subscription_status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role (API) full access
CREATE POLICY "Service role has full access" ON profiles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Users can only read their own profile (if using Supabase Auth)
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.email() = email);

-- ============================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================
-- INSERT INTO profiles (email, is_pro, subscription_status)
-- VALUES ('test@example.com', true, 'active');
