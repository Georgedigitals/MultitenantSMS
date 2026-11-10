import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const rawConn =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'postgres://postgres:postgres@localhost:5439/template1?sslmode=disable');

// Clean connection string for local PGlite driver
const baseConn = rawConn
  .replace(/([?&])(max_idle_connection_lifetime|socket_timeout|pool_timeout|connect_timeout|connection_limit)=[^&]*/g, '')
  .replace(/\?&/, '?')
  .replace(/&&/, '&');

const connectionString = (
  baseConn.endsWith('?') || baseConn.endsWith('&')
    ? baseConn.slice(0, -1)
    : baseConn
).replace('@localhost:', '@127.0.0.1:');

const SCHEMA_BUILD_ID = '2026-10-03-adm-no-v3';

let spawnPromise: Promise<boolean> | null = null;

export async function ensureDatabaseServerRunning(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  if (spawnPromise) return spawnPromise;

  spawnPromise = (async () => {
    try {
      const dbPortMatch = connectionString.match(/:(\d+)\//);
      const port = dbPortMatch ? parseInt(dbPortMatch[1], 10) : 5439;
      const host = '127.0.0.1';

      const checkOpen = (): Promise<boolean> =>
        new Promise((resolve) => {
          const sock = new net.Socket();
          sock.setTimeout(300);
          sock
            .on('connect', () => { sock.destroy(); resolve(true); })
            .on('error', () => { sock.destroy(); resolve(false); })
            .on('timeout', () => { sock.destroy(); resolve(false); });
          sock.connect(port, host);
        });

      if (await checkOpen()) {
        return true;
      }

      console.log(`[prisma.ts] Database socket not open on ${host}:${port}. Auto-starting local PGlite...`);

      const root = process.cwd();
      const pidFile = path.resolve(root, 'prisma', 'pgdata', 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try { fs.unlinkSync(pidFile); } catch (_) {}
      }

      const serverJs = path.resolve(
        root,
        'node_modules',
        '@electric-sql',
        'pglite-socket',
        'dist',
        'scripts',
        'server.js'
      );

      if (fs.existsSync(serverJs)) {
        const child = spawn(
          process.execPath,
          [serverJs, '-d', './prisma/pgdata', '-p', String(port), '-h', host, '-m', '100'],
          {
            cwd: root,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
          }
        );
        child.unref();

        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 200));
          if (await checkOpen()) {
            console.log(`[prisma.ts] Local PGlite server is ready on ${host}:${port}`);
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('[prisma.ts] Auto-spawn error:', err);
    } finally {
      spawnPromise = null;
    }
    return false;
  })();

  return spawnPromise;
}

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
  pgPool?: Pool;
  resetPromise?: Promise<PrismaClient> | null;
  schemaBuildId?: string;
};

function getPgPool(): Pool {
  if (!rawConn) {
    throw new Error('DATABASE_URL must be configured in production.');
  }
  if (!globalForPrisma.pgPool || (globalForPrisma.pgPool as any).ended) {
    const databaseUrl = new URL(connectionString);
    const isLoopbackDatabase = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseUrl.hostname);
    const sslMode = databaseUrl.searchParams.get('sslmode')?.toLowerCase();
    const useTls = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' ||
      (process.env.NODE_ENV === 'production' && !isLoopbackDatabase && sslMode !== 'disable');
    const pool = new Pool({
      connectionString,
      ssl: useTls ? { rejectUnauthorized: true } : false,
      max: 6,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1000,
    });

    pool.on('error', (err) => {
      console.warn('[pgPool background error]', err?.message || err);
      // Invalidate global references so next query transparently gets a new pool
      globalForPrisma.pgPool = undefined;
      globalForPrisma.prismaClient = undefined;
    });

    globalForPrisma.pgPool = pool;
  }
  return globalForPrisma.pgPool;
}

function createFreshClient(): PrismaClient {
  const pool = getPgPool();
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export function getPrismaClient(): PrismaClient {
  if (
    !globalForPrisma.prismaClient ||
    !globalForPrisma.pgPool ||
    (globalForPrisma.pgPool as any)?.ended ||
    globalForPrisma.schemaBuildId !== SCHEMA_BUILD_ID
  ) {
    if (globalForPrisma.prismaClient && globalForPrisma.schemaBuildId !== SCHEMA_BUILD_ID) {
      try {
        globalForPrisma.prismaClient.$disconnect().catch(() => {});
      } catch (_) {}
      globalForPrisma.prismaClient = undefined;
    }
    globalForPrisma.prismaClient = createFreshClient();
    globalForPrisma.schemaBuildId = SCHEMA_BUILD_ID;
  }
  return globalForPrisma.prismaClient;
}

/**
 * Single-flight deduplicated reset function. Guarantees that multiple concurrent
 * queries encountering connection reset perform exactly ONE client recreation.
 */
export async function resetPrismaClient(): Promise<PrismaClient> {
  if (globalForPrisma.resetPromise) {
    return globalForPrisma.resetPromise;
  }

  globalForPrisma.resetPromise = (async () => {
    try {
      await ensureDatabaseServerRunning();

      const oldClient = globalForPrisma.prismaClient;
      const oldPool = globalForPrisma.pgPool;

      globalForPrisma.prismaClient = undefined;
      globalForPrisma.pgPool = undefined;

      if (oldClient) {
        oldClient.$disconnect().catch(() => {});
      }
      if (oldPool) {
        oldPool.end().catch(() => {});
      }

      // Settlement delay for PGlite WASM socket server to settle
      await new Promise((r) => setTimeout(r, 250));
      return getPrismaClient();
    } finally {
      globalForPrisma.resetPromise = null;
    }
  })();

  return globalForPrisma.resetPromise;
}

function safeStringify(obj: any): string {
  if (!obj) return '';
  try {
    return JSON.stringify(obj);
  } catch (_) {
    return String(obj || '');
  }
}

async function runWithRetry<T>(
  fn: (client: PrismaClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    const client = getPrismaClient();
    try {
      return await fn(client);
    } catch (err: any) {
      lastErr = err;

      const errMessage = (err?.message || '').toLowerCase();
      const errCode = String(err?.code || '').toLowerCase();
      const errName = (err?.name || '').toLowerCase();
      const errString = String(err || '').toLowerCase();
      const safeCause = safeStringify(err?.cause).toLowerCase();
      const safeMeta = safeStringify(err?.meta).toLowerCase();
      const safeStack = (err?.stack || '').toLowerCase();

      let isConnError =
        errCode === 'p1000' ||
        errCode === 'p1001' ||
        errCode === 'p1002' ||
        errCode === 'p1017' ||
        errMessage.includes('reach database') ||
        errMessage.includes('can\'t reach') ||
        errMessage.includes('timeout exceeded') ||
        errMessage.includes('connection timeout') ||
        errMessage.includes('closed the connection') ||
        errMessage.includes('connection closed') ||
        errMessage.includes('connection terminated') ||
        errMessage.includes('econnreset') ||
        errMessage.includes('econnrefused') ||
        safeCause.includes('connectionclosed') ||
        safeCause.includes('econnreset');

      if (errCode.startsWith('p2')) {
        isConnError = false;
      }

      if (isConnError) {
        if (process.env.NODE_ENV !== 'production') await ensureDatabaseServerRunning();
        await resetPrismaClient();
        if (i < maxRetries - 1) {
          const delay = Math.min(1000, 100 * (i + 1));
          await new Promise((res) => setTimeout(res, delay));
        }
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function handleStaleSchemaFallback(
  freshClient: any,
  modelName: string,
  methodName: string,
  args: any[],
  originalErr: any
): Promise<any> {
  if (modelName === 'student') {
    const rawArgs = args[0] || {};
    const where = rawArgs.where || {};

    if (methodName === 'findFirst' || methodName === 'findUnique') {
      let identifier: string | null = null;
      let tenantId: string | undefined = where.tenantId;

      if (Array.isArray(where.OR)) {
        for (const item of where.OR) {
          if (item?.admissionNumber) {
            identifier = String(item.admissionNumber);
          } else if (item?.id && !identifier) {
            identifier = String(item.id);
          }
        }
      } else if (where.admissionNumber) {
        identifier = String(where.admissionNumber);
      }

      if (identifier) {
        // Try finding by primary key ID first
        try {
          const byId = await freshClient.student.findFirst({
            where: tenantId ? { tenantId, id: identifier } : { id: identifier },
            ...(rawArgs.select ? { select: rawArgs.select } : {}),
            ...(rawArgs.include ? { include: rawArgs.include } : {}),
          });
          if (byId) return byId;
        } catch (_) {}

        // Query raw SQL for admission_number
        try {
          const rows = await freshClient.$queryRawUnsafe(
            tenantId
              ? `SELECT id, admission_number as "admissionNumber" FROM students WHERE tenant_id = $1 AND (admission_number = $2 OR guardian_contact_info->>'admissionNo' = $2) LIMIT 1`
              : `SELECT id, admission_number as "admissionNumber" FROM students WHERE admission_number = $1 OR guardian_contact_info->>'admissionNo' = $1 LIMIT 1`,
            ...(tenantId ? [tenantId, identifier] : [identifier])
          );
          if (rows && rows.length > 0) {
            const canonicalId = rows[0].id;
            const res = await freshClient.student.findFirst({
              where: tenantId ? { tenantId, id: canonicalId } : { id: canonicalId },
              ...(rawArgs.select ? { select: rawArgs.select } : {}),
              ...(rawArgs.include ? { include: rawArgs.include } : {}),
            });
            if (res) {
              if (!res.admissionNumber && rows[0].admissionNumber) {
                res.admissionNumber = rows[0].admissionNumber;
              }
              return res;
            }
          }
        } catch (_) {}
      }

      // If still not resolved, try stripping admissionNumber from where
      try {
        const cleanWhere = { ...where };
        delete cleanWhere.admissionNumber;
        if (Array.isArray(cleanWhere.OR)) {
          cleanWhere.OR = cleanWhere.OR.filter((item: any) => !item?.admissionNumber);
        }
        return await freshClient.student.findFirst({
          where: cleanWhere,
          ...(rawArgs.select ? { select: rawArgs.select } : {}),
          ...(rawArgs.include ? { include: rawArgs.include } : {}),
        });
      } catch (_) {}
    }

    if (methodName === 'findMany') {
      try {
        const cleanWhere = { ...where };
        delete cleanWhere.admissionNumber;
        if (Array.isArray(cleanWhere.OR)) {
          cleanWhere.OR = cleanWhere.OR.filter((item: any) => !item?.admissionNumber);
        }
        return await freshClient.student.findMany({
          ...rawArgs,
          where: cleanWhere,
        });
      } catch (_) {}
    }

    if (methodName === 'count') {
      try {
        const cleanWhere = { ...where };
        delete cleanWhere.admissionNumber;
        return await freshClient.student.count({
          ...rawArgs,
          where: cleanWhere,
        });
      } catch (_) {}
    }

    if (methodName === 'update') {
      try {
        const cleanData = { ...(rawArgs.data || {}) };
        const adm = cleanData.admissionNumber;
        delete cleanData.admissionNumber;
        if (adm !== undefined && rawArgs.where?.id) {
          await freshClient.$executeRawUnsafe(
            `UPDATE students SET admission_number = $1 WHERE id = $2`,
            adm,
            rawArgs.where.id
          );
        }
        const updated = await freshClient.student.update({
          ...rawArgs,
          data: cleanData,
        });
        if (adm !== undefined && updated) {
          updated.admissionNumber = adm;
        }
        return updated;
      } catch (_) {}
    }
  }

  if (modelName === 'tenant') {
    const rawArgs = args[0] || {};
    if (rawArgs.select?.admissionNumberPrefix !== undefined) {
      try {
        const cleanSelect = { ...rawArgs.select };
        delete cleanSelect.admissionNumberPrefix;
        const tenant = await freshClient.tenant[methodName]({
          ...rawArgs,
          select: cleanSelect,
        });
        if (tenant && rawArgs.where?.id) {
          const rows = await freshClient.$queryRawUnsafe(
            `SELECT admission_number_prefix as "admissionNumberPrefix" FROM tenants WHERE id = $1 LIMIT 1`,
            rawArgs.where.id
          );
          tenant.admissionNumberPrefix = rows[0]?.admissionNumberPrefix || null;
        }
        return tenant;
      } catch (_) {}
    }
  }

  throw originalErr;
}

/**
 * Proxy object wrapping PrismaClient. Dynamically resolves fresh client instances
 * on every query execution to guarantee transparent retries on connection reset.
 */
export const prisma: PrismaClient = new Proxy({} as unknown as PrismaClient, {
  get(_target, prop: string | symbol) {
    if (prop === '$extends') {
      return (...extensionArgs: any[]) => {
        return new Proxy({} as any, {
          get(_extTarget, modelOrMethodProp: string | symbol) {
            const rawClient = getPrismaClient() as any;
            const extendedClient = rawClient.$extends(...extensionArgs);
            const targetProp = extendedClient[modelOrMethodProp];

            if (typeof targetProp === 'function') {
              return (...callArgs: any[]) =>
                runWithRetry(async (freshClient) => {
                  const freshExt = (freshClient as any).$extends(...extensionArgs);
                  try {
                    return await freshExt[modelOrMethodProp](...callArgs);
                  } catch (err: any) {
                    const msg = String(err?.message || '');
                    if (
                      msg.includes('admissionNumber') ||
                      msg.includes('admissionNumberPrefix')
                    ) {
                      return await handleStaleSchemaFallback(freshClient, String(modelOrMethodProp), 'query', callArgs, err);
                    }
                    throw err;
                  }
                });
            }

            return new Proxy({} as any, {
              get(_modelTarget, methodProp: string | symbol) {
                return (...callArgs: any[]) =>
                  runWithRetry(async (freshClient) => {
                    const freshExt = (freshClient as any).$extends(...extensionArgs);
                    const model = freshExt[modelOrMethodProp];
                    try {
                      if (model && typeof model[methodProp] === 'function') {
                        return await model[methodProp](...callArgs);
                      }
                      if (typeof freshExt[modelOrMethodProp] === 'function') {
                        return await freshExt[modelOrMethodProp](...callArgs);
                      }
                    } catch (err: any) {
                      const msg = String(err?.message || '');
                      if (
                        msg.includes('admissionNumber') ||
                        msg.includes('admissionNumberPrefix')
                      ) {
                        return await handleStaleSchemaFallback(freshClient, String(modelOrMethodProp), String(methodProp), callArgs, err);
                      }
                      throw err;
                    }
                  });
              },
            });
          },
        });
      };
    }

    const currentClient = getPrismaClient() as any;
    if (typeof currentClient[prop] === 'function') {
      if (prop === '$transaction') {
        return (input: any, ...options: any[]) => {
          if (Array.isArray(input)) {
            return runWithRetry(async (freshClient) => {
              try {
                return await (freshClient as any).$transaction(input, ...options);
              } catch (err: any) {
                const msg = String(err?.message || '');
                if (msg.includes('Prisma Client promises')) {
                  // Fallback for wrapped promises in proxy
                  return await Promise.all(input);
                }
                throw err;
              }
            });
          }
          return runWithRetry(async (freshClient) => (freshClient as any).$transaction(input, ...options));
        };
      }
      return (...args: any[]) =>
        runWithRetry(async (freshClient) => (freshClient as any)[prop](...args));
    }

    return new Proxy({} as any, {
      get(_modelTarget, modelProp: string | symbol) {
        return (...args: any[]) =>
          runWithRetry(async (freshClient) => {
            const model = (freshClient as any)[prop];
            try {
              if (model && typeof model[modelProp] === 'function') {
                return await model[modelProp](...args);
              }
              if (typeof (freshClient as any)[prop] === 'function') {
                return await (freshClient as any)[prop](...args);
              }
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (
                msg.includes('admissionNumber') ||
                msg.includes('admissionNumberPrefix')
              ) {
                return await handleStaleSchemaFallback(freshClient, String(prop), String(modelProp), args, err);
              }
              throw err;
            }
          });
      },
    });
  },
});

export default prisma;
