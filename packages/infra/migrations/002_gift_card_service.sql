-- Migration: Gift Card Service schema
-- Database: egp_gift_card

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE gift_card_status AS ENUM ('purchased', 'delivered', 'redeemed');
CREATE TYPE redemption_outcome AS ENUM ('success', 'already_redeemed', 'invalid_code', 'concurrent_conflict', 'not_delivered');

CREATE TABLE gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE,
    experience_id UUID NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    redemption_code VARCHAR(20) NOT NULL UNIQUE,
    status gift_card_status NOT NULL DEFAULT 'purchased',
    delivered_at TIMESTAMP,
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE redemption_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    redemption_code VARCHAR(20) NOT NULL,
    requesting_ip VARCHAR(45) NOT NULL,
    outcome redemption_outcome NOT NULL,
    gift_card_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Gift card lifecycle trigger: purchased → delivered → redeemed only
CREATE OR REPLACE FUNCTION enforce_gift_card_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'purchased' AND NEW.status != 'delivered' THEN
        RAISE EXCEPTION 'Invalid transition from purchased: only delivered is allowed';
    END IF;
    IF OLD.status = 'delivered' AND NEW.status != 'redeemed' THEN
        RAISE EXCEPTION 'Invalid transition from delivered: only redeemed is allowed';
    END IF;
    IF OLD.status = 'redeemed' THEN
        RAISE EXCEPTION 'Cannot transition from redeemed: terminal state';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_gift_card_lifecycle
    BEFORE UPDATE OF status ON gift_cards
    FOR EACH ROW
    EXECUTE FUNCTION enforce_gift_card_lifecycle();
