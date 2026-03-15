-- Migration: Partner Service schema
-- Database: egp_partner

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE partner_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE onboarding_status AS ENUM ('pending_review', 'approved', 'rejected');
CREATE TYPE stripe_connect_status AS ENUM ('pending', 'active', 'restricted');

CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    business_description TEXT,
    status partner_status NOT NULL DEFAULT 'active',
    cognito_user_id VARCHAR(255) UNIQUE,
    stripe_connect_account_id VARCHAR(255) UNIQUE,
    stripe_connect_status stripe_connect_status DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE onboarding_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    business_description TEXT NOT NULL,
    experience_categories TEXT[] NOT NULL,
    status onboarding_status NOT NULL DEFAULT 'pending_review',
    rejection_reason TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
