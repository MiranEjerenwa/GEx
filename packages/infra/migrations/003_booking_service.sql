-- Migration: Booking Service schema
-- Database: egp_booking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gift_card_id UUID NOT NULL UNIQUE,
    experience_id UUID NOT NULL,
    time_slot_id UUID NOT NULL,
    partner_id UUID NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status booking_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE time_slot_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experience_id UUID NOT NULL,
    time_slot_id UUID NOT NULL,
    booking_id UUID NOT NULL REFERENCES bookings(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (time_slot_id, booking_id)
);
