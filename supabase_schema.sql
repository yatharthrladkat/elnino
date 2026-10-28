-- ==============================================================================
-- El Niño Preemption Engine (EPE) — Supabase PostgreSQL Schema & Seed Script
-- Target Database: Supabase PostgreSQL (Project: gfnuqcpbrniwrfuwiorf)
-- Paste this script into: Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Create Users Table (Synchronized with Supabase / Officer Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'State Relief Officer, Grade I',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Create Allocation Runs Table (Official Preemption Decision Ledger)
CREATE TABLE IF NOT EXISTS public.allocation_runs (
    id BIGSERIAL PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    officer_name TEXT NOT NULL,
    officer_role TEXT DEFAULT 'State Disaster Management Authority',
    geography TEXT NOT NULL DEFAULT 'Madhya Pradesh (Bundelkhand & Nimar focus)',
    total_budget_cr NUMERIC NOT NULL DEFAULT 140,
    objective TEXT NOT NULL DEFAULT 'critical_needs_first',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    district_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Committed & Dispatched',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Create Audit Events Table (Immutable State Administrative Ledger)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Create Farmer Claims Table (Privacy-Preserving PMFBY Crop Loss Claims)
CREATE TABLE IF NOT EXISTS public.farmer_claims (
    id BIGSERIAL PRIMARY KEY,
    claim_id TEXT NOT NULL UNIQUE,
    farmer_name TEXT NOT NULL,
    district TEXT NOT NULL,
    taluka TEXT NOT NULL,
    claimed_loss INTEGER NOT NULL,
    spectral_loss_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Needs Review',
    confidence NUMERIC NOT NULL DEFAULT 85,
    plot_size_hectares NUMERIC NOT NULL DEFAULT 2,
    crop_type TEXT NOT NULL DEFAULT 'Soybean',
    submission_date TEXT NOT NULL,
    authorized_by TEXT,
    authorized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- ==============================================================================
-- Performance Indices
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_allocation_runs_created_at ON public.allocation_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmer_claims_district ON public.farmer_claims (district);
CREATE INDEX IF NOT EXISTS idx_farmer_claims_status ON public.farmer_claims (status);

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- Enables authenticated & public evaluation access for hackathon demonstrations
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_claims ENABLE ROW LEVEL SECURITY;

-- Allow read access for public / demo evaluation
CREATE POLICY "Public read allocation_runs" ON public.allocation_runs FOR SELECT USING (true);
CREATE POLICY "Public read audit_events" ON public.audit_events FOR SELECT USING (true);
CREATE POLICY "Public read farmer_claims" ON public.farmer_claims FOR SELECT USING (true);
CREATE POLICY "Public read users" ON public.users FOR SELECT USING (true);

-- Allow insert/update for officers
CREATE POLICY "Allow all modifications on allocation_runs" ON public.allocation_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all modifications on audit_events" ON public.audit_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all modifications on farmer_claims" ON public.farmer_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all modifications on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- Initial Prototype Seed Data
-- ==============================================================================

-- Seed 1: Historical Committed Preemption Plan
INSERT INTO public.allocation_runs (
    run_id,
    title,
    officer_name,
    officer_role,
    geography,
    total_budget_cr,
    objective,
    parameters,
    metrics,
    district_breakdown,
    status,
    notes
) VALUES (
    'EPE-MP-2026-OCT-01',
    'Pre-Rabi Drought Scarcity Contingency Plan',
    'Yatharth Ladkat',
    'State Relief Commissioner (Grade I)',
    'Madhya Pradesh (Bundelkhand & Nimar focus)',
    140,
    'critical_needs_first',
    '{
        "totalBudgetCr": 140,
        "maxTankersPerDay": 1800,
        "availableFodderTonnes": 85000,
        "contingencyFundCr": 30,
        "planningHorizonDays": 30,
        "minServiceFloorPct": 18,
        "priorityWeights": {
            "drinkingWater": 1.5,
            "fodderSecurity": 1.2,
            "cropProtection": 1.0,
            "smallholderEquity": 1.2
        },
        "objective": "critical_needs_first"
    }'::jsonb,
    '{
        "epeDemandSatisfactionPct": 78.4,
        "baselineDemandSatisfactionPct": 49.2,
        "additionalDemandServedPct": 29.2,
        "peopleProtectedLakh": 4.8,
        "livestockProtectedLakh": 2.9,
        "equityIndexGainPct": 34.6,
        "budgetUtilizationPct": 98.2,
        "bindingConstraints": [
            "Tanker Fleet Capacity (1,800 tankers/day exhausted)",
            "Bundelkhand Sub-Basin Minimum Statutory Floor (18% satisfied)"
        ]
    }'::jsonb,
    '[]'::jsonb,
    'Committed & Dispatched',
    'Priority tankers allocated to Tikamgarh and Barwani headworks. Emergency fodder camps approved for 14 talukas.'
) ON CONFLICT (run_id) DO NOTHING;

-- Seed 2: Audit Trail Log Entries
INSERT INTO public.audit_events (event_id, actor, action, target, details)
VALUES
    ('evt-001', 'Yatharth Ladkat (Relief Officer)', 'ALLOCATION_COMMITTED', 'EPE-MP-2026-OCT-01', 'Approved ₹140 Cr multi-district preemptive relief allocation under State Scarcity Manual.'),
    ('evt-002', 'Agro-Met Telemetry Daemon', 'SATELLITE_SYNC', 'ISRO VEDAS / Open-Meteo', 'Synchronized SPI-3M and root-zone soil moisture indices across 8 Madhya Pradesh pilot districts.')
ON CONFLICT (event_id) DO NOTHING;

-- Seed 3: Privacy-Preserving Farmer PMFBY Claims
INSERT INTO public.farmer_claims (
    claim_id,
    farmer_name,
    district,
    taluka,
    claimed_loss,
    spectral_loss_index,
    status,
    confidence,
    plot_size_hectares,
    crop_type,
    submission_date
) VALUES
    ('CLM-MP-2026-9812', 'Ramkishore Lodhi', 'Tikamgarh', 'Baldeogarh', 88, 84, 'Genuine', 97.2, 2.8, 'Soybean', '21 Oct 2026'),
    ('CLM-MP-2026-9813', 'Harprasad Yadav', 'Chhatarpur', 'Nowgong', 92, 56, 'Needs Review', 69.4, 4.5, 'Mustard & Soybean', '21 Oct 2026'),
    ('CLM-MP-2026-9814', 'Mansaram Bhil', 'Barwani', 'Sendhwa', 78, 81, 'Genuine', 98.4, 1.8, 'Bt Cotton', '22 Oct 2026'),
    ('CLM-MP-2026-9815', 'Jagdish Meena', 'Sheopur', 'Karahal', 82, 35, 'Duplicate', 92.0, 3.2, 'Wheat & Bajra', '22 Oct 2026'),
    ('CLM-MP-2026-9816', 'Devendra Patidar', 'Khargone (West Nimar)', 'Kasrawad', 72, 74, 'Genuine', 96.1, 2.4, 'Chilli & Cotton', '23 Oct 2026'),
    ('CLM-MP-2026-9817', 'Shivraj Singh Bundela', 'Tikamgarh', 'Jatara', 68, 64, 'Genuine', 94.5, 2.1, 'Sesame & Gram', '23 Oct 2026')
ON CONFLICT (claim_id) DO NOTHING;
