#!/usr/bin/env node
/**
 * Create the configured PostgreSQL database if missing.
 *
 * It loads env from monorepo root and frontend/, then connects to the default
 * "postgres" database and creates DB_NAME when it doesn't exist.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";

const cwd = path.resolve(process.cwd());
let monorepoRoot = cwd;
let frontendDir = cwd;

if (fs.existsSync(path.join(cwd, "frontend", "next.config.mjs"))) {
  monorepoRoot = cwd;
  frontendDir = path.join(cwd, "frontend");
} else if (fs.existsSync(path.join(cwd, "next.config.mjs"))) {
  frontendDir = cwd;
  monorepoRoot = path.resolve(cwd, "..");
}

function loadEnvFrom(base) {
  const envPath = path.join(base, ".env");
  const localPath = path.join(base, ".env.local");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(localPath)) dotenv.config({ path: localPath, override: true });
}

loadEnvFrom(monorepoRoot);
loadEnvFrom(frontendDir);

const DB_NAME = process.env.DB_NAME || "bagana_ai";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD;

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function main() {
  if (!DB_PASSWORD) {
    console.error("DB_PASSWORD kosong. Set di .env / .env.local dulu.");
    process.exit(1);
  }

  const client = new pg.Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: "postgres",
  });

  await client.connect();

  const exists = await client.query("select 1 from pg_database where datname=$1", [DB_NAME]);
  if (exists.rowCount > 0) {
    console.log(`Database already exists: ${DB_NAME}`);
    await client.end();
    return;
  }

  await client.query(`create database ${quoteIdent(DB_NAME)}`);
  console.log(`Database created: ${DB_NAME}`);

  await client.end();
}

main().catch((err) => {
  console.error("Failed to create database:", err?.message || String(err));
  process.exit(1);
});

