# Batch 24A — Rota template save reliability

Date: 2026-08-23

Starting revision: `b648d1ea8815e9d088f2cebfa5dbb9ba174d2b81`

Supabase project: `lcvahjmoobmpifrexurb`

## Root cause

`RotaPlanningWorkspace.tsx` assigned `supabase.rpc` to a standalone `planningRpc` constant through an `unknown` generic cast. In `@supabase/supabase-js` 2.57.4, `SupabaseClient.rpc()` calls `this.rest.rpc(...)`. Invoking that method without its client receiver throws synchronously:

`TypeError: Cannot read properties of undefined (reading 'rest')`

The template handler set `busy` before that call and had no `catch` or `finally`, so React remained in `Saving…`. The exception occurred before fetch/PostgREST; no template transaction began.

Evidence:

- the installed client source returns `this.rest.rpc(fn, args, options)`;
- a local non-mutating harness reproduces the exact detached-method exception;
- a transport-capture harness using the correctly bound typed client sends one POST to `/rest/v1/rpc/create_cyclic_rota_template`;
- production API logs around the observed planning activity contain the reads but no create-template RPC POST;
- live schema inspection and the user's transaction-rollback diagnostic confirm the original database function itself was callable;
- production `rota_templates` remained at zero rows after deployment verification.

The cast contributed materially: it detached the method, changed the real PostgREST builder into a fictional `Promise`, erased generated argument validation, and hid `.abortSignal()`.

## Frontend repair

The template path now calls the generated typed client directly:

```ts
supabase.rpc('create_cyclic_rota_template', payload).abortSignal(signal)
```

The remaining planner helper is bound to the client and preserves the exact generated method type. The unsafe `unknown` cast is removed.

`buildRotaTemplateCreateArgs()` produces deterministic JSON and rejects invalid/non-finite form state before transport. For the reported example, the request body is:

```json
{
  "p_name": "Regular Week",
  "p_description": "Staffing demand pattern",
  "p_cycle_length_days": 7,
  "p_request_key": "<manager-generated UUID>",
  "p_slots": [
    {
      "cycle_day": 1,
      "role_label": "Day Driver",
      "start_time": "08:00",
      "end_time": "18:00",
      "required_headcount": 5,
      "sort_order": 0
    }
  ]
}
```

The request has a 15-second bound implemented with an `AbortController`, the Supabase/PostgREST builder's `abortSignal`, and a timeout race. Supabase's current JavaScript documentation explicitly supports `abortSignal` and timeout signals: <https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal>.

`busy` is always cleared in `finally`. Server errors use bounded copy and state that the transactional write failed. A thrown, aborted, or missing-response path is described as uncertain because the server may have committed before the response was lost. Technical details are logged for diagnostics, never rendered to the normal user.

No failure path closes or resets the drawer. Pattern name, cycle length, rows, and the stable request key remain available for a safe retry.

## Idempotency migration

Migration: `20260823072604_batch24a_rota_template_save_reliability.sql`

The migration:

- adds nullable `rota_templates.request_key uuid` for backward compatibility;
- adds a unique partial index on `(company_id, request_key)`;
- replaces the old four-argument function with a five-argument contract;
- requires a manager-generated request UUID;
- serializes the company/key pair with `pg_advisory_xact_lock`;
- returns the original template and `replayed: true` when a successful request is replayed;
- preserves manager identity, company isolation, fixed search path, anonymous revocation, and authenticated execute access.

The linked dry-run identified one migration, deployment succeeded, migration history contains `20260823072604`, and a post-deploy dry-run reports the remote database is up to date. Generated TypeScript types were regenerated from the live schema.

Live read-only verification confirms:

- signature `create_cyclic_rota_template(text,text,integer,jsonb,uuid)`;
- `p_request_key uuid` in the RPC arguments;
- the company/request-key unique index;
- `anon_can_execute = false`;
- `authenticated_can_execute = true`;
- zero production template rows after verification.

No production data was created merely for testing.

## Post-save confirmation

After a usable RPC response, the UI refreshes the complete planning snapshot and searches for the returned `template_id`. Only when that fresh read contains the template does it:

1. select the new template;
2. close the drawer;
3. show `<actual pattern name> saved.`

If the fresh read misses the returned template, the drawer stays open and a bounded inconsistency warning tells the manager to refresh before retrying.

## Related planner-write audit

The same detached helper affected template preview/apply, publication checks, job placement, vacancy assignment, availability creation, job creation, run creation, and the planning snapshot RPC. These paths now retain the bound typed method, use a 15-second abort signal, avoid raw backend copy, and clear loading/busy state in `finally` where applicable.

Restoring generated typing also exposed optional RPC arguments that were sent as `null` despite generated contracts expecting omission. Those optional arguments now serialize as `undefined`/omitted.

No planner features, routing, AI, or visual redesign were added.

## Tests

`rotaTemplateSave.test.ts` covers:

- the reported one-row payload;
- deterministic multiple-row serialization;
- actual Supabase RPC URL, method, and JSON body capture;
- reproduction of the original detached-method exception;
- success busy lifecycle, refresh/select, and close behavior;
- server error, thrown network error, and timeout recovery;
- aborted stalled request;
- preservation of the submitted payload/form state;
- post-save refresh inconsistency;
- company-scoped idempotency and replay contract;
- generated argument alignment and removal of the unsafe cast;
- bounded related planner writes.

## Manual acceptance

MANUAL ACCEPTANCE BLOCKED — AUTHENTICATED BROWSER ENVIRONMENT.

No in-app or connected browser session was available. The live Regular Week save/reload, multiple-requirement save, and double-click/retry sequence could not be performed. No database-only production insert was substituted for the required authenticated UI flow.

## Advisor notes

Supabase security and performance advisors were run after deployment. They returned the repository/project's existing broad advisory baseline. The replacement function was not anonymously executable; its authenticated execution is intentional and internally enforces manager role plus company scope. No unrelated advisor remediation was added to this narrow batch.

## Validation

- Focused Batch 24A suite: 1 file, 12 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:rules`: 58 files, 358 tests passed.
- `npm.cmd test`: 65 files, 400 tests passed.
- `npm.cmd run build`: passed; 2,585 modules transformed in 55.21 seconds. Existing mixed-import and chunk-size warnings remain informational.
- Changed-file ESLint: passed with no findings.
- `git diff --check`: passed.
- `npm.cmd run lint`: unchanged known baseline of 103 errors and 7 warnings in unrelated legacy files; no Batch 24A file appears in the diagnostics.
- Post-deploy `supabase db push --linked --dry-run`: remote database is up to date.
