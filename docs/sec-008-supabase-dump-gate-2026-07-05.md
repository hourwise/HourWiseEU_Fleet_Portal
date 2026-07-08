# SEC-008 Supabase Dump Gate

Date: 2026-07-05
Status: Schema/policy evidence captured; privileged data counts pending

## Purpose

`SEC-008` attempts to capture the fresh linked Supabase schema/policy dump required before relying on the additive permission foundation work for further security rollout.

This is an evidence-gathering gate only. It does not apply migrations or change application code.

## Handoff Context

The working handoff says `SEC-007` is complete and `SEC-008` is awaiting a Supabase dump.

Local checkout resolution:

- At the start of `SEC-008`, this checkout did not contain a `SEC-007` migration or static test file.
- `SEC-007` has since been implemented locally in `supabase/migrations/20260705170000_add_security_permission_foundation.sql` and `src/lib/security/sec007PermissionFoundation.test.ts`.
- See `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`.

## Commands Run

Docker availability:

```powershell
docker version
docker ps
```

Result:

```text
Error response from daemon: Docker Desktop is unable to start
```

Docker service/process checks:

```powershell
Get-Service | Where-Object { $_.Name -like '*docker*' -or $_.DisplayName -like '*Docker*' }
Get-Process | Where-Object { $_.ProcessName -like '*Docker*' -or $_.ProcessName -like '*com.docker*' }
```

Result:

- `com.docker.service` exists but is stopped.
- Docker Desktop and backend processes are present.
- Starting `com.docker.service` from this shell failed with a Windows service access error.

WSL checks:

```powershell
wsl --status
wsl -l -v
```

Result:

- WSL default version is `2`.
- WSL reports no installed Linux distributions.

Supabase dump attempt:

```powershell
.\supabase.exe db dump --linked --schema public,storage --file supabase\.temp\sec-008-live-schema-policy-dump-2026-07-05.sql
```

Result:

```text
Initialising login role...
Dumping schemas from remote database...
failed to inspect docker image: Error response from daemon: Docker Desktop is unable to start
Try rerunning the command with --debug to troubleshoot the error.
```

Supabase dry run:

```powershell
.\supabase.exe db dump --linked --schema public,storage --dry-run --debug
```

Result:

- The CLI can read the linked project ref and initialise the remote dump role.
- The dump execution path still requires a working Docker engine or native PostgreSQL client tooling.
- Credentials printed by the dry run are intentionally not recorded here.

Native PostgreSQL client check:

```powershell
Get-Command psql -ErrorAction SilentlyContinue
Get-Command pg_dump -ErrorAction SilentlyContinue
```

Result:

- No native `psql` or `pg_dump` executable is available on PATH.
- No `pg_dump.exe` or `psql.exe` was found inside the repo.

PostgreSQL 15 client retry after installation:

```powershell
C:\Program Files\PostgreSQL\15\bin\pg_dump.exe --version
C:\Program Files\PostgreSQL\15\bin\psql.exe --version
```

Result:

- `pg_dump (PostgreSQL) 15.18`
- `psql (PostgreSQL) 15.18`

Native dump attempt using the Supabase CLI temporary linked-project login role:

```powershell
pg_dump --schema-only --quote-all-identifiers --role postgres --schema public --schema storage --file supabase\.temp\sec-008-native-pgdump-2026-07-05.sql
```

Result:

```text
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 17.6; pg_dump version: 15.18
```

PostgreSQL 17 client retry after installation:

```powershell
C:\Program Files\PostgreSQL\17\bin\pg_dump.exe --version
C:\Program Files\PostgreSQL\17\bin\psql.exe --version
```

Result:

- `pg_dump (PostgreSQL) 17.10`
- `psql (PostgreSQL) 17.10`

Native schema/policy dump using PostgreSQL 17:

```powershell
pg_dump --schema-only --quote-all-identifiers --role postgres --schema public --schema storage --file supabase\.temp\sec-008-live-schema-policy-dump-2026-07-05.sql
```

Result:

- Succeeded.
- Output file: `supabase/.temp/sec-008-live-schema-policy-dump-2026-07-05.sql`
- Size: 402,056 bytes.
- Captured `public` and `storage` schema objects, functions, RLS state, grants, and policies.

Catalog summary captured with the same temporary login role:

```text
supabase/.temp/sec-008-live-catalog-summary-2026-07-05.txt
```

Summary:

| Evidence Item | Count / Result |
| --- | ---: |
| RLS enabled tables | 63 |
| Total captured public/storage tables | 63 |
| Forced RLS tables | 1 (`public.profiles`) |
| Policies | 133 |
| Security foundation tables present | 0 |

Missing security foundation tables:

- `public.security_roles`
- `public.security_permissions`
- `public.security_role_permissions`
- `public.security_role_assignments`
- `public.security_permission_audit_events`

Profile/backfill count query attempt:

```powershell
psql --no-password --set ON_ERROR_STOP=1 --file -
```

Result:

```text
ERROR: permission denied for table profiles
```

Implication:

- The Supabase CLI temporary dump role is sufficient for schema/catalog evidence.
- It is not sufficient for `SEC-006` profile role/backfill counts.
- Profile counts and `storage.buckets` data rows still need Supabase Dashboard SQL or another privileged database connection.

Supabase Dashboard SQL result provided:

```text
docs/sql results.txt
```

Result:

- Contains the `storage.buckets` result set only.
- Does not contain active profile counts by role.
- Does not contain active profile counts by company and role.
- Does not contain profiles-without-company count.
- Does not contain inactive profile count.
- Does not contain expected target role backfill counts.

Captured storage buckets:

| Bucket | Public | File Size Limit | Allowed MIME Types |
| --- | --- | ---: | --- |
| `defect-photos` | false | 10485760 | `image/jpeg`, `image/png`, `image/webp` |
| `driver-documents` | false | 20971520 | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| `logos` | true | 2097152 | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` |
| `maintenance-docs` | true | null | null |
| `receipts` | false | null | null |
| `tachograph-files` | false | 104857600 | `application/octet-stream` |
| `vehicle-documents` | false | 20971520 | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |

Expected role backfill counts provided separately:

```text
expected_security_role_key,expected_assignment_count
driver,17
fleet_administrator,1
```

Interpretation:

- Expected active `driver` assignments: 17.
- Expected active `fleet_administrator` assignments: 1.
- The single fleet administrator account is the project owner/operator.
- One of the driver rows is also the project owner/operator.
- The remaining driver rows are test/fake profiles created and injected with SQL to populate tables.
- These counts are acceptable as migration backfill sizing evidence for the current live test dataset, but they should not be treated as production user-adoption metrics.

## Evidence Produced

Usable fresh schema/policy dump was produced.

Expected dump path:

```text
supabase/.temp/sec-008-live-schema-policy-dump-2026-07-05.sql
```

Current status:

- The dump file is non-empty and valid schema/policy evidence.
- The catalog summary file records RLS, policy, forced-RLS, and missing security-foundation table checks.
- Storage bucket evidence has been captured from Supabase Dashboard SQL in `docs/sql results.txt`.
- Expected role backfill counts have been captured from Supabase Dashboard SQL/user-provided result text.
- Full profile distribution details remain pending because the dump role cannot read `public.profiles` and the provided dashboard result file includes only storage buckets.

## Root Cause

Docker is installed, but the Docker Desktop Linux engine is not operational from this environment. Native PostgreSQL 17 client tooling is therefore the working local dump route.

Observed blockers:

- Docker daemon requests return `Docker Desktop is unable to start`.
- `com.docker.service` is stopped.
- WSL has no installed Linux distributions.
- PostgreSQL 15 native dump tooling is installed, but the linked Supabase database is PostgreSQL 17.6 and requires a matching PostgreSQL 17 `pg_dump`.
- PostgreSQL 17 native dump tooling works for schema/policy capture.
- The temporary dump role does not have permission to read profile data counts.

## Unblock Options

Remaining options:

1. Run the remaining profile distribution queries in Supabase Dashboard SQL if company-role, profiles-without-company, or inactive-profile counts are required before migration execution.
2. Use another privileged database connection to capture the same count queries with `psql`.
3. Treat Docker/Codespaces/Gitpod as optional only; the schema/policy dump no longer depends on Docker.

Validation before rerunning the native dump:

```powershell
C:\Program Files\PostgreSQL\17\bin\pg_dump.exe --version
```

Expected result:

- `pg_dump (PostgreSQL) 17.x`

Then rerun:

```powershell
pg_dump --schema-only --quote-all-identifiers --role postgres --schema public --schema storage --file supabase\.temp\sec-008-live-schema-policy-dump-2026-07-05.sql
```

## Acceptance Criteria

`SEC-008` can move from partial to complete only when:

- A non-empty fresh schema/policy dump is captured from the linked project or an explicitly recorded dashboard export. Completed 2026-07-05.
- The evidence source and command/path are recorded. Completed 2026-07-05.
- Profile role/backfill count queries required by `SEC-006` are captured or explicitly scheduled against the same live state. Expected target role backfill counts captured; company-role, profiles-without-company, and inactive-profile distribution not yet captured.
- The local `SEC-007` artefact mismatch is reconciled before downstream security rollout relies on it. Completed locally by `SEC-007` implementation document and migration/test files.
