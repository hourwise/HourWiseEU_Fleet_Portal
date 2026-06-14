# Portal Supabase Security Fix Brief

Date: 2026-06-14

Audience: Codex agent working in the portal repo that owns the shared Supabase project.

## Context

The mobile app audit found several Supabase issues that appear to belong to the portal/backend project, not the mobile app. Fix these in the portal repo/Supabase project, then re-export policy/function metadata for verification.

Do not paste or commit secrets. The previously exported trigger metadata included service-role bearer tokens. Treat those tokens as compromised.

## P0: Rotate Exposed Supabase Service Secret

Problem:

- Database triggers for `broadcasts` and `tachograph_files` embed service-role bearer tokens in `supabase_functions.http_request(...)` headers.
- Those tokens were exposed through metadata export/chat.

Required fix:

1. Rotate the Supabase service-role/JWT secret for the project.
2. Replace hardcoded `Authorization: Bearer ...` trigger headers.
3. Use a secret-managed pattern instead:
   - Prefer Supabase Vault-backed SQL function, or
   - Move dispatch into an Edge Function with environment secrets, or
   - Use a portal-owned server job that signs requests outside database DDL.
4. Recreate affected triggers without embedded secrets.

Affected triggers:

- `public.broadcasts.on_new_broadcast`
- `public.tachograph_files.process_tacho_files`

Verification:

```sql
select
  event_object_table,
  trigger_name,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and action_statement ilike '%Bearer%';
```

Expected result: no rows.

## P0: Fix `driver_invites` Anonymous Read

Problem:

- `driver_invites` has a public SELECT policy with `qual = true`.
- This can expose all invite rows through the Data API.

Required fix:

1. Drop the broad anonymous SELECT policy.
2. Do not let clients query `driver_invites` directly by arbitrary filters.
3. Replace with a narrow `SECURITY DEFINER` RPC or Edge Function:
   - Input: invite code.
   - Validate exact code.
   - Require `status = 'pending'`.
   - Require `expires_at > now()`.
   - Return only safe fields needed by signup.
   - Do not return full internal invite/company/payroll data unless required.
4. Keep manager invite management scoped to the manager's own company.

Minimum verification:

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'driver_invites'
order by policyname;
```

Expected: no policy with `roles = {public}`, `cmd = SELECT`, and `qual = true`.

## P1: Add `shift_jobs` RLS For Mobile Reports

Problem:

- Mobile report generation reads `shift_jobs`.
- Export showed no policies, so mobile report rows may be invisible.

Required fix:

Add user-owned and/or company-manager scoped SELECT policies.

Suggested shape:

```sql
alter table public.shift_jobs enable row level security;

create policy "Users can read own shift jobs"
on public.shift_jobs
for select
to authenticated
using (user_id = auth.uid());

create policy "Managers can read company shift jobs"
on public.shift_jobs
for select
to authenticated
using (
  get_my_role() = 'manager'
  and user_id in (
    select id
    from public.profiles
    where company_id = get_my_company_id()
  )
);
```

Adjust `user_id` comparison if portal schema uses `profiles.id` rather than `auth.users.id`.

## P1: Fix Storage Policies To Match Mobile Paths

Mobile-used buckets:

- `defect-photos`
- `driver-documents`
- `vehicle-documents`
- `logos`

Problems:

- `defect-photos` has SELECT/DELETE policies but no INSERT policy matching mobile uploads.
- `driver-documents` policies are manager/company-folder oriented, but solo mobile uploads use paths like `<userId>/quals/...`.
- `vehicle-documents` policies are manager/company-folder oriented, but solo mobile paths use `<companyId or solo>/<vehicleId>/...`.
- `logos` is public, which is acceptable, but lacks size/MIME limits.

Required fix:

1. Decide canonical storage path conventions for portal and mobile.
2. Either update mobile paths or add policies matching current mobile paths.
3. Add bucket size/MIME restrictions:
   - `logos`: image-only, reasonable max size.
   - `defect-photos`: image-only, reasonable max size.
   - `vehicle-documents`: image/PDF, reasonable max size.
4. Keep `driver-documents` and `vehicle-documents` private.

Verification:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('defect-photos', 'driver-documents', 'vehicle-documents', 'logos')
order by id;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

## P1: Audit SECURITY DEFINER Functions

Functions used by RLS or client flows need body review:

- `accept_driver_invite`
- `get_auth_user_company`
- `get_auth_user_role`
- `get_my_company_id`
- `get_my_role`
- `prevent_role_escalation`
- `update_user_claims`
- `validate_auth_code`

Export function bodies:

```sql
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'accept_driver_invite',
    'get_auth_user_company',
    'get_auth_user_role',
    'get_my_company_id',
    'get_my_role',
    'prevent_role_escalation',
    'update_user_claims',
    'validate_auth_code'
  )
order by p.proname;
```

Review requirements:

- `SECURITY DEFINER` functions must set a safe `search_path`.
- They must validate `auth.uid()` ownership/company membership.
- Invite acceptance must not allow accepting another company's invite or reusing expired/accepted invites.
- Role/company updates must not allow privilege escalation.

## P1: Export Portal Edge Function Source

Mobile/backend references indicate portal-owned functions:

- `delete-user-data`
- `send-broadcast`
- `process-tacho`
- deployed `calculate-compliance`, if different from mobile repo source

Review requirements:

- Auth is checked server-side.
- Service-role usage is limited and never returned/logged.
- User/company ownership is validated before destructive actions.
- Logs do not include tokens, PII, payroll data, or document URLs unnecessarily.

## Completion Criteria

After fixes, provide these exports back to the mobile repo audit:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

select routine_schema, routine_name, routine_type, security_type, data_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select
  event_object_table,
  trigger_name,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

Launch blocker is not cleared until:

- No trigger embeds bearer tokens.
- `driver_invites` no longer has anonymous broad SELECT.
- `shift_jobs` mobile reads are covered by RLS.
- Storage policies match mobile/portal upload paths.
- Sensitive buckets are private with size/MIME limits.
- SECURITY DEFINER functions and portal edge functions are reviewed.
