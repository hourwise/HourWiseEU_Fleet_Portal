# Calculate Compliance Edge Function - App Repo Handoff

Date: 2026-06-21

Context:

- Supabase project is shared by the HourWise EU Fleet Portal, partner/mobile app fleet-driver logins, and solo-driver app usage.
- Remote Edge Function `calculate-compliance` is ACTIVE.
- Source was temporarily downloaded in the portal repo for audit, then removed to avoid accidental portal-repo deployment of an app-owned function.
- Do not delete or deploy this function from the portal repo without coordinating with the app repo owner.
- App repo confirmation received on 2026-06-21: current production app code calculates compliance client-side on shift end and writes `work_sessions.compliance_score` / `work_sessions.compliance_violations` directly.
- Portal repo search on 2026-06-21 found no direct portal call to `calculate-compliance`; portal reporting reads stored `work_sessions` compliance columns.

Observed risk in the deployed source:

- Accepts `POST` body `{ record: session }`.
- Does not authenticate the caller inside the function.
- Creates a Supabase client with service-role privileges.
- Trusts client-supplied `session.user_id`, `session.start_time`, and `session.id`.
- Updates `work_sessions.compliance_score` and `work_sessions.compliance_violations` by supplied `session.id`.
- Returns raw error messages.

Observed live DB trigger dependency:

- `public.work_sessions` had two legacy `AFTER UPDATE` HTTP trigger paths to `calculate-compliance`.
- Trigger `"On Shift Complete"` called the Edge Function directly with empty body `{}`.
- Trigger `on_shift_complete_trigger` called `public.trigger_compliance_function()`, which sent `{ record: NEW }` and embedded an authorization header in SQL.
- These triggers can fire from any shared-database updater, even though the app no longer needs them for normal shift-end compliance writes.

Portal-side migration added:

- `supabase/migrations/20260621114500_remove_legacy_work_session_compliance_triggers.sql`
- Drops only the two stale `work_sessions` compliance HTTP triggers and `public.trigger_compliance_function()`.
- Does not delete or deploy the app-owned `calculate-compliance` Edge Function.

Deploy/verification:

```sql
select
  trigger_name,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table = 'work_sessions'
order by trigger_name;
```

Expected after migration: no compliance HTTP triggers remain. Normal non-compliance triggers such as `set_work_sessions_updated_at` may remain.

Required app-repo repair:

1. Locate the canonical app repo source for `supabase/functions/calculate-compliance/index.ts`, or download the currently deployed source with `supabase functions download calculate-compliance --use-api`.
2. Confirm all mobile app call sites and any DB trigger/webhook call sites.
3. Preserve app/solo-driver behaviour, but harden authorization before any service-role update.
4. Accept only a session id from the request body, not a full trusted session object.
5. Require a valid user JWT for normal app calls using the incoming `Authorization` header and `supabase.auth.getUser()`.
6. Fetch the `work_sessions` row server-side by id.
7. Permit update only when:
   - the authenticated user owns the session (`work_sessions.user_id = auth.uid()`), or
   - the authenticated user is a manager in the same company as the session owner.
8. If DB-trigger/server-trigger execution is still required, add a dedicated secret header such as `x-compliance-trigger-token` backed by a Supabase secret, not a hard-coded SQL bearer token.
9. Use service role only after caller authorization/trigger-token verification succeeds.
10. Update by both `id` and verified `user_id` to avoid cross-user writes.
11. Return generic client errors; log only non-sensitive diagnostics.
12. Deploy from the app repo and retest:
    - solo driver ending a shift recalculates only their own session,
    - fleet driver app flow recalculates only their own session,
    - manager-triggered recalculation, if supported, is same-company only,
    - cross-user/cross-company attempts return `403`,
    - unauthenticated calls return `401`.

Suggested implementation shape:

```ts
const authorization = req.headers.get("Authorization");
if (!authorization) return jsonResponse({ error: "Authentication required." }, 401);

const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authorization } },
});

const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) return jsonResponse({ error: "Authentication required." }, 401);

const { sessionId } = await req.json();
if (!sessionId) return jsonResponse({ error: "Session id is required." }, 400);

const admin = createClient(supabaseUrl, serviceRoleKey);
const { data: session } = await admin
  .from("work_sessions")
  .select("id,user_id,start_time,end_time,total_work_minutes,total_break_minutes,other_data")
  .eq("id", sessionId)
  .maybeSingle();

// Then fetch caller profile + session owner's profile and enforce self/same-company manager access.
```
