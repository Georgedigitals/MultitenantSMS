#!/usr/bin/env node
/**
 * db-supervisor.mjs
 *
 * Ensures the PGlite socket server is alive on the DATABASE_URL port before
 * handing control to `next dev`. If the server crashes under high Next.js
 * concurrency it is automatically respawned so the app never sees an
 * unreachable database.
 *
 * Usage (automatically via `npm run dev`):
 *   node scripts/db-supervisor.mjs
 */

import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load environment variables from .env
dotenv.config({ path: path.join(ROOT, '.env') });

const dbUrl = process.env.DATABASE_URL || '';
const portMatch = dbUrl.match(/:(\d+)\//);

// ── Configuration ─────────────────────────────────────────────────────────────
const DB_HOST = '127.0.0.1';
const DB_PORT = portMatch ? parseInt(portMatch[1], 10) : 5439;
const DB_DATA = path.join(ROOT, 'prisma', 'pgdata');
const MAX_CONNECTIONS = 100;

const PGLITE_SERVER_BIN = path.join(
  ROOT,
  'node_modules',
  '@electric-sql',
  'pglite-socket',
  'dist',
  'scripts',
  'server.js'
);

// How long to wait (ms) between crash-restarts
const RESTART_DELAY_MS = 500;
// How many times to probe port before giving up on a newly-launched server
const PROBE_MAX_ATTEMPTS = 40;
const PROBE_INTERVAL_MS = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────
function probePort(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(400);
    sock
      .on('connect', () => { sock.destroy(); resolve(true); })
      .on('error', () => { sock.destroy(); resolve(false); })
      .on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function waitForPort(host, port, attempts, intervalMs) {
  for (let i = 0; i < attempts; i++) {
    if (await probePort(host, port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function log(msg) {
  process.stdout.write(`[db-supervisor] ${msg}\n`);
}

// ── State ─────────────────────────────────────────────────────────────────────
let dbProc = null;
let nextProc = null;
let shuttingDown = false;
let nextStarted = false;

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down...');
  for (const proc of [nextProc, dbProc]) {
    try { proc?.kill('SIGTERM'); } catch (_) {}
  }
  setTimeout(() => {
    for (const proc of [nextProc, dbProc]) {
      try { proc?.kill('SIGKILL'); } catch (_) {}
    }
    process.exit(code);
  }, 3000);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ── Launch Next.js ────────────────────────────────────────────────────────────
function startNext() {
  if (nextStarted || shuttingDown) return;
  nextStarted = true;
  log('Database ready -- starting Next.js...');

  const isWin = process.platform === 'win32';
  nextProc = spawn('npm', ['run', 'next:dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });

  nextProc.on('error', (err) => {
    log(`Next.js failed to start: ${err.message}`);
    shutdown(1);
  });

  nextProc.on('close', (code) => {
    log(`Next.js exited (code ${code})`);
    shutdown(code ?? 0);
  });
}

function migrateBeforeStartingNext() {
  if (shuttingDown) return;
  log('Applying pending Prisma migrations before starting Next.js...');

  const migrationProc = spawn('npm', ['run', 'db:migrate:deploy'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });

  migrationProc.on('error', (err) => {
    log(`Prisma migrations could not start: ${err.message}`);
    shutdown(1);
  });

  migrationProc.on('close', (code) => {
    if (shuttingDown) return;
    if (code !== 0) {
      log(`Prisma migrations failed (code ${code}); Next.js was not started.`);
      shutdown(code ?? 1);
      return;
    }
    seedIfNeededBeforeStartingNext();
  });
}

function seedIfNeededBeforeStartingNext() {
  if (shuttingDown) return;
  log('Ensuring foundational demo seed is present...');

  const seedProc = spawn('npm', ['run', 'db:seed:demo'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });

  seedProc.on('error', (err) => {
    log(`Warning: Seed process error: ${err.message}. Proceeding to Next.js.`);
    startNext();
  });

  seedProc.on('close', (code) => {
    if (shuttingDown) return;
    if (code !== 0) {
      log(`Seed returned code ${code}, proceeding to start Next.js...`);
    } else {
      log('Database seed verified successfully.');
    }
    startNext();
  });
}

// ── Launch / supervise pglite-server ──────────────────────────────────────────
function startDb() {
  if (shuttingDown) return;

  if (!fs.existsSync(PGLITE_SERVER_BIN)) {
    log(`ERROR: pglite-server not found at: ${PGLITE_SERVER_BIN}`);
    log('Run: npm install');
    process.exit(1);
  }

  log(`Starting PGlite server (port ${DB_PORT}, data: ./prisma/pgdata)...`);

  // Remove stale postmaster.pid from ungraceful shutdown/crash if present
  const pidFile = path.join(DB_DATA, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      log('Cleaned up stale postmaster.pid file.');
    } catch (_) {}
  }

  dbProc = spawn(
    process.execPath,
    [
      PGLITE_SERVER_BIN,
      '-d', './prisma/pgdata',
      '-p', String(DB_PORT),
      '-h', DB_HOST,
      '-m', String(MAX_CONNECTIONS),
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );

  dbProc.stdout?.on('data', (d) => process.stdout.write(`[pglite] ${d}`));
  dbProc.stderr?.on('data', (d) => process.stderr.write(`[pglite] ${d}`));

  dbProc.on('error', (err) => {
    log(`pglite-server error: ${err.message}`);
  });

  dbProc.on('close', (code, signal) => {
    if (shuttingDown) return;
    log(`pglite-server stopped (code=${code} signal=${signal}) -- restarting in ${RESTART_DELAY_MS}ms...`);
    dbProc = null;
    setTimeout(startDb, RESTART_DELAY_MS);
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  log('Checking if database is already running...');

  const alreadyUp = await probePort(DB_HOST, DB_PORT);
  if (alreadyUp) {
    log(`Port ${DB_PORT} already open -- skipping server launch.`);
    migrateBeforeStartingNext();
    return;
  }

  startDb();

  log(`Waiting for database to accept connections on ${DB_HOST}:${DB_PORT}...`);
  const ready = await waitForPort(DB_HOST, DB_PORT, PROBE_MAX_ATTEMPTS, PROBE_INTERVAL_MS);

  if (!ready) {
    log(`ERROR: Database did not start within ${(PROBE_MAX_ATTEMPTS * PROBE_INTERVAL_MS) / 1000}s. Aborting.`);
    shutdown(1);
    return;
  }

  migrateBeforeStartingNext();
}

main();
