import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const STAGES = new Set(['ready', 'card_inserted', 'reading', 'uploading', 'processing', 'complete', 'error']);

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.TACHO_HELPER_URL || `http://${process.env.TACHO_HELPER_HOST || '127.0.0.1'}:${process.env.TACHO_HELPER_PORT || '47231'}`,
    mode: 'smoke',
    companyId: process.env.TACHO_HELPER_COMPANY_ID || 'probe-company',
    userId: process.env.TACHO_HELPER_USER_ID || 'probe-user',
    timeoutMs: Number(process.env.TACHO_HELPER_PROBE_TIMEOUT_MS || 15000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--base-url' && next) {
      args.baseUrl = next;
      index += 1;
    } else if (arg === '--mode' && next) {
      args.mode = next;
      index += 1;
    } else if (arg === '--company-id' && next) {
      args.companyId = next;
      index += 1;
    } else if (arg === '--user-id' && next) {
      args.userId = next;
      index += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!['smoke', 'read'].includes(args.mode)) {
    throw new Error(`Unsupported probe mode '${args.mode}'. Use smoke or read.`);
  }

  args.baseUrl = args.baseUrl.replace(/\/$/, '');
  return args;
}

function printUsage() {
  process.stdout.write(`Usage: npm run tacho:helper:probe -- [options]\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --base-url <url>       Helper base URL. Default: http://127.0.0.1:47231\n`);
  process.stdout.write(`  --mode <smoke|read>    Smoke validates shape only. Read exercises export/register flow.\n`);
  process.stdout.write(`  --company-id <id>      Company id sent for read mode.\n`);
  process.stdout.write(`  --user-id <id>         User id sent for read mode.\n`);
  process.stdout.write(`  --timeout-ms <ms>      Poll timeout. Default: 15000\n`);
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 120)}`);
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await readJson(response);
  return { response, body };
}

function validateStatusShape(status) {
  ensure(status && typeof status === 'object', 'Status response must be a JSON object.');
  ensure(STAGES.has(status.stage), `Status stage must be one of ${Array.from(STAGES).join(', ')}. Got ${status.stage}.`);
  ensure(typeof status.progressPercent === 'number', 'Status progressPercent must be a number.');
  ensure(status.progressPercent >= 0 && status.progressPercent <= 100, 'Status progressPercent must be between 0 and 100.');
  ensure(typeof status.canStartRead === 'boolean', 'Status canStartRead must be a boolean.');
  ensure(typeof status.canCancel === 'boolean', 'Status canCancel must be a boolean.');
  if (status.readerConnected !== undefined) ensure(typeof status.readerConnected === 'boolean', 'readerConnected must be a boolean when present.');
  if (status.cardPresent !== undefined) ensure(typeof status.cardPresent === 'boolean', 'cardPresent must be a boolean when present.');
  if (status.readSessionId !== undefined) ensure(typeof status.readSessionId === 'string', 'readSessionId must be a string when present.');
  if (status.exportDownloadPath !== undefined) ensure(typeof status.exportDownloadPath === 'string', 'exportDownloadPath must be a string when present.');
  if (status.importId !== undefined) ensure(typeof status.importId === 'string', 'importId must be a string when present.');
}

async function runSmokeProbe(args) {
  const optionsResponse = await fetch(`${args.baseUrl}/status`, { method: 'OPTIONS' });
  ensure([200, 204].includes(optionsResponse.status), `OPTIONS /status should return 200 or 204, got ${optionsResponse.status}.`);

  const { response, body } = await requestJson(args.baseUrl, '/status');
  ensure(response.ok, `GET /status failed: ${response.status}`);
  validateStatusShape(body);

  return {
    mode: 'smoke',
    stage: body.stage,
    helperVersion: body.helperVersion ?? null,
    readerConnected: body.readerConnected ?? null,
    cardPresent: body.cardPresent ?? null,
  };
}

async function waitForStatus(args, predicate, description) {
  const startedAt = Date.now();
  let lastStatus = null;

  while (Date.now() - startedAt < args.timeoutMs) {
    const { response, body } = await requestJson(args.baseUrl, '/status');
    ensure(response.ok, `GET /status failed while waiting for ${description}: ${response.status}`);
    validateStatusShape(body);
    lastStatus = body;

    if (predicate(body)) {
      return body;
    }

    await delay(300);
  }

  throw new Error(`Timed out waiting for ${description}. Last status: ${JSON.stringify(lastStatus)}`);
}

async function waitUntilCanStart(args) {
  return waitForStatus(args, (status) => status.canStartRead === true, 'helper to allow start-read');
}

async function runReadProbe(args) {
  await runSmokeProbe(args);
  await waitUntilCanStart(args);

  const started = await requestJson(args.baseUrl, '/commands/start-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      companyId: args.companyId,
      requestedByUserId: args.userId,
      sourceType: 'driver_card',
    }),
  });

  ensure([200, 202].includes(started.response.status), `POST /commands/start-read should return 200 or 202, got ${started.response.status}.`);
  ensure(started.body?.accepted === true, 'start-read response must include accepted: true.');

  const uploading = await waitForStatus(args, (status) => status.stage === 'uploading' && status.exportDownloadPath, 'export download path');
  ensure(uploading.readSessionId, 'Uploading status must include readSessionId.');
  ensure(uploading.exportFileName, 'Uploading status should include exportFileName.');

  const exportResponse = await fetch(`${args.baseUrl}${uploading.exportDownloadPath}`);
  ensure(exportResponse.ok, `Export download failed: ${exportResponse.status}`);
  const exportBytes = Buffer.from(await exportResponse.arrayBuffer()).byteLength;
  ensure(exportBytes > 0, 'Export download must contain bytes.');
  if (typeof uploading.exportFileSizeBytes === 'number') {
    ensure(exportBytes === uploading.exportFileSizeBytes, `Export size mismatch: expected ${uploading.exportFileSizeBytes}, got ${exportBytes}.`);
  }

  const importId = `probe_${randomUUID()}`;
  const uploadedStoragePath = `${args.companyId}/${Date.now()}_${uploading.exportFileName || 'helper-export.C1B'}`;
  const registered = await requestJson(args.baseUrl, '/imports/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      readSessionId: uploading.readSessionId,
      importId,
      uploadedStoragePath,
      fileName: uploading.exportFileName,
      fileType: 'c1b',
      sourceType: uploading.sourceType || 'driver_card',
    }),
  });

  ensure([200, 202].includes(registered.response.status), `POST /imports/register should return 200 or 202, got ${registered.response.status}.`);
  ensure(registered.body?.accepted === true, 'imports/register response must include accepted: true.');

  const finalStatus = await waitForStatus(args, (status) => ['complete', 'error'].includes(status.stage), 'final helper stage');
  ensure(finalStatus.importId === importId, `Final status importId should be ${importId}, got ${finalStatus.importId}.`);

  return {
    mode: 'read',
    finalStage: finalStatus.stage,
    importId,
    backendJobId: finalStatus.backendJobId ?? null,
    driverId: finalStatus.driverId ?? null,
    errorCode: finalStatus.errorCode ?? null,
    exportBytes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args.mode === 'read' ? await runReadProbe(args) : await runSmokeProbe(args);
  process.stdout.write(`Tacho helper contract probe passed.\n`);
  process.stdout.write(`${JSON.stringify({ baseUrl: args.baseUrl, ...result }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Tacho helper contract probe failed: ${error.message}\n`);
  process.exitCode = 1;
});
