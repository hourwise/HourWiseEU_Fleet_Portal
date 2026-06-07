# Tacho Processing Runtime Config

## Purpose

This document shows how to configure the optional database-trigger dispatch path for non-browser tachograph imports.

It applies to:

- `supabase/migrations/20260606120000_add_tacho_trigger_dispatch.sql`
- `supabase/migrations/20260607113000_add_tacho_runtime_config_rpc.sql`
- `supabase/functions/process-tacho/index.ts`
- `supabase/functions/configure-tacho-processing-runtime/index.ts`

## What it configures

The trigger migration creates a single-row runtime table:

- `private.tacho_processing_runtime`

That row controls whether new non-browser `tachograph_files` rows should be dispatched to `process-tacho` through `pg_net`.

Browser-originated imports are excluded automatically when:

- `metadata.upload_origin = 'browser_manual'`
- `metadata.upload_origin = 'browser_assisted'`

## Required secret alignment

The dispatch trigger sends:

- header: `x-tacho-trigger-token`

That value must match the deployed edge-function secret:

- `PROCESS_TACHO_TRIGGER_TOKEN`

If those values differ, `process-tacho` will reject the trigger call.

## Runtime configuration paths

You now have two repo-backed ways to configure the runtime row:

1. SQL directly, using the examples below.
2. A dedicated admin edge function:
   - function: `configure-tacho-processing-runtime`
   - local helper script: `npm run tacho:runtime -- --status`

The edge-function path exists so you do not need `psql` just to toggle DB-trigger dispatch.

## Recommended production setup

Set the edge-function secret first, then configure the runtime row.

Example SQL:

```sql
update private.tacho_processing_runtime
set
  trigger_enabled = true,
  process_tacho_url = 'https://<your-project-ref>.functions.supabase.co/process-tacho',
  trigger_token = '<same value as PROCESS_TACHO_TRIGGER_TOKEN>',
  updated_at = now()
where singleton is true;
```

## Edge-function alternative

Deploy the admin function and its secret first:

1. `supabase functions deploy configure-tacho-processing-runtime`
2. `supabase secrets set TACHO_RUNTIME_ADMIN_TOKEN=<strong-random-token>`

Then inspect the current runtime state:

```bash
npm run tacho:runtime -- --status --function-url https://<your-project-ref>.functions.supabase.co/configure-tacho-processing-runtime --admin-token <same admin token>
```

And apply the production configuration:

```bash
npm run tacho:runtime -- --function-url https://<your-project-ref>.functions.supabase.co/configure-tacho-processing-runtime --admin-token <same admin token> --enable true --process-url https://<your-project-ref>.functions.supabase.co/process-tacho --trigger-token <same value as PROCESS_TACHO_TRIGGER_TOKEN>
```

The admin function only returns whether a trigger token is configured. It never returns the trigger token value itself.

## Disable dispatch quickly

If you need to stop DB-originated dispatch without removing the trigger:

```sql
update private.tacho_processing_runtime
set
  trigger_enabled = false,
  updated_at = now()
where singleton is true;
```

## Inspect current runtime state

```sql
select
  singleton,
  trigger_enabled,
  process_tacho_url,
  case when trigger_token is null then 'missing' else 'configured' end as trigger_token_state,
  updated_at
from private.tacho_processing_runtime;
```

## Inspect dispatch metadata on imports

The trigger records lightweight observability fields into `tachograph_files.metadata`.

Example query:

```sql
select
  id,
  status,
  metadata ->> 'upload_origin' as upload_origin,
  metadata ->> 'trigger_dispatch_requested_at' as trigger_dispatch_requested_at,
  metadata ->> 'trigger_dispatch_request_id' as trigger_dispatch_request_id,
  metadata ->> 'trigger_dispatch_error' as trigger_dispatch_error
from public.tachograph_files
order by uploaded_at desc
limit 20;
```

## Operational notes

1. Keep `trigger_enabled = false` until `process-tacho` is deployed with `PROCESS_TACHO_TRIGGER_TOKEN`.
2. Do not store a service-role bearer in SQL for this path.
3. Use this dispatch path only for ingest sources that do not already invoke `process-tacho` directly from the browser.
4. If you use the admin edge function, treat `TACHO_RUNTIME_ADMIN_TOKEN` as deployment-level infrastructure access, not as an application user credential.
