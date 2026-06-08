/**
 * Admin accounts get unlimited, premium-level access (no daily quota, no 30s preview,
 * no watermark). Matched by email allowlist — never store passwords here.
 */
export const ADMIN_EMAILS = ['ramtejaramteja9322@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
