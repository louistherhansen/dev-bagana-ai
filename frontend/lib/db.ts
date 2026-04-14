/**
 * Database Utility Functions for PostgreSQL
 * 
 * Provides connection pooling and query helpers for chat history operations.
 * Uses environment variables for database configuration.
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { loadProjectEnv } from './load-env';
import fs from "fs";

loadProjectEnv();

// Database connection pool
let pool: Pool | null = null;

export class DbUnavailableError extends Error {
  override name = "DbUnavailableError";
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

function runningInDocker(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
  } catch {
    // ignore
  }
  try {
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
    return /docker|containerd|kubepods/i.test(cgroup);
  } catch {
    return false;
  }
}

function isLikelyConnectivityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const code = (err as any)?.code ? String((err as any).code) : "";
  return (
    /Connection terminated/i.test(msg) ||
    /connection timeout/i.test(msg) ||
    /timeout/i.test(msg) ||
    /ECONNREFUSED/i.test(code) ||
    /ETIMEDOUT/i.test(code) ||
    /ENOTFOUND/i.test(code) ||
    /EHOSTUNREACH/i.test(code) ||
    /ENETUNREACH/i.test(code)
  );
}

function connectivityHint(): string {
  const host = (process.env.DB_HOST || "127.0.0.1").trim();
  const port = (process.env.DB_PORT || "5432").trim();

  // Common misconfig: service name from docker-compose used when running Next.js on host.
  if (!runningInDocker() && host === "postgres") {
    return `Hint: you're likely running Next.js on your host, but DB_HOST is set to "${host}". Set DB_HOST=127.0.0.1 (or "localhost") and ensure Docker Postgres exposes port ${port}.`;
  }
  return `Check DB reachability (DB_HOST=${host}, DB_PORT=${port}) and that Postgres is running.`;
}

/**
 * Validate required environment variables
 */
function validateEnvVars(): void {
  const required = ['DB_PASSWORD'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key] || process.env[key]!.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these variables in your .env file.\n` +
      `See .env.example for reference.`
    );
  }
}

/**
 * Get or create database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    // Validate required environment variables
    validateEnvVars();

    const connectionTimeoutMillis = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "10000", 10);

    const config: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      max: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
      ssl?: boolean | { rejectUnauthorized: boolean };
    } = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bagana_ai',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD!, // Required - validated above
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis) ? connectionTimeoutMillis : 10000,
    };

    // Enable SSL for production (if DB_SSL is set to true)
    if (process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true') {
      config.ssl = {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      };
    }

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

/**
 * Execute a query and return results
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    if (isLikelyConnectivityError(err)) {
      throw new DbUnavailableError(
        `Database connection failed. ${connectivityHint()}`,
        err
      );
    }
    throw err;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
