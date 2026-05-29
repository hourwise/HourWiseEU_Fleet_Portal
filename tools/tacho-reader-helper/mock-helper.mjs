import http from 'node:http';

const HOST = process.env.TACHO_HELPER_HOST || '127.0.0.1';
const PORT = Number(process.env.TACHO_HELPER_PORT || '47231');
const VERSION = 'mock-0.1.0';

const demoDrivers = [
  { driverId: 'mock-driver-001', focusedDate: '2026-05-28' },
  { driverId: 'mock-driver-002', focusedDate: '2026-05-29' },
  { driverId: 'mock-driver-003', focusedDate: '2026-05-30' },
];

let readSequence = 0;
let transitionTimers = [];
let cardInsertTimer = null;

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
  driverId: undefined,
  focusedDate: undefined,
  errorCode: undefined,
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

function scheduleCardInsert(delayMs = 1500) {
  if (cardInsertTimer) {
    clearTimeout(cardInsertTimer);
  }

  cardInsertTimer = setTimeout(() => {
    updateState({
      stage: 'card_inserted',
      progressPercent: 20,
      message: 'Mock driver card inserted.',
      detail: 'Use Start read in the portal to simulate a reader export.',
      cardPresent: true,
      canStartRead: true,
      canCancel: false,
      importId: undefined,
      driverId: undefined,
      focusedDate: undefined,
      errorCode: undefined,
    });
    log('Simulated card insertion');
  }, delayMs);
}

function resetToReady(detail = 'The simulated helper is running locally and ready for UI testing.') {
  clearTransitions();
  updateState({
    stage: 'ready',
    progressPercent: 10,
    message: 'Mock helper online. Waiting for a card.',
    detail,
    cardPresent: false,
    canStartRead: false,
    canCancel: false,
    importId: undefined,
    driverId: undefined,
    focusedDate: undefined,
    errorCode: undefined,
  });
  scheduleCardInsert();
}

function beginReadFlow() {
  clearTransitions();
  if (cardInsertTimer) {
    clearTimeout(cardInsertTimer);
    cardInsertTimer = null;
  }

  const sample = demoDrivers[readSequence % demoDrivers.length];
  readSequence += 1;
  const importId = `mock-import-${Date.now()}`;

  updateState({
    stage: 'reading',
    progressPercent: 45,
    message: 'Reading driver card.',
    detail: 'The mock helper is simulating a local card export.',
    cardPresent: true,
    canStartRead: false,
    canCancel: true,
    importId,
    driverId: undefined,
    focusedDate: undefined,
    errorCode: undefined,
  });
  log(`Started mock read ${importId}`);

  transitionTimers.push(
    setTimeout(() => {
      updateState({
        stage: 'uploading',
        progressPercent: 70,
        message: 'Uploading exported card file.',
        detail: 'The mock helper is simulating upload to the portal backend.',
        canCancel: true,
      });
    }, 1400)
  );

  transitionTimers.push(
    setTimeout(() => {
      updateState({
        stage: 'processing',
        progressPercent: 90,
        message: 'Processing tachograph import.',
        detail: 'The mock helper is waiting for backend processing to complete.',
        canCancel: true,
      });
    }, 2800)
  );

  transitionTimers.push(
    setTimeout(() => {
      updateState({
        stage: 'complete',
        progressPercent: 100,
        message: 'Driver review ready.',
        detail: 'The mock helper completed the flow and attached a focused review target.',
        canCancel: false,
        cardPresent: false,
        driverId: sample.driverId,
        focusedDate: sample.focusedDate,
      });
      log(`Completed mock read ${importId} for ${sample.driverId}`);
      scheduleCardInsert(3000);
    }, 4300)
  );
}

function failFlow(errorCode, detail) {
  clearTransitions();
  updateState({
    stage: 'error',
    progressPercent: 100,
    message: 'Mock helper entered an error state.',
    detail,
    canStartRead: true,
    canCancel: false,
    errorCode,
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

  if (request.method === 'POST' && url.pathname === '/commands/start-read') {
    await readJsonBody(request).catch((error) => {
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

    beginReadFlow();
    sendJson(response, 202, {
      accepted: true,
      stage: state.stage,
      importId: state.importId,
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
