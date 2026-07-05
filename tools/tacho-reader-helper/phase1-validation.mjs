import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_PORT = 47236;
const HELPER_PROJECT = resolve('tools/tacho-reader-helper/windows-helper/HourWise.TachoReaderHelper.csproj');
const CONTRACT_PROBE = resolve('tools/tacho-reader-helper/contract-probe.mjs');
const TEST_EXPORTER = resolve('tools/tacho-reader-helper/write-test-export.mjs');

function parseArgs(argv) {
  const args = {
    port: Number(process.env.TACHO_HELPER_PHASE1_PORT || DEFAULT_PORT),
    timeoutMs: Number(process.env.TACHO_HELPER_PHASE1_TIMEOUT_MS || 45000),
    keepArtifacts: process.env.TACHO_HELPER_PHASE1_KEEP_ARTIFACTS === 'true',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--port' && next) {
      args.port = Number(next);
      index += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      index += 1;
    } else if (arg === '--keep-artifacts') {
      args.keepArtifacts = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.port) || args.port <= 0) {
    throw new Error(`Invalid port: ${args.port}`);
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 5000) {
    throw new Error(`Invalid timeout: ${args.timeoutMs}`);
  }

  return args;
}

function printUsage() {
  process.stdout.write(`Usage: npm run tacho:helper:phase1 -- [options]\n\n`);
  process.stdout.write(`Starts the real Windows helper in simulated-card external-export mode and runs the Phase 1 read/export/register probe.\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --port <port>        Local helper port. Default: ${DEFAULT_PORT}\n`);
  process.stdout.write(`  --timeout-ms <ms>    Helper/probe timeout. Default: 45000\n`);
  process.stdout.write(`  --keep-artifacts     Keep temporary export/log folders after the run.\n`);
}

function waitForExit(child) {
  return new Promise((resolvePromise) => {
    child.once('exit', (code, signal) => resolvePromise({ code, signal }));
  });
}

async function buildHelper(appDir, timeoutMs) {
  const build = spawn('dotnet', ['build', HELPER_PROJECT, '--configuration', 'Debug', '--output', appDir], {
    stdio: 'pipe',
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  build.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  build.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const result = await Promise.race([
    waitForExit(build),
    delay(timeoutMs).then(() => null),
  ]);

  if (!result) {
    build.kill('SIGKILL');
    throw new Error(`Timed out building helper after ${timeoutMs}ms.`);
  }

  if (result.code !== 0) {
    throw new Error(`Helper build failed with code ${result.code}.\n${stderr || stdout}`);
  }
}

async function waitForHelper(baseUrl, timeoutMs, child) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Helper process exited before becoming ready with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`GET /status returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for helper at ${baseUrl}: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

async function runProbe(baseUrl, timeoutMs, env) {
  const probe = spawn(
    process.execPath,
    [
      CONTRACT_PROBE,
      '--base-url',
      baseUrl,
      '--mode',
      'read',
      '--company-id',
      'helper-003-company',
      '--user-id',
      'helper-003-user',
      '--timeout-ms',
      String(timeoutMs),
    ],
    {
      stdio: 'pipe',
      env,
      windowsHide: true,
    }
  );

  let stdout = '';
  let stderr = '';
  probe.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  probe.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const { code } = await waitForExit(probe);
  if (code !== 0) {
    throw new Error(`Phase 1 contract probe failed with code ${code}.\n${stderr || stdout}`);
  }

  return stdout.trim();
}

async function stopHelper(child) {
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  const stopped = await Promise.race([
    waitForExit(child),
    delay(3000).then(() => null),
  ]);
  if (stopped) return;

  child.kill('SIGKILL');
  await Promise.race([
    waitForExit(child),
    delay(1000),
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = `http://127.0.0.1:${args.port}`;
  const artifactRoot = join(tmpdir(), `hourwise-helper-003-${Date.now()}`);
  const appDir = join(artifactRoot, 'app');
  const exportDir = join(artifactRoot, 'exports');
  const logDir = join(artifactRoot, 'logs');

  await mkdir(appDir, { recursive: true });
  await mkdir(exportDir, { recursive: true });
  await mkdir(logDir, { recursive: true });

  const env = {
    ...process.env,
    TACHO_HELPER_PORT: String(args.port),
    TACHO_HELPER_HOST: '127.0.0.1',
    TACHO_HELPER_SIMULATE_CARD_PRESENT: 'true',
    TACHO_HELPER_COMPLETE_AFTER_REGISTER: 'true',
    TACHO_HELPER_ENABLE_EXTERNAL_EXPORTER: 'true',
    TACHO_HELPER_EXPORT_COMMAND: process.execPath,
    TACHO_HELPER_EXPORT_ARGS: `"${TEST_EXPORTER}" "{outputPath}"`,
    TACHO_HELPER_EXPORT_OUTPUT_DIR: exportDir,
    TACHO_HELPER_LOG_DIR: logDir,
  };

  await buildHelper(appDir, args.timeoutMs);

  const helperDll = join(appDir, 'HourWise.TachoReaderHelper.dll');
  const helper = spawn('dotnet', [helperDll], {
    stdio: 'pipe',
    env,
    windowsHide: true,
  });

  let helperOutput = '';
  helper.stdout.on('data', (chunk) => {
    helperOutput += chunk.toString();
  });
  helper.stderr.on('data', (chunk) => {
    helperOutput += chunk.toString();
  });

  try {
    await waitForHelper(baseUrl, args.timeoutMs, helper);
    const probeOutput = await runProbe(baseUrl, args.timeoutMs, env);
    process.stdout.write(`HELPER-003 Phase 1 validation passed.\n`);
    process.stdout.write(`${probeOutput}\n`);
    process.stdout.write(
      args.keepArtifacts
        ? `Artifacts retained: ${artifactRoot}\n`
        : `Temporary artifacts will be removed. Use --keep-artifacts to retain ${artifactRoot}\n`
    );
  } catch (error) {
    process.stderr.write(`HELPER-003 Phase 1 validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
    if (helperOutput.trim()) {
      process.stderr.write(`\nHelper output:\n${helperOutput.trim()}\n`);
    }
    process.stderr.write(`Artifacts retained for inspection: ${artifactRoot}\n`);
    process.exitCode = 1;
    return;
  } finally {
    await stopHelper(helper);
    if (!args.keepArtifacts && process.exitCode !== 1) {
      await rm(artifactRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`HELPER-003 Phase 1 validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
