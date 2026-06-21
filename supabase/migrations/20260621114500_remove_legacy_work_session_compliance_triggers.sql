begin;

-- The app now calculates and writes work_sessions.compliance_score and
-- work_sessions.compliance_violations on shift end. These legacy database
-- HTTP triggers duplicate that path and call the shared calculate-compliance
-- Edge Function with unsafe/stale request shapes.
drop trigger if exists "On Shift Complete" on public.work_sessions;
drop trigger if exists on_shift_complete_trigger on public.work_sessions;
drop function if exists public.trigger_compliance_function();

commit;
