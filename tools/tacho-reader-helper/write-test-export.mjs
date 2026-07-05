import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

const outputPath = process.argv[2] || process.env.HOURWISE_TACHO_EXPORT_OUTPUT_PATH;

if (!outputPath) {
  process.stderr.write('Usage: node write-test-export.mjs <outputPath>\n');
  process.exit(2);
}

const sourceType = process.env.HOURWISE_TACHO_SOURCE_TYPE || 'driver_card';
const readSessionId = process.env.HOURWISE_TACHO_READ_SESSION_ID || 'unknown-read-session';
const exportedAt = new Date().toISOString();

const payload = Buffer.from(
  JSON.stringify(
    {
      container: 'hourwise.tachograph.phase1.external-export-test.v1',
      sourceType,
      readSessionId,
      exportedAt,
      note: 'Synthetic helper export for HELPER-003 Phase 1 contract validation only.',
    },
    null,
    2
  )
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, payload);

process.stdout.write(`Wrote ${payload.byteLength} bytes to ${outputPath}\n`);
