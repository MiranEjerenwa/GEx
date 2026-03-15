import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './base.repository';

export interface Booking {
  id: string;
  gift_card_id: string;
  experience_id: string;
  time_slot_id: string;
  partner_id: string;
  recipient_email: string;
  status: string;
  created_at: Date;
}

type BookingRow = {
  id: string;
  gift_card_id: string;
  experience_id: string;
  time_slot_id: string;
  partner_id: string;
  recipient_email: string;
  status: string;
  created_at: Date;
};

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    gift_card_id: row.gift_card_id,
    experience_id: row.experience_id,
    time_slot_id: row.time_slot_id,
    partner_id: row.partner_id,
    recipient_email: row.recipient_email,
    status: row.status,
    created_at: row.created_at,
  };
}

export interface CreateBookingInput {
  gift_card_id: string;
  experience_id: string;
  time_slot_id: string;
  partner_id: string;
  recipient_email: string;
}

/**
 * Create a booking and reserve the time slot atomically.
 * Enforces capacity by checking existing reservations for the time slot.
 */
export async function createWithReservation(
  input: CreateBookingInput,
  capacity: number,
): Promise<Booking> {
  return withTransaction(async (client) => {
    // Check if booking already exists for this gift card (idempotency)
    const existing = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE gift_card_id = $1',
      [input.gift_card_id],
    );
    if (existing.rows[0]) {
      return toBooking(existing.rows[0]);
    }

    // Check capacity: count existing reservations for this time slot
    const countResult = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM time_slot_reservations WHERE time_slot_id = $1',
      [input.time_slot_id],
    );
    const currentCount = parseInt(countResult.rows[0].count, 10);
    if (currentCount >= capacity) {
      throw new BookingError('TIME_SLOT_FULL', 'Time slot is at capacity', 409);
    }

    // Create booking
    const bookingId = uuidv4();
    const bookingResult = await client.query<BookingRow>(
      `INSERT INTO bookings (id, gift_card_id, experience_id, time_slot_id, partner_id, recipient_email, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', NOW())
       RETURNING *`,
      [bookingId, input.gift_card_id, input.experience_id, input.time_slot_id, input.partner_id, input.recipient_email],
    );

    // Create time slot reservation
    const reservationId = uuidv4();
    await client.query(
      `INSERT INTO time_slot_reservations (id, experience_id, time_slot_id, booking_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [reservationId, input.experience_id, input.time_slot_id, bookingId],
    );

    return toBooking(bookingResult.rows[0]);
  });
}

export async function getById(id: string): Promise<Booking | null> {
  const result = await query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [id]);
  return result.rows[0] ? toBooking(result.rows[0]) : null;
}

export async function getByGiftCardId(giftCardId: string): Promise<Booking | null> {
  const result = await query<BookingRow>(
    'SELECT * FROM bookings WHERE gift_card_id = $1',
    [giftCardId],
  );
  return result.rows[0] ? toBooking(result.rows[0]) : null;
}

export async function getByPartnerId(partnerId: string): Promise<Booking[]> {
  const result = await query<BookingRow>(
    'SELECT * FROM bookings WHERE partner_id = $1 ORDER BY created_at DESC',
    [partnerId],
  );
  return result.rows.map(toBooking);
}

export async function getPastBookings(beforeDate: Date): Promise<Booking[]> {
  const result = await query<BookingRow>(
    `SELECT b.* FROM bookings b
     WHERE b.status = 'confirmed' AND b.created_at < $1
     ORDER BY b.created_at DESC`,
    [beforeDate],
  );
  return result.rows.map(toBooking);
}

export class BookingError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
