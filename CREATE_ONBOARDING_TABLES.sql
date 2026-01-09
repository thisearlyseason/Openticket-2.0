-- Onboarding Responses Table
CREATE TABLE IF NOT EXISTS onboarding_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    responses JSONB NOT NULL DEFAULT '{}',
    organization_type VARCHAR(50) DEFAULT 'individual',
    nonprofit_application_id UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_org_type ON onboarding_responses(organization_type);

-- Non-Profit Applications Table
CREATE TABLE IF NOT EXISTS nonprofit_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL,
    ein VARCHAR(50),
    document_url TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES profiles(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES profiles(id),
    rejection_reason TEXT,
    discount_code VARCHAR(50),
    magic_link_token UUID,
    magic_link_used BOOLEAN DEFAULT FALSE,
    magic_link_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nonprofit_user_id ON nonprofit_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_nonprofit_status ON nonprofit_applications(status);
CREATE INDEX IF NOT EXISTS idx_nonprofit_magic_token ON nonprofit_applications(magic_link_token);

-- Add nonprofit fields to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_status VARCHAR(20) CHECK (nonprofit_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_ein VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_doc_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nonprofit_discount_code VARCHAR(50);

-- Add nonprofit_application_id to promo_codes for tracking
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS nonprofit_application_id UUID REFERENCES nonprofit_applications(id);
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS target VARCHAR(50);
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS target_plans TEXT[];

-- Foreign key constraint for onboarding -> nonprofit application
ALTER TABLE onboarding_responses 
    ADD CONSTRAINT fk_onboarding_nonprofit 
    FOREIGN KEY (nonprofit_application_id) 
    REFERENCES nonprofit_applications(id) 
    ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE nonprofit_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_responses
CREATE POLICY "Users can view own onboarding" ON onboarding_responses
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

CREATE POLICY "Users can insert own onboarding" ON onboarding_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" ON onboarding_responses
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for nonprofit_applications
CREATE POLICY "Users can view own nonprofit apps" ON nonprofit_applications
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));

CREATE POLICY "Users can insert own nonprofit apps" ON nonprofit_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update nonprofit apps" ON nonprofit_applications
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    ));
