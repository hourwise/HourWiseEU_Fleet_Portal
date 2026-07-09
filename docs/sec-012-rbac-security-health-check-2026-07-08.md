# SEC-012 - RBAC Security Health Check Pack

Date: 2026-07-08
Status: implemented locally

## Scope

Create one repeatable read-only SQL pack for Supabase Dashboard checks across the SEC-007 permission foundation, SEC-010 shadow comparison, and MIG-001 migration-history repair.

## SQL Pack

Run:

```text
docs/sec-012-rbac-security-health-check.sql
```

The pack is read-only against application tables. It returns summary rows and investigation detail rows.

## Checks Included

- Security role and permission catalogue counts.
- `driver` and `fleet_administrator` grant counts.
- Denied-default fleet administrator grant check for export, role admin, support, and Atlas fleet summary.
- Active assignment counts by role.
- Active legacy `manager`/`driver` profiles without active security assignment.
- Active legacy backfill assignments without matching active legacy profile.
- Assignment scope summary, expecting organisation-only rows with `site_id` null.
- `organisation_memberships_v` compatibility counts.
- Critical/audited export permission metadata.
- SEC-010 `shadow_permission_mismatch` counts and detail rows.
- SEC-010 deployed function markers.
- `20260705103000` pairing/timeline deployed function markers.
- MIG-001 migration-history alignment note.

## Current Expected Green State

For the current live test dataset:

- `security_role_count = 10`
- `security_permission_count = 32`
- `driver grant_count = 6`
- `fleet_administrator grant_count = 22`
- `unexpected_grant_count = 0`
- `gap_count = 0`
- `orphaned_assignment_count = 0`
- assignment scope rows are `scope_level = organisation` and `site_id_is_null = true`
- SEC-010 `mismatch_count = 0`
- SEC-010 `mismatch_count_24h = 0`
- function marker booleans are `true`

## Failure Handling

Do not proceed to further shadow enforcement or permission-enforcement swaps if any of these appear:

- any denied-default fleet administrator grant
- any active legacy profile without assignment
- any orphaned legacy backfill assignment
- any site-scoped assignment before the site foundation exists
- any SEC-010 `shadow_permission_mismatch`
- any deployed function marker returns `false`

Investigate the specific detail result set before changing runtime enforcement.

## Related Gates

- `SEC-007`: additive permission foundation.
- `SEC-009`: deployed foundation verification.
- `SEC-010`: first shadow permission comparison.
- `MIG-001`: migration-history drift repair.

## Next Recommended Use

Run this SQL pack before starting `SEC-011` and again before any future enforcement swap.
