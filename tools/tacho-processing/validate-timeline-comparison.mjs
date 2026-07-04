#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const supabaseExe = path.join(repoRoot, 'supabase.exe');
const outputPath = path.join(repoRoot, 'supabase', '.temp', `time-006-timeline-validation-${new Date().toISOString().slice(0, 10)}.json`);

const VALIDATION_SQL = `
with recent_imports as (
  select
    tf.id,
    tf.company_id,
    coalesce(tf.source_type, case when tf.vehicle_id is not null then 'vehicle_unit' else 'driver_card' end) as source_type,
    tf.status,
    tf.uploaded_at
  from public.tachograph_files tf
  where tf.status in ('processed', 'partial')
    and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
    and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
  order by tf.uploaded_at desc
  limit 50
),
current_generations as (
  select distinct on (tg.source_import_id)
    tg.source_import_id,
    tg.id as timeline_generation_id,
    tg.status as timeline_status,
    tg.completed_at,
    tg.started_at
  from public.timeline_generations tg
  where tg.scope_type = 'import'
    and tg.is_current = true
  order by tg.source_import_id, tg.started_at desc
),
counts as (
  select
    ri.source_type,
    ri.status,
    ri.uploaded_at,
    cg.timeline_generation_id,
    cg.timeline_status,
    cg.completed_at,
    (select count(*) from public.tachograph_activity_segments tas where tas.import_id = ri.id) as tachograph_activity_count,
    (select count(*) from public.timeline_events te where te.timeline_generation_id = cg.timeline_generation_id) as timeline_event_count,
    (
      (select count(*) from public.tachograph_vehicle_motion_discrepancies tvmd where tvmd.import_id = ri.id)
      +
      (select count(*) from public.tachograph_reconciliation_items tri where tri.import_id = ri.id and tri.status <> 'matched')
    ) as tachograph_gap_count,
    (select count(*) from public.timeline_gaps tg where tg.timeline_generation_id = cg.timeline_generation_id) as timeline_gap_count,
    (select count(*) from public.tachograph_day_summaries tds where tds.import_id = ri.id) as tachograph_day_summary_count,
    (select count(*) from public.daily_timeline_summaries dts where dts.timeline_generation_id = cg.timeline_generation_id) as timeline_daily_summary_count
  from recent_imports ri
  left join current_generations cg on cg.source_import_id = ri.id
),
source_rollup as (
  select
    source_type,
    jsonb_build_object(
      'sampleSize', count(*),
      'withTimeline', count(*) filter (where timeline_generation_id is not null),
      'missingTimeline', count(*) filter (where timeline_generation_id is null),
      'countAligned', count(*) filter (
        where timeline_generation_id is not null
          and timeline_event_count >= tachograph_activity_count
          and timeline_gap_count = tachograph_gap_count
          and timeline_daily_summary_count = tachograph_day_summary_count
      ),
      'eventMismatches', count(*) filter (where timeline_generation_id is not null and timeline_event_count < tachograph_activity_count),
      'gapMismatches', count(*) filter (where timeline_generation_id is not null and timeline_gap_count <> tachograph_gap_count),
      'daySummaryMismatches', count(*) filter (where timeline_generation_id is not null and timeline_daily_summary_count <> tachograph_day_summary_count),
      'latestCompletedTimelineAt', max(completed_at),
      'latestImportAt', max(uploaded_at)
    ) as source_summary
  from counts
  group by source_type
)
select jsonb_pretty(jsonb_build_object(
  'validatedAt', now(),
  'scope', 'TIME-006 live aggregate validation',
  'sampleSize', (select count(*) from counts),
  'bySourceType', (
    select coalesce(jsonb_object_agg(source_type, source_summary order by source_type) filter (where source_type is not null), '{}'::jsonb)
    from source_rollup
  ),
  'totals', (
    select
    jsonb_build_object(
      'importsWithTimeline', count(*) filter (where timeline_generation_id is not null),
      'importsMissingTimeline', count(*) filter (where timeline_generation_id is null),
      'countAligned', count(*) filter (
        where timeline_generation_id is not null
          and timeline_event_count >= tachograph_activity_count
          and timeline_gap_count = tachograph_gap_count
          and timeline_daily_summary_count = tachograph_day_summary_count
      ),
      'eventMismatches', count(*) filter (where timeline_generation_id is not null and timeline_event_count < tachograph_activity_count),
      'gapMismatches', count(*) filter (where timeline_generation_id is not null and timeline_gap_count <> tachograph_gap_count),
      'daySummaryMismatches', count(*) filter (where timeline_generation_id is not null and timeline_daily_summary_count <> tachograph_day_summary_count)
    )
    from counts
  ),
  'candidateRecommendation', (
    select case
      when count(*) filter (
        where source_type = 'driver_card'
          and timeline_generation_id is not null
          and timeline_event_count >= tachograph_activity_count
          and timeline_gap_count = tachograph_gap_count
          and timeline_daily_summary_count = tachograph_day_summary_count
      ) > 0
      and count(*) filter (
        where source_type = 'vehicle_unit'
          and timeline_generation_id is not null
          and timeline_event_count >= tachograph_activity_count
          and timeline_gap_count = tachograph_gap_count
          and timeline_daily_summary_count = tachograph_day_summary_count
      ) > 0
        then 'Import Centre can be used to choose a timeline-native rendering candidate. Prefer the source type with more aligned imports and fewer mismatches.'
      when count(*) filter (
        where timeline_generation_id is not null
          and timeline_event_count >= tachograph_activity_count
          and timeline_gap_count = tachograph_gap_count
          and timeline_daily_summary_count = tachograph_day_summary_count
      ) > 0
        then 'Only one source type appears aligned. Keep production analysis screens parser-native until both driver-card and VU imports are represented.'
      else 'Do not choose a timeline-native rendering candidate yet. Generate or reprocess representative imports until timeline generations are present and count-aligned.'
    end
    from counts
  )
));
`;

function readLinkedConnection() {
  const result = spawnSync(supabaseExe, ['db', 'dump', '--linked', '--schema', 'public', '--data-only', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`Supabase CLI dry-run failed: ${result.stderr || result.stdout}`);
  }

  const values = {};
  for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
    const match = result.stdout.match(new RegExp(`export ${key}="([^"]*)"`));
    if (!match) throw new Error(`Could not read ${key} from Supabase CLI dry-run output.`);
    values[key] = match[1];
  }

  return {
    host: values.PGHOST,
    port: Number(values.PGPORT),
    user: values.PGUSER,
    password: values.PGPASSWORD,
    database: values.PGDATABASE,
  };
}

function cstring(value) {
  return Buffer.from(`${value}\0`);
}

function int32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function startupMessage(config) {
  const parts = [
    int32(196608),
    cstring('user'), cstring(config.user),
    cstring('database'), cstring(config.database),
    cstring('application_name'), cstring('hourwise-time-006-validator'),
    cstring('client_encoding'), cstring('UTF8'),
    Buffer.from([0]),
  ];
  const body = Buffer.concat(parts);
  return Buffer.concat([int32(body.length + 4), body]);
}

function typedMessage(type, body) {
  return Buffer.concat([Buffer.from(type), int32(body.length + 4), body]);
}

function passwordMessage(password) {
  return typedMessage('p', cstring(password));
}

function saslInitialResponse(mechanism, message) {
  const mechanismBuffer = cstring(mechanism);
  const messageBuffer = Buffer.from(message);
  return typedMessage('p', Buffer.concat([mechanismBuffer, int32(messageBuffer.length), messageBuffer]));
}

function saslResponse(message) {
  return typedMessage('p', Buffer.from(message));
}

function queryMessage(sql) {
  return typedMessage('Q', cstring(sql));
}

function md5Password(user, password, salt) {
  const inner = crypto.createHash('md5').update(password + user).digest('hex');
  return `md5${crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex')}`;
}

function saslEscape(value) {
  return value.replace(/=/g, '=3D').replace(/,/g, '=2C');
}

function parseScramAttributes(value) {
  return Object.fromEntries(value.split(',').map((part) => [part.slice(0, 1), part.slice(2)]));
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function xorBuffers(left, right) {
  const output = Buffer.alloc(left.length);
  for (let index = 0; index < left.length; index += 1) output[index] = left[index] ^ right[index];
  return output;
}

class PgConnection {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
    this.columns = [];
    this.rows = [];
  }

  async connect() {
    const rawSocket = await new Promise((resolve, reject) => {
      const socket = net.connect({ host: this.config.host, port: this.config.port });
      socket.once('connect', () => resolve(socket));
      socket.once('error', reject);
    });

    rawSocket.write(Buffer.concat([int32(8), int32(80877103)]));
    const sslResponse = await new Promise((resolve, reject) => {
      rawSocket.once('data', resolve);
      rawSocket.once('error', reject);
    });
    if (sslResponse[0] !== 83) throw new Error('Remote Postgres server did not accept SSL.');

    this.socket = tls.connect({
      socket: rawSocket,
      servername: this.config.host,
      // The linked Supabase CLI connection is already scoped to the project.
      // Some Windows Node installs do not trust the pooler's certificate chain.
      rejectUnauthorized: false,
    });
    await new Promise((resolve, reject) => {
      this.socket.once('secureConnect', resolve);
      this.socket.once('error', reject);
    });

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flushWaiters();
    });

    this.socket.write(startupMessage(this.config));
    await this.authenticate();
  }

  async authenticate() {
    let scram = null;

    while (true) {
      const message = await this.nextMessage();
      if (message.type === 'R') {
        const code = message.body.readInt32BE(0);
        if (code === 0) continue;
        if (code === 3) {
          this.socket.write(passwordMessage(this.config.password));
          continue;
        }
        if (code === 5) {
          this.socket.write(passwordMessage(md5Password(this.config.user, this.config.password, message.body.subarray(4, 8))));
          continue;
        }
        if (code === 10) {
          const nonce = crypto.randomBytes(18).toString('base64');
          const clientFirstBare = `n=${saslEscape(this.config.user)},r=${nonce}`;
          scram = {
            nonce,
            clientFirstBare,
            clientFirstMessage: `n,,${clientFirstBare}`,
          };
          this.socket.write(saslInitialResponse('SCRAM-SHA-256', scram.clientFirstMessage));
          continue;
        }
        if (code === 11) {
          if (!scram) throw new Error('Received SCRAM continuation before SCRAM start.');
          const serverFirst = message.body.subarray(4).toString('utf8');
          const attrs = parseScramAttributes(serverFirst);
          if (!attrs.r?.startsWith(scram.nonce)) throw new Error('SCRAM server nonce did not extend client nonce.');
          const clientFinalWithoutProof = `c=biws,r=${attrs.r}`;
          const saltedPassword = crypto.pbkdf2Sync(this.config.password, Buffer.from(attrs.s, 'base64'), Number(attrs.i), 32, 'sha256');
          const clientKey = hmac(saltedPassword, 'Client Key');
          const storedKey = crypto.createHash('sha256').update(clientKey).digest();
          const authMessage = `${scram.clientFirstBare},${serverFirst},${clientFinalWithoutProof}`;
          const clientSignature = hmac(storedKey, authMessage);
          const clientProof = xorBuffers(clientKey, clientSignature).toString('base64');
          this.socket.write(saslResponse(`${clientFinalWithoutProof},p=${clientProof}`));
          continue;
        }
        if (code === 12) continue;
        throw new Error(`Unsupported Postgres authentication code: ${code}`);
      }
      if (message.type === 'S' || message.type === 'K' || message.type === 'N') continue;
      if (message.type === 'E') throw new Error(this.parseError(message.body));
      if (message.type === 'Z') return;
    }
  }

  async query(sql) {
    this.columns = [];
    this.rows = [];
    this.socket.write(queryMessage(sql));

    while (true) {
      const message = await this.nextMessage();
      if (message.type === 'T') this.columns = this.parseRowDescription(message.body);
      if (message.type === 'D') this.rows.push(this.parseDataRow(message.body));
      if (message.type === 'E') throw new Error(this.parseError(message.body));
      if (message.type === 'Z') return this.rows;
    }
  }

  end() {
    if (this.socket) this.socket.end(typedMessage('X', Buffer.alloc(0)));
  }

  parseRowDescription(body) {
    let offset = 0;
    const count = body.readInt16BE(offset);
    offset += 2;
    const columns = [];
    for (let index = 0; index < count; index += 1) {
      const end = body.indexOf(0, offset);
      columns.push(body.subarray(offset, end).toString('utf8'));
      offset = end + 19;
    }
    return columns;
  }

  parseDataRow(body) {
    let offset = 0;
    const count = body.readInt16BE(offset);
    offset += 2;
    const row = {};
    for (let index = 0; index < count; index += 1) {
      const length = body.readInt32BE(offset);
      offset += 4;
      const column = this.columns[index] ?? `column_${index}`;
      if (length === -1) {
        row[column] = null;
      } else {
        row[column] = body.subarray(offset, offset + length).toString('utf8');
        offset += length;
      }
    }
    return row;
  }

  parseError(body) {
    const fields = {};
    let offset = 0;
    while (offset < body.length && body[offset] !== 0) {
      const key = String.fromCharCode(body[offset]);
      const end = body.indexOf(0, offset + 1);
      fields[key] = body.subarray(offset + 1, end).toString('utf8');
      offset = end + 1;
    }
    return fields.M ?? 'Unknown Postgres error';
  }

  async nextMessage() {
    while (this.buffer.length < 5) await this.waitForData();
    const type = String.fromCharCode(this.buffer[0]);
    const length = this.buffer.readInt32BE(1);
    while (this.buffer.length < 1 + length) await this.waitForData();
    const body = this.buffer.subarray(5, 1 + length);
    this.buffer = this.buffer.subarray(1 + length);
    return { type, body };
  }

  waitForData() {
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  flushWaiters() {
    const waiters = this.waiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }
}

async function main() {
  const connectionConfig = readLinkedConnection();
  const connection = new PgConnection(connectionConfig);
  try {
    await connection.connect();
    await connection.query('set role postgres;');
    const rows = await connection.query(VALIDATION_SQL);
    const report = JSON.parse(rows[0].jsonb_pretty);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      reportPath: path.relative(repoRoot, outputPath),
      sampleSize: report.sampleSize,
      totals: report.totals,
      bySourceType: report.bySourceType,
      candidateRecommendation: report.candidateRecommendation,
    }, null, 2));
  } finally {
    connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
