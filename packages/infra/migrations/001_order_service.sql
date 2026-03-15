-- Migration: Order Service schema
-- Database: egp_order

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(20) NOT NULL UNIQUE,
    purchaser_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    personalized_message TEXT,
    experience_id UUID NOT NULL,
    occasion VARCHAR(100) NOT NULL,
    occasion_template_id UUID,
    age_group_context VARCHAR(50),
    wishlist_item_id UUID,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    stripe_payment_intent_id VARCHAR(255),
    payment_status payment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_reference ON orders (reference_number);
CREATE INDEX idx_orders_purchaser_email ON orders (purchaser_email);
CREATE INDEX idx_orders_recipient_email ON orders (recipient_email);
