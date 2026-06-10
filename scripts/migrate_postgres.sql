-- MomentBrand AI PostgreSQL schema

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    brand_name TEXT NOT NULL,
    tagline TEXT,
    tagline_bn TEXT,
    industry TEXT,
    target_audience TEXT,
    brand_personality JSONB,
    colors JSONB NOT NULL DEFAULT '{}'::jsonb,
    typography JSONB NOT NULL DEFAULT '{}'::jsonb,
    logo_url TEXT,
    product_image_url TEXT,
    voice JSONB,
    do_not_use JSONB,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendarific_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'calendarific',
    country TEXT NOT NULL,
    year INT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_opportunities (
    id TEXT PRIMARY KEY,
    calendarific_event_id TEXT REFERENCES calendarific_events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT,
    event_date DATE,
    "window" TEXT,
    days INT,
    relevance INT NOT NULL DEFAULT 70,
    risk TEXT NOT NULL DEFAULT 'low',
    risk_note TEXT,
    audience TEXT,
    hist TEXT,
    trend TEXT,
    emoji TEXT,
    recommended BOOLEAN NOT NULL DEFAULT FALSE,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    brand_id TEXT,
    event_id TEXT REFERENCES event_opportunities(id) ON DELETE SET NULL,
    campaign_name TEXT NOT NULL,
    campaign_strategy TEXT,
    adherence_level TEXT CHECK (adherence_level IN ('strict', 'moderate', 'creative')),
    language TEXT CHECK (language IN ('en', 'bn', 'both')),
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout JSONB NOT NULL DEFAULT '{}'::jsonb,
    concept JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    blueprint JSONB,
    poster_1x1_url TEXT,
    poster_9x16_url TEXT,
    poster_16x9_url TEXT,
    background_url TEXT,
    generation_time_seconds FLOAT,
    model_used TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS campaigns
    ADD COLUMN IF NOT EXISTS concept JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ad_variants (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    letter TEXT NOT NULL,
    angle TEXT NOT NULL,
    emotion TEXT,
    headline TEXT NOT NULL,
    primary_text TEXT NOT NULL,
    cta TEXT,
    visual TEXT,
    platform TEXT,
    audience_segment TEXT,
    placement TEXT,
    ip_status TEXT NOT NULL DEFAULT 'clear',
    risk TEXT NOT NULL DEFAULT 'low',
    ip_note TEXT,
    gradient TEXT,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, letter)
);

CREATE TABLE IF NOT EXISTS campaign_agent_runs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running',
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    models JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    video_plan JSONB,
    video_url TEXT,
    duration_sec FLOAT,
    aspect_ratio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain_analyses (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_name TEXT,
    source_filename TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    overall_score FLOAT,
    response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    brain_activation_image_url TEXT,
    neuromarketing_chart_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_event_id ON campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_country_year ON calendarific_events(country, year);
CREATE INDEX IF NOT EXISTS idx_opportunities_event_date ON event_opportunities(event_date);
CREATE INDEX IF NOT EXISTS idx_ad_variants_campaign_id ON ad_variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_agent_runs_campaign_id ON campaign_agent_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_agent_runs_created_at ON campaign_agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_analyses_campaign_id ON brain_analyses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_brain_analyses_created_at ON brain_analyses(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_opportunities_updated_at ON event_opportunities;
CREATE TRIGGER update_event_opportunities_updated_at
    BEFORE UPDATE ON event_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brain_analyses_updated_at ON brain_analyses;
CREATE TRIGGER update_brain_analyses_updated_at
    BEFORE UPDATE ON brain_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_agent_runs_updated_at ON campaign_agent_runs;
CREATE TRIGGER update_campaign_agent_runs_updated_at
    BEFORE UPDATE ON campaign_agent_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
