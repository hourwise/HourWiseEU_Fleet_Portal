import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const environment = process.env.SMOKE_FIXTURE_ENVIRONMENT;
const allowMutation = process.env.SMOKE_FIXTURE_ALLOW_MUTATION === 'true';
const url = required('SMOKE_FIXTURE_SUPABASE_URL');
const serviceRoleKey = required('SMOKE_FIXTURE_SERVICE_ROLE_KEY');
if (!['local', 'staging'].includes(environment)) fail('SMOKE_FIXTURE_ENVIRONMENT must be local or staging. Production fixture mutation is refused.');
if (!allowMutation) fail('Set SMOKE_FIXTURE_ALLOW_MUTATION=true only for a disposable fixture environment.');
if (process.env.VITE_SUPABASE_ANON_KEY || process.env.SMOKE_SUPABASE_PUBLISHABLE_KEY) console.warn('Fixture setup is a separate admin-only process; the browser smoke runner still requires a publishable key.');

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const mode = process.argv[2] ?? 'create';
const fixturePassword = mode === 'create' ? required('SMOKE_FIXTURE_PASSWORD') : '';

if (mode === 'reset') {
  await resetFixture();
} else if (mode === 'create') {
  await createFixture();
} else {
  fail('Usage: node tools/operational-smoke-fixtures.mjs [create|reset]');
}

async function createFixture() {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const manager = await createUser(`b14-manager-${suffix}@example.invalid`, 'B14 manager');
  const driver = await createUser(`b14-driver-${suffix}@example.invalid`, 'B14 driver');
  const wrongDriver = await createUser(`b14-wrong-driver-${suffix}@example.invalid`, 'B14 wrong driver');
  const otherManager = await createUser(`b14-other-manager-${suffix}@example.invalid`, 'B14 other manager');
  const otherDriver = await createUser(`b14-other-driver-${suffix}@example.invalid`, 'B14 other driver');
  const company = await createCompany(`Batch 14 disposable A ${suffix}`, manager.id);
  const otherCompany = await createCompany(`Batch 14 disposable B ${suffix}`, otherManager.id);
  await insertProfile(manager, company.id, 'manager');
  await insertProfile(driver, company.id, 'driver');
  await insertProfile(wrongDriver, company.id, 'driver');
  await insertProfile(otherManager, otherCompany.id, 'manager');
  await insertProfile(otherDriver, otherCompany.id, 'driver');

  const readyVehicle = await insertVehicle(company.id, `B14-V-${suffix}`, 'vehicle', false);
  const readyTrailer = await insertVehicle(company.id, `B14-T-${suffix}`, 'trailer', false);
  const prohibitedTrailer = await insertVehicle(company.id, `B14-VOR-${suffix}`, 'trailer', true);
  const shift = await insertShift(company.id, driver.id, manager.id, readyVehicle.id);
  const otherShift = await insertShift(otherCompany.id, otherDriver.id, otherManager.id, null);
  const otherJob = await insertJob(otherCompany.id, otherManager.id, `B14-CROSS-${suffix}`);
  const otherAssignment = await insertAssignment(otherCompany.id, otherJob.id, otherShift.id, otherDriver.id, otherManager.id);
  const forbiddenPath = `${otherCompany.id}/${otherAssignment.id}/${randomUUID()}-forbidden.txt`;
  const { error: uploadError } = await admin.storage.from('pod-evidence').upload(forbiddenPath, new Blob(['Batch 14 cross-company object']), { upsert: false, contentType: 'text/plain' });
  if (uploadError) throw new Error(`Unable to create cross-company storage fixture: ${uploadError.message}`);

  const manifest = {
    environment,
    companyId: company.id,
    otherCompanyId: otherCompany.id,
    manager: { id: manager.id, email: manager.email, password: fixturePassword },
    driver: { id: driver.id, email: driver.email, password: fixturePassword },
    wrongDriver: { id: wrongDriver.id, email: wrongDriver.email, password: fixturePassword },
    otherManager: { id: otherManager.id, email: otherManager.email, password: fixturePassword },
    otherDriver: { id: otherDriver.id, email: otherDriver.email, password: fixturePassword },
    shiftId: shift.id,
    readyTrailerId: readyTrailer.id,
    prohibitedTrailerId: prohibitedTrailer.id,
    crossCompanyAssignmentId: otherAssignment.id,
    crossCompanyAssignmentUpdatedAt: otherAssignment.updated_at,
    forbiddenPodPath: forbiddenPath,
    userIds: [manager.id, driver.id, wrongDriver.id, otherManager.id, otherDriver.id],
    storagePaths: [forbiddenPath],
  };
  const manifestPath = process.env.SMOKE_FIXTURE_MANIFEST;
  if (manifestPath) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    manifestPath: manifestPath ?? null,
    browserSmokeEnvironment: environment,
    browserSmokeVariables: {
      SMOKE_ENVIRONMENT: environment,
      SMOKE_ALLOW_MUTATION: 'true',
      SMOKE_SUPABASE_URL: url,
      SMOKE_SUPABASE_PUBLISHABLE_KEY: '<set from the publishable/anon key outside this script>',
      SMOKE_MANAGER_EMAIL: manager.email,
      SMOKE_MANAGER_PASSWORD: fixturePassword,
      SMOKE_DRIVER_EMAIL: driver.email,
      SMOKE_DRIVER_PASSWORD: fixturePassword,
      SMOKE_WRONG_DRIVER_EMAIL: wrongDriver.email,
      SMOKE_WRONG_DRIVER_PASSWORD: fixturePassword,
      SMOKE_SHIFT_ID: shift.id,
      SMOKE_TRAILER_ID: readyTrailer.id,
      SMOKE_PROHIBITED_TRAILER_ID: prohibitedTrailer.id,
      SMOKE_CROSS_COMPANY_ASSIGNMENT_ID: otherAssignment.id,
      SMOKE_CROSS_COMPANY_ASSIGNMENT_UPDATED_AT: otherAssignment.updated_at,
      SMOKE_FORBIDDEN_POD_PATH: forbiddenPath,
    },
    reset: `SMOKE_FIXTURE_ENVIRONMENT=${environment} SMOKE_FIXTURE_ALLOW_MUTATION=true SMOKE_FIXTURE_SUPABASE_URL=<same-url> SMOKE_FIXTURE_SERVICE_ROLE_KEY=<same-key> SMOKE_FIXTURE_MANIFEST=<manifest-path> node tools/operational-smoke-fixtures.mjs reset`,
  }, null, 2));
}

async function resetFixture() {
  const manifestPath = required('SMOKE_FIXTURE_MANIFEST');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.storagePaths?.length) {
    const { error } = await admin.storage.from('pod-evidence').remove(manifest.storagePaths);
    if (error) throw new Error(`Unable to remove fixture storage objects: ${error.message}`);
  }
  const { error: companyError } = await admin.from('companies').delete().in('id', [manifest.companyId, manifest.otherCompanyId]);
  if (companyError) throw new Error(`Unable to remove fixture companies: ${companyError.message}`);
  for (const userId of manifest.userIds ?? []) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Unable to remove fixture auth user ${userId}: ${error.message}`);
  }
  console.log(JSON.stringify({ ok: true, removedCompanies: [manifest.companyId, manifest.otherCompanyId], removedUsers: manifest.userIds ?? [], removedStoragePaths: manifest.storagePaths ?? [] }, null, 2));
}

async function createUser(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: fixturePassword, email_confirm: true });
  if (error || !data.user) throw new Error(`Unable to create fixture auth user: ${error?.message ?? 'missing user'}`);
  return { id: data.user.id, email, fullName };
}

async function createCompany(name, createdBy) {
  const { data, error } = await admin.from('companies').insert({ name, auth_code: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(), auth_code_expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_by: createdBy }).select('id').single();
  if (error || !data) throw new Error(`Unable to create fixture company: ${error?.message ?? 'missing company'}`);
  return data;
}

async function insertProfile(user, companyId, role) {
  const { error } = await admin.from('profiles').insert({ id: user.id, user_id: user.id, email: user.email, role, company_id: companyId, full_name: user.fullName, account_type: role === 'manager' ? 'fleet' : 'solo', is_active: true, driving_licence_number: role === 'driver' ? 'B14-FIXTURE-LICENCE' : null, driving_licence_expiry: role === 'driver' ? '2099-12-31' : null, cpc_dqc_number: role === 'driver' ? 'B14-FIXTURE-CPC' : null, cpc_dqc_expiry: role === 'driver' ? '2099-12-31' : null });
  if (error) throw new Error(`Unable to create fixture profile: ${error.message}`);
}

async function insertVehicle(companyId, regNumber, kind, isVor) {
  const { data, error } = await admin.from('vehicles').insert({ company_id: companyId, reg_number: regNumber, make: 'Batch14', model: 'Disposable', vehicle_type: kind, vehicle_class: kind, is_vor: isVor, mot_due_date: '2099-12-31', pmi_due_date: '2099-12-31', loler_due_date: kind === 'trailer' ? '2099-12-31' : null, insurance_expiry: '2099-12-31', tacho_calibration_due: '2099-12-31' }).select('id').single();
  if (error || !data) throw new Error(`Unable to create fixture vehicle: ${error?.message ?? 'missing vehicle'}`);
  return data;
}

async function insertShift(companyId, driverId, managerId, vehicleId) {
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await admin.from('shifts').insert({ company_id: companyId, driver_id: driverId, vehicle_id: vehicleId, date, start_time: '08:00:00', end_time: '17:00:00', status: 'published', published_at: new Date().toISOString(), published_by: managerId, notes: 'Batch 14 disposable smoke fixture' }).select('id').single();
  if (error || !data) throw new Error(`Unable to create fixture shift: ${error?.message ?? 'missing shift'}`);
  return data;
}

async function insertJob(companyId, managerId, reference) {
  const { data, error } = await admin.from('jobs').insert({ company_id: companyId, created_by: managerId, reference, title: 'Batch 14 disposable cross-company job', job_type: 'delivery', address_text: 'Disposable fixture location', customer_name: 'Batch 14 fixture' }).select('id').single();
  if (error || !data) throw new Error(`Unable to create fixture job: ${error?.message ?? 'missing job'}`);
  return data;
}

async function insertAssignment(companyId, jobId, shiftId, driverId, managerId) {
  const { data, error } = await admin.from('job_assignments').insert({ company_id: companyId, job_id: jobId, shift_id: shiftId, driver_id: driverId, sequence: 1, status: 'published', published_at: new Date().toISOString(), published_by: managerId }).select('id, updated_at').single();
  if (error || !data) throw new Error(`Unable to create fixture assignment: ${error?.message ?? 'missing assignment'}`);
  return data;
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required.`);
  return value;
}

function fail(message) {
  console.error(`Operational smoke fixture setup blocked: ${message}`);
  process.exit(1);
}
