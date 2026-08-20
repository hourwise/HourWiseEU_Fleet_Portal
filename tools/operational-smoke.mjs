import { createClient } from '@supabase/supabase-js';

const environment = process.env.SMOKE_ENVIRONMENT;
const allowMutation = process.env.SMOKE_ALLOW_MUTATION === 'true';
const supabaseUrl = process.env.SMOKE_SUPABASE_URL;
const publishableKey = process.env.SMOKE_SUPABASE_PUBLISHABLE_KEY;

if (!['local', 'staging'].includes(environment)) fail('SMOKE_ENVIRONMENT must be local or staging. Production smoke mutation is refused.');
if (!allowMutation) fail('Set SMOKE_ALLOW_MUTATION=true only when the target is a disposable test company.');
if (!supabaseUrl || !publishableKey) fail('SMOKE_SUPABASE_URL and SMOKE_SUPABASE_PUBLISHABLE_KEY are required.');
if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SMOKE_SERVICE_ROLE_KEY) fail('Service-role credentials are forbidden in this harness.');

const managerEmail = required('SMOKE_MANAGER_EMAIL');
const managerPassword = required('SMOKE_MANAGER_PASSWORD');
const driverEmail = required('SMOKE_DRIVER_EMAIL');
const driverPassword = required('SMOKE_DRIVER_PASSWORD');
const wrongDriverEmail = required('SMOKE_WRONG_DRIVER_EMAIL');
const wrongDriverPassword = required('SMOKE_WRONG_DRIVER_PASSWORD');
const shiftId = required('SMOKE_SHIFT_ID');
const readyTrailerId = required('SMOKE_TRAILER_ID');
const prohibitedTrailerId = required('SMOKE_PROHIBITED_TRAILER_ID');
const crossCompanyAssignmentId = required('SMOKE_CROSS_COMPANY_ASSIGNMENT_ID');
const crossCompanyAssignmentUpdatedAt = required('SMOKE_CROSS_COMPANY_ASSIGNMENT_UPDATED_AT');
const forbiddenPodPath = required('SMOKE_FORBIDDEN_POD_PATH');

const manager = createSmokeClient();
const driver = createSmokeClient();
const wrongDriver = createSmokeClient();
const results = [];

await signIn(manager, managerEmail, managerPassword, 'manager');
await signIn(driver, driverEmail, driverPassword, 'driver');
await signIn(wrongDriver, wrongDriverEmail, wrongDriverPassword, 'wrong-driver');
const managerProfile = await profile(manager);
const driverProfile = await profile(driver);
const wrongDriverProfile = await profile(wrongDriver);
assert(managerProfile.company_id && managerProfile.company_id === driverProfile.company_id, 'Manager and driver must be in the same disposable company.');
assert(managerProfile.role === 'manager', 'Configured manager identity is not a manager profile.');
assert(driverProfile.role === 'driver', 'Configured driver identity is not a driver profile.');
assert(wrongDriverProfile.role === 'driver' && wrongDriverProfile.company_id === managerProfile.company_id && wrongDriverProfile.id !== driverProfile.id, 'Configured wrong-driver identity must be a different driver in the same company.');
results.push('authenticated manager and driver');

const shift = await one(manager, 'shifts', 'id, company_id, driver_id, status, date', { id: shiftId });
assert(shift.company_id === managerProfile.company_id, 'Smoke shift is outside the authenticated company.');
assert(shift.driver_id === driverProfile.id, 'Smoke shift is not assigned to the configured driver.');
assert(['published', 'updated'].includes(shift.status), 'Smoke shift must already be published or updated.');

const firstAssignment = await createAssignment(manager, shiftId, 'B13-E2E-POD');
await saveStops(manager, firstAssignment.job_id);
const initialAssignment = await assignment(manager, firstAssignment.job_assignment_id);
await rpc(manager, 'assign_trailer_to_job_assignment', { p_assignment_id: initialAssignment.id, p_trailer_id: readyTrailerId, p_expected_updated_at: initialAssignment.updated_at });
results.push('manager created work, saved stops, and assigned a ready trailer');

const afterTrailerAssignment = await assignment(manager, initialAssignment.id);
const prohibitedAttempt = await rpcResult(manager, 'assign_trailer_to_job_assignment', { p_assignment_id: afterTrailerAssignment.id, p_trailer_id: prohibitedTrailerId, p_expected_updated_at: afterTrailerAssignment.updated_at });
assert(prohibitedAttempt.error, 'A prohibited trailer assignment unexpectedly succeeded.');
results.push('prohibited trailer assignment rejected');

await assertReadDenied(manager, 'job_assignments', crossCompanyAssignmentId);
await assertRpcDenied(manager, 'assign_trailer_to_job_assignment', { p_assignment_id: crossCompanyAssignmentId, p_trailer_id: readyTrailerId, p_expected_updated_at: crossCompanyAssignmentUpdatedAt });
const wrongDriverAssignment = await assignment(manager, firstAssignment.job_assignment_id);
await assertRpcDenied(wrongDriver, 'transition_job_assignment_with_event', { p_assignment_id: firstAssignment.job_assignment_id, p_to_status: 'acknowledged', p_expected_updated_at: wrongDriverAssignment.updated_at, p_reason: null, p_requires_ack: false });
results.push('cross-company read/mutation and wrong-driver lifecycle were denied');

await assertDriverCanReadPublishedWork(firstAssignment);
await transitionLifecycle(driver, firstAssignment.job_assignment_id, ['acknowledged', 'started', 'arrived', 'completed']);
results.push('driver saw jobs/stops and completed governed lifecycle');

const evidence = await uploadAndReviewPod(driver, manager, firstAssignment.job_assignment_id);
assert(evidence.review_status === 'accepted', 'Manager POD review did not reach accepted state.');
await assertStorageDownloadDenied(wrongDriver, forbiddenPodPath);
await assertRpcDenied(driver, 'cleanup_failed_job_evidence_upload', { p_upload_intent_id: evidence.upload_intent_id, p_reason: 'Batch 14 finalized evidence must be retained' });
results.push('POD upload, registration, and manager review completed');
results.push('arbitrary POD access and finalized-evidence cleanup were denied');

const exceptionAssignment = await createAssignment(manager, shiftId, 'B13-E2E-EXCEPTION');
await transitionLifecycle(driver, exceptionAssignment.job_assignment_id, ['acknowledged', 'started', 'delayed', 'unable_to_complete']);
await rpc(manager, 'set_operational_task_handling', { p_source_type: 'job_assignment', p_source_id: exceptionAssignment.job_assignment_id, p_status: 'acknowledged', p_action: 'review_exception', p_note: 'Batch 13 disposable smoke verification', p_owner_id: managerProfile.id });
await rpc(manager, 'set_operational_task_handling', { p_source_type: 'driver_compliance', p_source_id: driverProfile.id, p_status: 'acknowledged', p_action: 'review_driver_evidence', p_note: 'Batch 13 disposable smoke verification', p_owner_id: managerProfile.id });
results.push('exception lifecycle and operational task handling completed');

const exceptionState = await assignment(manager, exceptionAssignment.job_assignment_id);
const { data: observationRows, error: observationError } = await manager.rpc('sync_atlas_signal_observations', {
  p_signals: [{ signal_key: `smoke:job:${exceptionState.id}`, fingerprint: `${exceptionState.status}:${exceptionState.updated_at}`, section: 'today', severity: 'critical', source_updated_at: exceptionState.updated_at }],
});
if (observationError) throw new Error(`Atlas observation sync failed: ${observationError.message}`);
assert(Array.isArray(observationRows) && observationRows.length === 1, 'Atlas did not persist the deterministic smoke signal.');
results.push('Atlas deterministic observation surfaced the resulting exception');

console.log(JSON.stringify({ ok: true, environment, companyId: managerProfile.company_id, results, note: 'Disposable smoke records were created intentionally; reset the disposable company after review.' }, null, 2));

function createSmokeClient() {
  return createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signIn(client, email, password, label) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
}

async function profile(client) {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error(`Authenticated user lookup failed: ${authError?.message ?? 'no user'}`);
  return one(client, 'profiles', 'id, company_id, role, full_name', { id: authData.user.id });
}

async function createAssignment(client, targetShiftId, marker) {
  const { data: sequenceRows, error: sequenceError } = await client.from('job_assignments').select('sequence').eq('shift_id', targetShiftId).order('sequence', { ascending: false }).limit(1);
  if (sequenceError) throw new Error(`Unable to choose smoke sequence: ${sequenceError.message}`);
  const sequence = Number(sequenceRows?.[0]?.sequence ?? 0) + 1;
  const data = await rpc(client, 'create_job_assignment_with_asset_guard', {
    p_shift_id: targetShiftId, p_reference: `${marker}-${Date.now()}`, p_title: 'Batch 13 disposable verification job', p_job_type: 'delivery', p_address_text: 'Disposable test location', p_customer_name: 'Batch 13 test company', p_sequence: sequence, p_requires_ack: true,
  });
  assert(data?.job_assignment_id && data?.job_id, 'Job assignment RPC returned no identifiers.');
  return data;
}

async function saveStops(client, jobId) {
  const job = await one(client, 'jobs', 'id, updated_at', { id: jobId });
  await rpc(client, 'save_job_stops', { p_job_id: job.id, p_expected_job_updated_at: job.updated_at, p_stops: [{ sequence: 1, stop_type: 'delivery', address_text: 'Disposable test stop', activity: 'Smoke verification delivery' }] });
}

async function assignment(client, id) {
  return one(client, 'job_assignments', 'id, job_id, updated_at, status, driver_id, company_id', { id });
}

async function assertDriverCanReadPublishedWork(created) {
  const assignmentRow = await one(driver, 'job_assignments', 'id, job_id, status', { id: created.job_assignment_id });
  assert(['published', 'updated'].includes(assignmentRow.status), 'Driver could not see the published assignment in a readable state.');
  const { data: stops, error } = await driver.from('job_stops').select('id, job_id, sequence, address_text').eq('job_id', created.job_id);
  if (error) throw new Error(`Driver stop read failed: ${error.message}`);
  assert(stops?.length === 1, 'Driver could not see the published route stop.');
}

async function transitionLifecycle(client, id, statuses) {
  for (const status of statuses) {
    const current = await assignment(client, id);
    await rpc(client, 'transition_job_assignment_with_event', { p_assignment_id: id, p_to_status: status, p_expected_updated_at: current.updated_at, p_reason: ['delayed', 'unable_to_complete'].includes(status) ? `Batch 13 disposable ${status} reason` : null, p_requires_ack: false });
  }
}

async function uploadAndReviewPod(driverClient, managerClient, assignmentId) {
  const intent = await rpc(driverClient, 'begin_job_evidence_upload', { p_job_assignment_id: assignmentId, p_original_file_name: 'batch13-pod-smoke.txt' });
  const file = new Blob(['Batch 13 disposable POD evidence'], { type: 'text/plain' });
  const { error: uploadError } = await driverClient.storage.from('pod-evidence').upload(intent.storage_path, file, { upsert: false, contentType: 'text/plain' });
  if (uploadError) {
    await rpc(driverClient, 'cleanup_failed_job_evidence_upload', { p_upload_intent_id: intent.id, p_reason: `smoke storage upload failed: ${uploadError.message}` });
    throw new Error(`Smoke POD upload failed: ${uploadError.message}`);
  }
  const evidence = await rpc(driverClient, 'finalize_job_evidence_upload', { p_upload_intent_id: intent.id, p_evidence_type: 'pod', p_outcome: 'delivered', p_source: 'mobile_file', p_metadata: { smoke: true } });
  const loaded = await one(managerClient, 'job_evidence', 'id, updated_at, review_status', { id: evidence.id });
  // The legacy review_job_evidence RPC remains documented for compatibility;
  // disposable smoke exercises the idempotent governed Batch 18 contract.
  const reviewed = await rpc(managerClient, 'review_job_evidence_governed', { p_evidence_id: loaded.id, p_review_status: 'accepted', p_review_notes: 'Batch 18 disposable smoke verification', p_expected_updated_at: loaded.updated_at });
  assert(reviewed.outcome === 'reviewed' || reviewed.outcome === 'already_reviewed', `Governed POD review returned ${reviewed.outcome}.`);
  return { ...reviewed, upload_intent_id: intent.id };
}

async function assertReadDenied(client, table, id) {
  const { data, error } = await client.from(table).select('id').eq('id', id).maybeSingle();
  if (error) throw new Error(`Cross-company read returned an unexpected error: ${error.message}`);
  assert(!data, `Cross-company read unexpectedly returned ${table} row ${id}.`);
}

async function assertRpcDenied(client, name, args) {
  const result = await rpcResult(client, name, args);
  assert(result.error, `${name} unexpectedly succeeded across the governed security boundary.`);
}

async function assertStorageDownloadDenied(client, path) {
  const { data, error } = await client.storage.from('pod-evidence').download(path);
  assert(error || !data, 'Arbitrary cross-company POD object download unexpectedly succeeded.');
}

async function rpc(client, name, args) {
  const result = await rpcResult(client, name, args);
  if (result.error) throw new Error(`${name} failed: ${result.error.message}`);
  return result.data;
}

async function rpcResult(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  return { data, error };
}

async function one(client, table, fields, filters) {
  let query = client.from(table).select(fields).limit(1);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  if (!data) throw new Error(`${table} lookup returned no row for ${JSON.stringify(filters)}`);
  return data;
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required.`);
  return value;
}

function assert(condition, message) { if (!condition) fail(message); }
function fail(message) { console.error(`Operational smoke blocked: ${message}`); process.exit(1); }
