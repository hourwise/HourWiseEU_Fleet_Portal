import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const BASE_URL = `http://${process.env.TACHO_HELPER_HOST || '127.0.0.1'}:${process.env.TACHO_HELPER_PORT || '47231'}`;
const HELPER_ENTRY = fileURLToPath(new URL('./mock-helper.mjs', import.meta.url));

const scenarios = [
  {
    name: 'success',
    expectedFinalStage: 'complete',
    assert(status, timeline, durationMs) {
      ensure(status.driverId, 'Expected a correlated driver id for success');
      ensure(status.uploadPercent === 100, 'Expected uploadPercent to finish at 100');
      ensure(timeline.includes('uploading'), 'Expected uploading stage in success timeline');
      ensure(timeline.includes('processing'), 'Expected processing stage in success timeline');
      ensure(durationMs < 9000, `Expected success to complete promptly, got ${durationMs}ms`);
    },
  },
  {
    name: 'slow_upload',
    expectedFinalStage: 'complete',
    assert(status, timeline, durationMs) {
      ensure(status.driverId, 'Expected a correlated driver id for slow_upload');
      ensure(timeline.includes('uploading'), 'Expected uploading stage in slow_upload timeline');
      ensure(durationMs >= 7000, `Expected slow_upload to take longer, got ${durationMs}ms`);
    },
  },
  {
    name: 'backend_failure',
    expectedFinalStage: 'error',
    assert(status, timeline) {
      ensure(status.errorCode === 'backend_job_failed', `Expected backend_job_failed, got ${status.errorCode}`);
      ensure(timeline.includes('processing'), 'Expected processing stage before backend failure');
      ensure(status.backendJobId, 'Expected backend job id on backend failure');
    },
  },
  {
    name: 'missing_driver',
    expectedFinalStage: 'complete',
    assert(status, timeline) {
      ensure(!status.driverId, 'Expected missing_driver to have no correlated driver id');
      ensure(status.importId, 'Expected import id for missing_driver');
      ensure(timeline.includes('processing'), 'Expected processing stage before missing_driver completion');
    },
  },
];

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function requestRaw(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function waitForHelper(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await request('/status');
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error('Mock helper did not become ready in time');
}

async function applyScenario(name) {
  await request('/debug/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: name, requestedAt: new Date().toISOString() }),
  });
  await request('/debug/card-insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestedAt: new Date().toISOString() }),
  });
}

async function runProtocolNegativeChecks() {
  await request('/debug/card-insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestedAt: new Date().toISOString() }),
  });

  const missingCompany = await requestRaw('/commands/start-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      requestedByUserId: 'scenario-runner',
    }),
  });
  ensure(missingCompany.response.status === 400, `Expected missing company to be rejected with 400, got ${missingCompany.response.status}`);
  ensure(missingCompany.body?.accepted === false, 'Expected missing company response to be rejected');

  const unsupportedSource = await requestRaw('/commands/start-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      companyId: 'mock-company-001',
      requestedByUserId: 'scenario-runner',
      sourceType: 'vehicle_unit',
    }),
  });
  ensure(
    unsupportedSource.response.status === 400,
    `Expected unsupported source type to be rejected with 400, got ${unsupportedSource.response.status}`
  );
  ensure(unsupportedSource.body?.accepted === false, 'Expected unsupported source response to be rejected');
}

async function startRead() {
  return request('/commands/start-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      companyId: 'mock-company-001',
      requestedByUserId: 'scenario-runner',
      sourceType: 'driver_card',
    }),
  });
}

async function waitForStage(targetStage, timeoutMs = 12000) {
  const start = Date.now();
  let lastStatus = null;
  while (Date.now() - start < timeoutMs) {
    const status = await request('/status');
    lastStatus = status;
    if (status.stage === targetStage) {
      return status;
    }
    await delay(300);
  }
  throw new Error(`Timed out waiting for stage '${targetStage}'. Last status: ${JSON.stringify(lastStatus)}`);
}

async function registerPortalImport(status) {
  ensure(status.readSessionId, 'Expected readSessionId before registering import');
  ensure(status.exportDownloadPath, 'Expected exportDownloadPath before registering import');

  const exportResponse = await fetch(`${BASE_URL}${status.exportDownloadPath}`);
  ensure(exportResponse.ok, `Expected export download to succeed, got ${exportResponse.status}`);
  const exportBuffer = Buffer.from(await exportResponse.arrayBuffer());
  ensure(exportBuffer.byteLength > 0, 'Expected downloaded export to contain bytes');
  if (typeof status.exportFileSizeBytes === 'number') {
    ensure(
      exportBuffer.byteLength === status.exportFileSizeBytes,
      `Expected exported byte size ${status.exportFileSizeBytes}, got ${exportBuffer.byteLength}`
    );
  }

  const importId = `tf_${randomUUID()}`;
  const uploadedStoragePath = `mock-company-001/${status.exportFileName || 'mock-export.C1B'}`;

  await request('/imports/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      readSessionId: status.readSessionId,
      importId,
      uploadedStoragePath,
      fileName: status.exportFileName,
      fileType: 'c1b',
      sourceType: status.sourceType || 'driver_card',
    }),
  });

  return { importId, uploadedStoragePath, exportBytes: exportBuffer.byteLength };
}

async function trackUntilFinal(expectedFinalStage, timeoutMs = 15000, initialTimeline = []) {
  const timeline = [...initialTimeline];
  const start = Date.now();
  let finalStatus = null;

  while (Date.now() - start < timeoutMs) {
    const status = await request('/status');
    if (timeline.at(-1) !== status.stage) {
      timeline.push(status.stage);
    }

    if (status.stage === expectedFinalStage) {
      finalStatus = status;
      break;
    }

    await delay(400);
  }

  if (!finalStatus) {
    throw new Error(`Timed out waiting for final stage '${expectedFinalStage}'. Timeline: ${timeline.join(' -> ')}`);
  }

  return {
    finalStatus,
    timeline,
    durationMs: Date.now() - start,
  };
}

async function runScenario(definition) {
  await applyScenario(definition.name);
  const scenarioStart = Date.now();
  const startResponse = await startRead();
  ensure(startResponse.accepted === true, `Scenario ${definition.name} did not accept start-read`);

  const exportReadyStatus = await waitForStage('uploading');
  const registration = await registerPortalImport(exportReadyStatus);
  const { finalStatus, timeline, durationMs } = await trackUntilFinal(definition.expectedFinalStage, 15000, [
    exportReadyStatus.stage,
  ]);

  ensure(finalStatus.scenario === definition.name, `Scenario echo mismatch: expected ${definition.name}, got ${finalStatus.scenario}`);
  ensure(finalStatus.importId === registration.importId, `Expected registered import id ${registration.importId}, got ${finalStatus.importId}`);
  const totalDurationMs = Date.now() - scenarioStart;
  definition.assert(finalStatus, timeline, totalDurationMs);

  return {
    scenario: definition.name,
    finalStage: finalStatus.stage,
    durationMs: totalDurationMs,
    timeline,
    importId: finalStatus.importId ?? registration.importId,
    backendJobId: finalStatus.backendJobId ?? null,
    driverId: finalStatus.driverId ?? null,
    errorCode: finalStatus.errorCode ?? null,
    exportBytes: registration.exportBytes,
  };
}

async function main() {
  const child = spawn(process.execPath, [HELPER_ENTRY], {
    stdio: 'pipe',
    env: process.env,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForHelper();
    await runProtocolNegativeChecks();
    const results = [];

    for (const scenario of scenarios) {
      results.push(await runScenario(scenario));
    }

    process.stdout.write(`\nMock helper scenario regression passed.\n`);
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    child.kill('SIGTERM');
    await delay(200);
  }
}

main().catch((error) => {
  process.stderr.write(`Mock helper scenario regression failed: ${error.message}\n`);
  process.exitCode = 1;
});
