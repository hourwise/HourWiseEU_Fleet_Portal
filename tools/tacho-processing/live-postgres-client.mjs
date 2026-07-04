import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
const supabaseExe = path.join(repoRoot, 'supabase.exe');

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
    cstring('application_name'), cstring(config.applicationName ?? 'hourwise-live-validator'),
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

export function readLinkedConnection(applicationName = 'hourwise-live-validator') {
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
    applicationName,
  };
}

export class PgConnection {
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

  async setPostgresRole() {
    await this.query('set role postgres;');
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
          scram = { nonce, clientFirstBare, clientFirstMessage: `n,,${clientFirstBare}` };
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

export async function withLivePostgres(applicationName, callback) {
  const connection = new PgConnection(readLinkedConnection(applicationName));
  try {
    await connection.connect();
    await connection.setPostgresRole();
    return await callback(connection);
  } finally {
    connection.end();
  }
}
