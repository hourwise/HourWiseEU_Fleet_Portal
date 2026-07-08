# SEC-010 - Shadow Permission Comparison For Tachograph Import Metadata Patch

Date: 2026-07-08
Status: implemented locally; deployment pending

## Scope

Add a shadow permission comparison to `public.patch_tachograph_import_metadata` without changing runtime enforcement.

## Implemented Change

Migration:

```text
supabase/migrations/20260708120000_shadow_permission_patch_tachograph_import_metadata.sql
```

The migration replaces `public.patch_tachograph_import_metadata(uuid, jsonb)` and preserves the existing authoritative checks:

- caller legacy role must be `manager`
- import row must belong to `public.get_my_company_id()`
- non-manager callers still receive `Only managers can patch tachograph import metadata`
- missing or cross-company imports still receive `Tachograph import not found for current company`

The migration adds shadow-only comparison:

- legacy decision: `actor_role = 'manager' and target_company_id = actor_company_id`
- permission decision: `public.actor_has_permission('tachograph.import.update', target_company_id, null)`
- mismatch audit: `public.record_security_event(...)` with reason `shadow_permission_mismatch`
- audit metadata includes `legacy_allowed`, `permission_allowed`, `legacy_role`, `actor_company_id`, and `shadow_comparison`

Shadow comparison failures are caught and emitted as PostgreSQL warnings so the runtime RPC path remains governed by the legacy checks.

## Out Of Scope

- No permission-result enforcement swap.
- No RLS policy replacement.
- No role grant changes.
- No site-scope enablement.

## Test Coverage

Static regression test:

```text
src/lib/security/sec010ShadowPermission.test.ts
```

Coverage asserts that:

- the RPC remains `security definer` with fixed `search_path`
- authenticated execute is retained
- legacy manager/company enforcement remains authoritative
- `actor_has_permission('tachograph.import.update', target_company_id, null)` is evaluated only as shadow comparison input
- mismatch audits include the expected metadata
- shadow/audit failures do not fail the RPC

Run:

```bash
npm run test:rules
```

## Deployment Verification

After applying the migration to Supabase, verify the function definition includes the shadow comparison:

```sql
select pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure);
```

Then perform a normal manager metadata patch and confirm application behaviour is unchanged.

To inspect mismatches:

```sql
select
  created_at,
  actor_user_id,
  company_id,
  permission_key,
  decision,
  reason,
  resource_type,
  resource_id,
  operation,
  metadata
from public.security_permission_audit_events
where reason = 'shadow_permission_mismatch'
  and permission_key = 'tachograph.import.update'
order by created_at desc
limit 50;
```

Expected steady-state result after SEC-009 role backfill: no mismatch rows for normal fleet administrator metadata patch activity.

## Rollback

Rollback by reapplying the previous `patch_tachograph_import_metadata` function body from:

```text
supabase/migrations/20260703090000_harden_tachograph_storage_rls.sql
```

Do not remove the SEC-007 permission foundation tables or audit tables for this rollback.
