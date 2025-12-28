-- OPENTICKET SUPABASE INITIALIZATION SCRIPT (REVISED)
-- WARNING: This will drop existing openticket tables to ensure correct types.
-- Only run this if you don't have existing migration data you need to keep.

-- Drop in reverse order of dependencies with CASCADE for robustness
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.ticket_tiers CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE public.profiles (
    id TEXT PRIMARY KEY, -- Firebase UID
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    image_url TEXT,
    role TEXT DEFAULT 'attendee',
    is_admin BOOLEAN DEFAULT FALSE,
    business_name TEXT,
    available_payout NUMERIC DEFAULT 0,
    balance_due NUMERIC DEFAULT 0,
    subscription JSONB,
    address JSONB,
    socials JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Events Table
CREATE TABLE public.events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    event_type TEXT,
    date DATE,
    time TIME,
    location TEXT,
    image_url TEXT,
    price NUMERIC DEFAULT 0,
    price_type TEXT,
    capacity INTEGER,
    is_draft BOOLEAN DEFAULT TRUE,
    visibility TEXT DEFAULT 'public',
    payment_config JSONB,
    waiver_config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ticket Tiers Table
CREATE TABLE public.ticket_tiers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    capacity INTEGER NOT NULL
);

-- 4. Registrations Table
CREATE TABLE public.registrations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    approval_status TEXT DEFAULT 'pending',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    answers JSONB,
    promo_code_used TEXT,
    stripe_session_id TEXT,
    tickets JSONB
);

-- 5. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Users can manage own profiles" ON public.profiles FOR ALL USING (id = auth.uid()::text);
CREATE POLICY "Owners can manage own events" ON public.events FOR ALL USING (owner_id = auth.uid()::text);
CREATE POLICY "Public can view non-draft events" ON public.events FOR SELECT USING (visibility = 'public' AND is_draft = false);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_id ON public.ticket_tiers(event_id);
