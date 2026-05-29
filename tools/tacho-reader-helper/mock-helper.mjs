import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';

const HOST = process.env.TACHO_HELPER_HOST || '127.0.0.1';
const PORT = Number(process.env.TACHO_HELPER_PORT || '47231');
const VERSION = 'mock-0.3.0';
const EXPORT_ROOT = process.env.TACHO_HELPER_EXPORT_ROOT || 'C:\\TachoReaderMock\\exports';
const MOCK_COMPANY_ID = process.env.TACHO_HELPER_COMPANY_ID || 'mock-company-001';
const SCENARIOS = ['success', 'slow_upload', 'backend_failure', 'missing_driver'];

const demoDrivers = [
  { driverId: 'mock-driver-001', driverName: 'Lewis Carter', focusedDate: '2026-05-28', cardNumber: 'UK000111222' },
  { driverId: 'mock-driver-002', driverName: 'Declan Murphy', focusedDate: '2026-05-29', cardNumber: 'UK000111333' },
  { driverId: 'mock-driver-003', driverName: 'Amanda Reid', focusedDate: '2026-05-30', cardNumber: 'UK000111444' },
];

let readSequence = 0;
let transitionTimers = [];
let cardInsertTimer = null;
let currentRead = null;

const state = {
  stage: 'ready',
  progressPercent: 10,
  message: 'Mock helper online. Waiting for a card.',
  detail: 'The simulated helper is running locally and ready for UI testing.',
  helperVersion: VERSION,
  readerConnected: true,
  cardPresent: false,
  canStartRead: false,
  canCancel: false,
  lastHeartbeatAt: new Date().toISOString(),
  importId: undefined,
  sourceType: undefined,
  driverId: undefined,
  driverName: undefined,
  focusedDate: undefined,
  errorCode: undefined,
  companyId: MOCK_COMPANY_ID,
  readSessionId: undefined,
  exportFileName: undefined,
  exportFilePath: undefined,
  exportDownloadPath: undefined,
  exportFileSizeBytes: undefined,
  exportSha256: undefined,
  driverCardNumberHint: undefined,
  vehicleRegHint: undefined,
  uploadReceiptId: undefined,
  uploadPercent: undefined,
  backendJobId: undefined,
  uploadedStoragePath: undefined,
  scenario: 'success',
  availableScenarios: SCENARIOS,
};

function log(message) {
  process.stdout.write(`[tacho-helper-mock] ${message}\n`);
}

function updateState(patch) {
  Object.assign(state, patch, {
    lastHeartbeatAt: new Date().toISOString(),
  });
}

function clearTransitions() {
  for (const timer of transitionTimers) {
    clearTimeout(timer);
  }
  transitionTimers = [];
}

function clearReadArtifacts() {
  currentRead = null;
  updateState({
    importId: undefined,
    sourceType: undefined,
    driverId: undefined,
    driverName: undefined,
    focusedDate: undefined,
    errorCode: undefined,
    readSessionId: undefined,
    exportFileName: undefined,
    exportFilePath: undefined,
    exportDownloadPath: undefined,
    exportFileSizeBytes: undefined,
    exportSha256: undefined,
    driverCardNumberHint: undefined,
    vehicleRegHint: undefined,
    uploadReceiptId: undefined,
    uploadPercent: undefined,
    backendJobId: undefined,
    uploadedStoragePath: undefined,
  });
}

function formatDateToken(dateString) {
  return dateString.replace(/-/g, '');
}

function timestampToken() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ];
  return parts.join('');
}

function buildMockExportBuffer(sample, sequence) {
  const seed = Buffer.from(`HourWiseEU|${sample.driverName}|${sample.focusedDate}|${sample.cardNumber}|${sequence}`, 'utf8');
  const sizeBytes = 262_144 + sequence * 8_192;
  const buffer = Buffer.alloc(sizeBytes);
  for (let index = 0; index < sizeBytes; index += 1) {
    buffer[index] = seed[index % seed.length];
  }
  return buffer;
}

function buildSessionArtifacts(sample) {
  const sessionToken = timestampToken();
  const driverToken = sample.driverName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const exportFileName = `${driverToken}_${formatDateToken(sample.focusedDate)}_${sessionToken}.C1B`;
  const readSessionId = `read_${randomUUID()}`;
  const uploadReceiptId = `upl_${randomUUID()}`;
  const backendJobId = `job_${randomUUID()}`;
  const fileBuffer = buildMockExportBuffer(sample, readSequence);
  const exportSha256 = createHash('sha256').update(fileBuffer).digest('hex');

  return {
    readSessionId,
    sourceType: 'driver_card',
    exportFileName,
    exportFilePath: `${EXPORT_ROOT}\\${exportFileName}`,
    exportDownloadPath: `/exports/${readSessionId}/file`,
    exportFileSizeBytes: fileBuffer.byteLength,
    exportSha256,
    uploadReceiptId,
    backendJobId,
    fileBuffer,
  };
}

function scheduleCardInsert(delayMs = 1500) {
  if (cardInsertTimer) {
    clearTimeout(cardInsertTimer);
  }

  cardInsertTimer = setTimeout(() => {
    clearReadArtifacts();
    updateState({
      stage: 'card_inserted',
      progressPercent: 20,
      message: 'Mock driver card inserted.',
      detail: 'Use Start read in the portal to simulate a reader export.',
      cardPresent: true,
      canStartRead: true,
      canCancel: false,
    });
    log('Simulated card insertion');
  }, delayMs);
}

function resetToReady(detail = 'The simulated helper is running locally and ready for UI testing.') {
  clearTransitions();
  clearReadArtifacts();
  updateState({
    stage: 'ready',
    progressPercent: 10,
    message: 'Mock helper online. Waiting for a card.',
    detail,
    cardPresent: false,
    canStartRead: false,
    canCancel: false,
  });
  scheduleCardInsert();
}

function getScenarioProfile() {
  switch (state.scenario) {
    case 'slow_upload':
      return {
        exportReadyDelayMs: 2400,
        uploadPercent: 35,
        backendResolutionDelayMs: 5200,
      };
    case 'backend_failure':
      return {
        exportReadyDelayMs: 1400,
        uploadPercent: 55,
        backendResolutionDelayMs: 2200,
      };
    case 'missing_driver':
      return {
        exportReadyDelayMs: 1400,
        uploadPercent: 55,
        backendResolutionDelayMs: 1800,
      };
    default:
      return {
        exportReadyDelayMs: 1400,
        uploadPercent: 55,
        backendResolutionDelayMs: 1800,
      };
  }
}

function beginReadFlow(payload = {}) {
  clearTransitions();
  if (cardInsertTimer) {
    clearTimeout(cardInsertTimer);
    cardInsertTimer = null;
  }

  if (typeof payload.companyId === 'string' && payload.companyId.trim()) {
    updateState({ companyId: payload.companyId.trim() });
  }

  const sample = demoDrivers[readSequence % demoDrivers.length];
  const artifacts = buildSessionArtifacts(sample);
  const scenarioProfile = getScenarioProfile();
  readSequence += 1;
  currentRead = {
    sample,
    artifacts,
  };

  updateState({
    stage: 'reading',
    progressPercent: 45,
    message: 'Reading driver card.',
    detail: `The mock helper is exporting ${artifacts.exportFileName} from the simulated reader session.`,
    cardPresent: true,
    canStartRead: false,
    canCancel: true,
    importId: undefined,
    sourceType: artifacts.sourceType,
    driverId: undefined,
    driverName: sample.driverName,
    focusedDate: undefined,
    errorCode: undefined,
    readSessionId: artifacts.readSessionId,
    exportFileName: artifacts.exportFileName,
    exportFilePath: artifacts.exportFilePath,
    exportDownloadPath: undefined,
    exportFileSizeBytes: artifacts.exportFileSizeBytes,
    exportSha256: artifacts.exportSha256,
    driverCardNumberHint: sample.cardNumber,
    vehicleRegHint: undefined,
    uploadReceiptId: artifacts.uploadReceiptId,
    uploadPercent: 0,
    backendJobId: undefined,
    uploadedStoragePath: undefined,
  });
  log(`Started mock read ${artifacts.readSessionId}`);

  transitionTimers.push(
    setTimeout(() => {
      if (!currentRead || currentRead.artifacts.readSessionId !== artifacts.readSessionId) return;
      updateState({
        stage: 'uploading',
        progressPercent: 70,
        message: 'Reader export ready for portal upload.',
        detail: `${artifacts.exportFileName} is ready for the browser-assisted upload flow.`,
        canCancel: true,
        exportDownloadPath: artifacts.exportDownloadPath,
        uploadPercent: scenarioProfile.uploadPercent,
      });
      log(`Export ready for ${artifacts.readSessionId}`);
    }, scenarioProfile.exportReadyDelayMs)
  );
}

function finishRegisteredImport(importPayload) {
  if (!currentRead) {
    throw new Error('No active helper export is available to register.');
  }

  const scenarioProfile = getScenarioProfile();
  const { sample, artifacts } = currentRead;

  updateState({
    stage: 'processing',
    progressPercent: 90,
    message: 'Processing tachograph import.',
    detail: `Portal upload registered for import ${importPayload.importId}. Backend job ${artifacts.backendJobId} is running.`,
    canCancel: true,
    importId: importPayload.importId,
    sourceType: importPayload.sourceType ?? artifacts.sourceType,
    uploadPercent: 100,
    uploadedStoragePath: importPayload.uploadedStoragePath,
    backendJobId: artifacts.backendJobId,
  });
  log(`Registered import ${importPayload.importId} for ${artifacts.readSessionId}`);

  if (state.scenario === 'backend_failure') {
    transitionTimers.push(
      setTimeout(() => {
        failFlow(
          'backend_job_failed',
          `Backend job ${artifacts.backendJobId} failed after import ${importPayload.importId} was registered.`,
          {
            importId: importPayload.importId,
            sourceType: importPayload.sourceType ?? artifacts.sourceType,
            driverName: sample.driverName,
            readSessionId: artifacts.readSessionId,
            exportFileName: artifacts.exportFileName,
            exportFilePath: artifacts.exportFilePath,
            exportDownloadPath: artifacts.exportDownloadPath,
            exportFileSizeBytes: artifacts.exportFileSizeBytes,
            exportSha256: artifacts.exportSha256,
            driverCardNumberHint: sample.cardNumber,
            uploadReceiptId: artifacts.uploadReceiptId,
            uploadPercent: 100,
            backendJobId: artifacts.backendJobId,
            uploadedStoragePath: importPayload.uploadedStoragePath,
          }
        );
      }, scenarioProfile.backendResolutionDelayMs)
    );
    return;
  }

  transitionTimers.push(
    setTimeout(() => {
      const hasMatchedDriver = state.scenario !== 'missing_driver';
      updateState({
        stage: 'complete',
        progressPercent: 100,
        message: hasMatchedDriver ? 'Driver review ready.' : 'Import complete but driver correlation missing.',
        detail: hasMatchedDriver
          ? `Backend job ${artifacts.backendJobId} finished. Import ${importPayload.importId} is linked to ${sample.driverName}.`
          : `Backend job ${artifacts.backendJobId} finished, but import ${importPayload.importId} could not be matched to a driver record.`,
        canCancel: false,
        cardPresent: false,
        driverId: hasMatchedDriver ? sample.driverId : undefined,
        driverName: hasMatchedDriver ? sample.driverName : undefined,
        focusedDate: hasMatchedDriver ? sample.focusedDate : undefined,
        uploadPercent: 100,
        backendJobId: artifacts.backendJobId,
        uploadReceiptId: artifacts.uploadReceiptId,
        uploadedStoragePath: importPayload.uploadedStoragePath,
      });
      log(
        hasMatchedDriver
          ? `Completed mock read ${importPayload.importId} for ${sample.driverId}`
          : `Completed mock read ${importPayload.importId} without driver correlation`
      );
      scheduleCardInsert(3000);
    }, scenarioProfile.backendResolutionDelayMs)
  );
}

function failFlow(errorCode, detail, extraPatch = {}) {
  clearTransitions();
  updateState({
    stage: 'error',
    progressPercent: 100,
    message: 'Mock helper entered an error state.',
    detail,
    canStartRead: true,
    canCancel: false,
    errorCode,
    ...extraPatch,
  });
  scheduleCardInsert(3000);
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendBinary(response, statusCode, body, fileName) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/octet-stream',
    'Content-Length': body.byteLength,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/status') {
    updateState({});
    sendJson(response, 200, state);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/exports/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const readSessionId = parts[1];
    if (!currentRead || currentRead.artifacts.readSessionId !== readSessionId) {
      sendJson(response, 404, { error: 'Export not found', readSessionId });
      return;
    }

    sendBinary(response, 200, currentRead.artifacts.fileBuffer, currentRead.artifacts.exportFileName);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/commands/start-read') {
    const payload = await readJsonBody(request).catch((error) => {
      sendJson(response, 400, { accepted: false, error: error.message });
    });
    if (response.writableEnded) return;

    if (!state.canStartRead) {
      sendJson(response, 409, {
        accepted: false,
        error: `Cannot start read while stage is ${state.stage}.`,
      });
      return;
    }

    beginReadFlow(payload);
    sendJson(response, 202, {
      accepted: true,
      stage: state.stage,
      readSessionId: state.readSessionId,
      companyId: state.companyId,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/commands/cancel') {
    await readJsonBody(request).catch((error) => {
      sendJson(response, 400, { accepted: false, error: error.message });
    });
    if (response.writableEnded) return;

    if (!state.canCancel) {
      sendJson(response, 409, {
        accepted: false,
        error: `Cannot cancel while stage is ${state.stage}.`,
      });
      return;
    }

    resetToReady('The active mock read was cancelled. Waiting for a fresh card insertion.');
    sendJson(response, 202, {
      accepted: true,
      stage: state.stage,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/imports/register') {
    const payload = await readJsonBody(request).catch((error) => {
      sendJson(response, 400, { accepted: false, error: error.message });
    });
    if (response.writableEnded) return;

    if (!currentRead) {
      sendJson(response, 409, {
        accepted: false,
        error: 'No active helper export is waiting for browser registration.',
      });
      return;
    }

    if (payload?.readSessionId !== currentRead.artifacts.readSessionId) {
      sendJson(response, 409, {
        accepted: false,
        error: `Read session mismatch. Expected ${currentRead.artifacts.readSessionId}.`,
      });
      return;
    }

    if (typeof payload?.importId !== 'string' || !payload.importId.trim()) {
      sendJson(response, 400, {
        accepted: false,
        error: 'Import id is required.',
      });
      return;
    }

    if (typeof payload?.uploadedStoragePath !== 'string' || !payload.uploadedStoragePath.trim()) {
      sendJson(response, 400, {
        accepted: false,
        error: 'Uploaded storage path is required.',
      });
      return;
    }

    finishRegisteredImport({
      importId: payload.importId.trim(),
      uploadedStoragePath: payload.uploadedStoragePath.trim(),
      sourceType: typeof payload.sourceType === 'string' ? payload.sourceType : currentRead.artifacts.sourceType,
    });

    sendJson(response, 202, {
      accepted: true,
      stage: state.stage,
      importId: state.importId,
      backendJobId: state.backendJobId,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/debug/reset') {
    resetToReady();
    sendJson(response, 202, { accepted: true, stage: state.stage });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/debug/card-insert') {
    clearTransitions();
    if (cardInsertTimer) {
      clearTimeout(cardInsertTimer);
      cardInsertTimer = null;
    }
    clearReadArtifacts();
    updateState({
      stage: 'card_inserted',
      progressPercent: 20,
      message: 'Mock driver card inserted.',
      detail: 'The helper is ready to simulate a read immediately.',
      cardPresent: true,
      canStartRead: true,
      canCancel: false,
      errorCode: undefined,
    });
    sendJson(response, 202, { accepted: true, stage: state.stage });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/debug/error') {
    failFlow('mock_error', 'A forced mock error was requested for UI testing.');
    sendJson(response, 202, { accepted: true, stage: state.stage, errorCode: state.errorCode });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/debug/scenario') {
    const payload = await readJsonBody(request).catch((error) => {
      sendJson(response, 400, { accepted: false, error: error.message });
    });
    if (response.writableEnded) return;

    const scenario = payload?.scenario;
    if (!SCENARIOS.includes(scenario)) {
      sendJson(response, 400, {
        accepted: false,
        error: `Unsupported scenario '${scenario}'.`,
        availableScenarios: SCENARIOS,
      });
      return;
    }

    updateState({
      scenario,
    });

    sendJson(response, 202, {
      accepted: true,
      scenario: state.scenario,
      availableScenarios: SCENARIOS,
    });
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
    path: url.pathname,
  });
});

server.listen(PORT, HOST, () => {
  log(`Listening on http://${HOST}:${PORT}`);
  resetToReady();
});

function shutdown(signal) {
  log(`Received ${signal}, shutting down`);
  clearTransitions();
  if (cardInsertTimer) {
    clearTimeout(cardInsertTimer);
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
