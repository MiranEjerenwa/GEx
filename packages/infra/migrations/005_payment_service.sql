-- Migration: Payment Service schema
-- Database: egp_payment

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE payment_split_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE partner_stripe_status AS ENUM ('pending', 'active', 'restricted');

CREATE TABLE commission_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID UNIQUE,
    rate_percent DECIMAL(5,2) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default commission rate (17.5%)
INSERT INTO commission_rates (id, partner_id, rate_percent, is_default)
VALUES (uuid_generate_v4(), NULL, 17.50, true);

CREATE TABLE payment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE,
    partner_id UUID NOT NULL,
    stripe_payment_intent_id VARCHAR(255) NOT NULL,
    stripe_transfer_id VARCHAR(255),
    total_amount_cents INTEGER NOT NULL,
    platform_amount_cents INTEGER NOT NULL,
    partner_amount_cents INTEGER NOT NULL,
    commission_rate_percent DECIMAL(5,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status payment_split_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_splits_partner ON payment_splits (partner_id);
CREATE INDEX idx_payment_splits_order ON payment_splits (order_id);

CREATE TABLE partner_stripe_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL UNIQUE,
    stripe_account_id VARCHAR(255) NOT NULL UNIQUE,
    status partner_stripe_status NOT NULL DEFAULT 'pending',
    payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
