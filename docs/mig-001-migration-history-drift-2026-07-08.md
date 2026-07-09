# MIG-001 - Supabase Migration History Drift Repair Plan

Date: 2026-07-08
Status: repaired; CLI dry-run auth follow-up pending

## Problem

`supabase db push` is not safe until local migration files and remote migration history are reconciled.

Current linked project:

```text
lcvahjmoobmpifrexurb
```

Observed drift before repair:

```text
Remote-only: 20260703130000
Local-only:  20260705103000
Local-only:  20260705170000
Local-only:  20260708120000
```

## Actions Already Taken

Recovered the missing remote migration into source control:

```text
supabase/migrations/20260703130000_add_push_token_and_account_deletion_requests.sql
```

The `supabase migration fetch --linked` command also overwrote many existing tracked migration files. Those overwritten tracked files were restored to their previous repo versions. Only the recovered `20260703130000` file remains as the intended migration-directory addition.

## Current Drift After Recovery

After adding `20260703130000`, `supabase migration list --linked` shows only local-only versions:

```text
20260705103000 | local only
20260705170000 | local only
20260708120000 | local only
```

Interpretation:

- `20260705170000_add_security_permission_foundation.sql` was deployed manually during SEC-009 but is missing from Supabase migration history.
- `20260708120000_shadow_permission_patch_tachograph_import_metadata.sql` was deployed manually during SEC-010 but is missing from Supabase migration history.
- `20260705103000_update_tacho_pairing_timeline_rows.sql` must be verified before classification. It may be genuinely pending, or it may also have been applied outside migration history.

## Verification Script

Run this read-only script in Supabase Dashboard SQL Editor before repair:

```text
docs/mig-001-live-migration-drift-verification.sql
```

Expected interpretation:

- If `20260705170000_security_foundation_marker` returns all `true`, `20260705170000` can be marked applied in migration history.
- If `20260708120000_sec010_shadow_marker` returns all `true`, `20260708120000` can be marked applied in migration history.
- If `20260705103000_pairing_timeline_rpc_marker` returns both `true`, `20260705103000` can be marked applied in migration history.
- If either `20260705103000` marker is `false`, do not mark it applied. Apply that migration deliberately later or leave it pending.

Captured verification result:

```json
[
  {
    "check_name": "20260705103000_pairing_timeline_rpc_marker",
    "has_timeline_generations_update": true,
    "has_timeline_events_update": true
  }
]
[
  {
    "check_name": "20260705170000_security_foundation_marker",
    "has_security_roles": true,
    "has_security_permissions": true,
    "has_security_role_assignments": true,
    "has_security_permission_audit_events": true,
    "has_organisation_memberships_view": true,
    "has_actor_has_permission": true,
    "has_record_security_event": true
  }
]
[
  {
    "check_name": "20260708120000_sec010_shadow_marker",
    "has_shadow_mismatch_audit": true,
    "has_permission_shadow_check": true
  }
]
```

All markers were `true`, so the three local-only migrations were already deployed and were safe to mark as applied in migration history.

## Safe Repair Commands

Executed after marker verification:

```powershell
.\supabase.exe migration repair --status applied 20260705103000 20260705170000 20260708120000
```

Result:

```text
Repaired migration history: [20260705103000 20260705170000 20260708120000] => applied
```

Post-repair `supabase migration list --linked` shows all local migration versions matched remotely through `20260708120000`.

`supabase db push --dry-run` was attempted after repair. It no longer failed with a migration-history drift message, but it did fail on Supabase CLI login-role authentication:

```text
failed SASL auth (FATAL: password authentication failed for user "cli_login_postgres")
```

Treat that as a separate CLI/auth issue, not unresolved migration drift.

## Guardrails

- Do not run `supabase migration fetch --linked` again without first committing or stashing local migration files.
- Do not use `supabase db push` until `supabase migration list --linked` has no unintended local-only rows.
- Do not mark `20260705103000` applied unless live function markers prove the function already includes the timeline updates.
- Do not repair migration history for a version whose SQL has not been applied.

## Completion Criteria

MIG-001 is complete when:

- `20260703130000_add_push_token_and_account_deletion_requests.sql` is present locally.
- Live marker verification is captured. Completed.
- Remote migration history is repaired only for migrations already deployed. Completed.
- `supabase migration list --linked` shows no unexpected remote-only rows and no already-deployed local-only rows. Completed.
- `supabase db push --dry-run` no longer fails due to migration-history drift. Completed for drift; blocked by separate CLI login-role authentication issue.
