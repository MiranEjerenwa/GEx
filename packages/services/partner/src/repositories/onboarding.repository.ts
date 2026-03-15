import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';

export interface OnboardingApplication {
  id: string;
  business_name: string;
  contact_email: string;
  business_description: string;
  experience_categories: string[];
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

type OnboardingRow = {
  id: string;
  business_name: string;
  contact_email: string;
  business_description: string;
  experience_categories: string[];
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

function toApplication(row: OnboardingRow): OnboardingApplication {
  return { ...row };
}

export interface CreateApplicationInput {
  business_name: string;
  contact_email: string;
  business_description: string;
  experience_categories: string[];
}

export async function create(input: CreateApplicationInput): Promise<OnboardingApplication> {
  const id = uuidv4();
  const result = await query<OnboardingRow>(
    `INSERT INTO onboarding_applications (id, business_name, contact_email, business_description, experience_categories, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending_review', NOW())
     RETURNING *`,
    [id, input.business_name, input.contact_email, input.business_description, input.experience_categories],
  );
  return toApplication(result.rows[0]);
}

export async function getById(id: string): Promise<OnboardingApplication | null> {
  const result = await query<OnboardingRow>(
    'SELECT * FROM onboarding_applications WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toApplication(result.rows[0]) : null;
}

export async function getPending(): Promise<OnboardingApplication[]> {
  const result = await query<OnboardingRow>(
    `SELECT * FROM onboarding_applications WHERE status = 'pending_review' ORDER BY created_at ASC`,
  );
  return result.rows.map(toApplication);
}

export async function approve(id: string, reviewedBy: string): Promise<OnboardingApplication | null> {
  const now = new Date();
  const result = await query<OnboardingRow>(
    `UPDATE onboarding_applications
     SET status = 'approved', reviewed_by = $2, reviewed_at = $3
     WHERE id = $1 AND status = 'pending_review'
     RETURNING *`,
    [id, reviewedBy, now],
  );
  return result.rows[0] ? toApplication(result.rows[0]) : null;
}

export async function reject(
  id: string,
  reviewedBy: string,
  rejectionReason: string,
): Promise<OnboardingApplication | null> {
  const now = new Date();
  const result = await query<OnboardingRow>(
    `UPDATE onboarding_applications
     SET status = 'rejected', reviewed_by = $2, reviewed_at = $3, rejection_reason = $4
     WHERE id = $1 AND status = 'pending_review'
     RETURNING *`,
    [id, reviewedBy, now, rejectionReason],
  );
  return result.rows[0] ? toApplication(result.rows[0]) : null;
}
