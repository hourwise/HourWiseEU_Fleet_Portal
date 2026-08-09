import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('BATCH 5 workflow security contracts', () => {
  it('removes manager join-by-driver-code and browser auth-code generation', () => {
    const signup = read('src/components/auth/SignupForm.tsx');
    const settings = read('src/components/manager/CompanySettings.tsx');
    expect(signup).not.toContain('Join Existing');
    expect(signup).not.toContain('Supervisor Signup');
    expect(signup).not.toContain(".eq('auth_code'");
    expect(settings).not.toContain('Math.random');
    expect(settings).toContain("rpc('rotate_company_auth_code'");
  });

  it('defines server-authorized rotation and separate expense review boundaries', () => {
    const rotation = read('supabase/migrations/20260809201940_govern_fleet_authorization_codes.sql');
    const review = read('supabase/migrations/20260809201941_add_fin002_expense_review.sql');
    expect(rotation).toContain('gen_random_bytes');
    expect(rotation).toContain('created_by = actor_id');
    expect(rotation).toContain('revoke all on function public.rotate_company_auth_code() from anon');
    expect(rotation).toContain('record_security_event');
    expect(review).toContain('create table if not exists public.expense_reviews');
    expect(review).toContain("p_decision not in ('approved', 'rejected')");
    expect(review).toContain('p_expected_updated_at');
    expect(review).toContain('review_expense');
    expect(review).toContain('finance.expense.review');
    expect(review).toContain('revoke all on function public.review_expense');
  });
});
