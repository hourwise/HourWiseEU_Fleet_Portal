# HourWise EU Fleet Portal

HourWise EU Fleet Portal is a React, TypeScript, Vite, and Supabase application for fleet compliance and operations.

The project currently covers tachograph import/review workflows, driver and manager dashboards, vehicle/compliance management, messaging, rota planning, security/RBAC rollout work, and planning for Atlas operations features.

## Current Status

This repository is under active development.

Implemented or in progress:

- Manager and driver authenticated dashboards
- Tachograph helper/import workflow and parser/timeline validation tooling
- Tachograph review actions and driver acknowledgements
- Vehicle management, vehicle checks, maintenance/compliance surfaces
- Messaging hub
- Rota planning
- Driver read-only upcoming rota
- Draft/publish/update/cancel shift lifecycle with audit migration pending deployment
- Additive security permission foundation and shadow permission checks
- Supabase migration drift repair documentation
- Source-of-truth planning docs and ADRs for rota, events, multi-site, RBAC, Atlas, reporting, and asset compliance

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Vitest
- ESLint
- Vercel deployment config

## Repository Layout

```text
src/
  components/        React UI components
  contexts/          Auth/session context
  hooks/             Feature-specific React hooks
  lib/               Supabase client, domain helpers, tests
  pages/             Public/request pages

supabase/
  migrations/        Database migrations
  functions/         Supabase Edge Functions where present

tools/
  tacho-reader-helper/
  tacho-processing/

docs/
  source-of-truth/   Product and architecture source-of-truth docs
  adr/               Architecture decision records
  *.md, *.sql        Implementation notes, verification SQL, rollout docs
```

## Prerequisites

- Node.js 20 or compatible current LTS
- npm
- Supabase project credentials
- Optional: Supabase CLI
- Optional for helper work: .NET SDK for the Windows tachograph helper

Docker is not currently required for normal frontend development. Some Supabase workflows may normally use Docker, but this project also documents Dashboard/native PostgreSQL alternatives where Docker is unavailable.

## Environment

Create a local `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit real secrets.

## Install

```powershell
npm install
```

## Development

```powershell
npm run dev
```

Vite will start the local development server.

## Build

```powershell
npm run build
```

Known build note:

- The production build currently passes.
- Vite reports existing large chunk warnings because several heavy feature bundles are included.

## Tests And Checks

Run the focused project rule/security/regression test pack:

```powershell
npm run test:rules
```

Run ESLint:

```powershell
npm run lint
```

Run TypeScript checking:

```powershell
npm run typecheck
```

Known typecheck note:

- Full `npm run typecheck` is currently blocked by pre-existing generated Supabase type/schema drift and unrelated app type issues.
- Recent feature slices use focused lint, build, and `test:rules` validation until database types are refreshed and the wider drift is resolved.

## Supabase Migrations

Migrations live in:

```text
supabase/migrations/
```

Important current migration notes:

- Migration history drift was repaired through `MIG-001`; see `docs/mig-001-migration-history-drift-2026-07-08.md`.
- `supabase db push --dry-run` was previously blocked by a CLI login-role authentication issue, not by migration history drift.
- If CLI deployment is blocked, use the documented Dashboard SQL flow and record marker verification before migration-history repair.

Recent local migration pending deployment:

```text
supabase/migrations/20260709100000_add_shift_publish_status_audit.sql
```

This migration adds rota status, publish/cancel fields, driver visibility tightening, and `shift_audit_events`.

## Tachograph Helper Commands

```powershell
npm run tacho:helper:mock
npm run tacho:helper:probe
npm run tacho:helper:test
npm run tacho:helper:phase1
npm run tacho:helper:windows
npm run tacho:helper:package
```

Tachograph processing utilities:

```powershell
npm run tacho:runtime
npm run tacho:inspect-time-007
npm run tacho:backfill-time-007
npm run tacho:finalize-time-007
npm run tacho:validate-timeline
```

## Source Of Truth

Primary implementation and architecture references:

- `docs/source-of-truth-completion-plan-2026-07-02.md`
- `docs/hourwise-concrete-implementation-plan-2026-07-09.md`
- `docs/source-of-truth/98 - Changelog.md`
- `docs/adr/`

Current recommended implementation sequence:

1. Deploy and verify ROTA-002 migration.
2. Continue event-backed rota/messaging design.
3. Expand Driver Dashboard into a fuller operational home.
4. Add job and route planning on top of the rota/event spine.
5. Add asset compliance rule engine.
6. Add deterministic Atlas operations briefing before conversational/voice Atlas.

## Security Notes

The project is moving from legacy role/company checks toward additive RBAC and central permission checks.

Relevant docs:

- `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`
- `docs/sec-009-additive-permission-foundation-deploy-verify-2026-07-05.md`
- `docs/sec-010-shadow-permission-patch-tachograph-import-metadata-2026-07-08.md`
- `docs/sec-012-rbac-security-health-check-2026-07-08.md`

Before protected feature deployment:

- Run the relevant migration marker checks.
- Run `SEC-012` Dashboard SQL health checks where applicable.
- Keep shadow permission mismatches at zero before enforcement swaps.

## Deployment

The repository includes `vercel.json` for Vercel deployment.

Typical flow:

```powershell
npm run build
```

Then deploy through the configured hosting provider.

Ensure Supabase environment variables are configured in the deployment environment.

