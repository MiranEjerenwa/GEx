import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';

export interface Partner {
  id: string;
  business_name: string;
  contact_email: string;
  business_description: string | null;
  status: string;
  cognito_user_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_status: string | null;
  created_at: Date;
  updated_at: Date;
}

type PartnerRow = {
  id: string;
  business_name: string;
  contact_email: string;
  business_description: string | null;
  status: string;
  cognito_user_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_status: string | null;
  created_at: Date;
  updated_at: Date;
};

function toPartner(row: PartnerRow): Partner {
  return { ...row };
}

export interface CreatePartnerInput {
  business_name: string;
  contact_email: string;
  business_description?: string;
}

export async function create(input: CreatePartnerInput): Promise<Partner> {
  const id = uuidv4();
  const now = new Date();
  const result = await query<PartnerRow>(
    `INSERT INTO partners (id, business_name, contact_email, business_description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)
     RETURNING *`,
    [id, input.business_name, input.contact_email, input.business_description ?? null, now, now],
  );
  return toPartner(result.rows[0]);
}

export async function getById(id: string): Promise<Partner | null> {
  const result = await query<PartnerRow>('SELECT * FROM partners WHERE id = $1', [id]);
  return result.rows[0] ? toPartner(result.rows[0]) : null;
}

export async function getByEmail(email: string): Promise<Partner | null> {
  const result = await query<PartnerRow>(
    'SELECT * FROM partners WHERE contact_email = $1',
    [email],
  );
  return result.rows[0] ? toPartner(result.rows[0]) : null;
}

export async function getAll(): Promise<Partner[]> {
  const result = await query<PartnerRow>(
    'SELECT * FROM partners ORDER BY created_at DESC',
  );
  return result.rows.map(toPartner);
}

export async function updateStripeConnect(
  id: string,
  stripeAccountId: string,
  stripeStatus: string,
): Promise<Partner | null> {
  const now = new Date();
  const result = await query<PartnerRow>(
    `UPDATE partners
     SET stripe_connect_account_id = $2, stripe_connect_status = $3, updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, stripeAccountId, stripeStatus, now],
  );
  return result.rows[0] ? toPartner(result.rows[0]) : null;
}

export async function updateStatus(id: string, status: string): Promise<Partner | null> {
  const now = new Date();
  const result = await query<PartnerRow>(
    `UPDATE partners SET status = $2, updated_at = $3 WHERE id = $1 RETURNING *`,
    [id, status, now],
  );
  return result.rows[0] ? toPartner(result.rows[0]) : null;
}

export async function setCognitoUserId(id: string, cognitoUserId: string): Promise<Partner | null> {
  const now = new Date();
  const result = await query<PartnerRow>(
    `UPDATE partners SET cognito_user_id = $2, updated_at = $3 WHERE id = $1 RETURNING *`,
    [id, cognitoUserId, now],
  );
  return result.rows[0] ? toPartner(result.rows[0]) : null;
}
