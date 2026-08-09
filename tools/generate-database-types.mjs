import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectId = 'lcvahjmoobmpifrexurb';
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const generated = execFileSync(command, [
  'supabase',
  'gen',
  'types',
  '--lang=typescript',
  '--project-id',
  projectId,
  '--schema',
  'public',
], { encoding: 'utf8' });

const header = [
  '// Generated from the live Supabase public schema.',
  `// Source project: ${projectId}`,
  `// Regenerate with: supabase gen types --lang=typescript --project-id ${projectId} --schema public`,
  '// Do not edit manually.',
  '',
].join('\n');

writeFileSync(resolve('src/lib/database.types.ts'), `${header}${generated.trimEnd()}\n`, 'utf8');
