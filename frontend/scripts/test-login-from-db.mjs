#!/usr/bin/env node
/**
 * Tes login "manual" langsung dari DB: baca user admin + verifikasi password
 * (bcrypt / SHA-256 sama seperti lib/auth.ts).
 *
 * Usage:
 *   node scripts/test-login-from-db.mjs
 *   node scripts/test-login-from-db.mjs "PasswordBaru123"
 *   node scripts/test-login-from-db.mjs "123456" admin@bagana.ai
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
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
// Repo root first, then frontend/ (local overrides)
loadEnvFrom(monorepoRoot);
loadEnvFrom(frontendDir);

const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "bagana_ai",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
};

async function verifyPasswordLikeAuth(password, hash) {
  const isBcryptHash =
    hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
  const isSha256Hash = /^[a-f0-9]{64}$/i.test(hash);
  if (isBcryptHash) {
    return bcrypt.compare(password, hash);
  }
  if (isSha256Hash) {
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    return passwordHash === hash;
  }
  const bcryptResult = await bcrypt.compare(password, hash).catch(() => false);
  if (bcryptResult) return true;
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  return passwordHash === hash;
}

async function main() {
  const passwordArg = process.argv[2];
  const emailArg = process.argv[3] || "admin@bagana.ai";

  console.log("=== BAGANA AI — test login from DB ===\n");
  console.log("DB connection:");
  console.log(`  DB_HOST=${DB.host}`);
  console.log(`  DB_NAME=${DB.database}`);
  console.log(`  DB_USER=${DB.user}`);
  console.log(`  DB_PASSWORD=${DB.password ? "(set)" : "(EMPTY — set in .env)"}\n`);

  if (!DB.password) {
    console.error("Error: DB_PASSWORD is required in .env or .env.local");
    process.exit(1);
  }

  const client = new pg.Client(DB);
  await client.connect();
  console.log("Connected to PostgreSQL.\n");

  const list = await client.query(
    `SELECT id, email, username, role, is_active,
            LENGTH(password_hash) AS hash_len,
            LEFT(password_hash, 7) AS hash_prefix
     FROM users ORDER BY email`
  );
  console.log(`Users in DB: ${list.rows.length}`);
  list.rows.forEach((r) => {
    console.log(
      `  - ${r.email} | ${r.username} | role=${r.role} | active=${r.is_active} | hash_len=${r.hash_len} | prefix=${r.hash_prefix}...`
    );
  });
  console.log("");

  const userRes = await client.query(
    `SELECT id, email, username, password_hash FROM users
     WHERE email = $1 OR username = $1`,
    [emailArg]
  );

  if (userRes.rows.length === 0) {
    console.error(`No user found with email/username: "${emailArg}"`);
    await client.end();
    process.exit(1);
  }

  const row = userRes.rows[0];
  const hash = row.password_hash;
  const hashType =
    hash.startsWith("$2") ? "bcrypt" : /^[a-f0-9]{64}$/i.test(hash) ? "SHA-256" : "unknown";

  console.log(`Selected user: ${row.email} (${row.username})`);
  console.log(`Hash type in DB: ${hashType}\n`);

  const candidates = passwordArg
    ? [passwordArg]
    : ["123456", "PasswordBaru123", "admin123", "admin"];

  if (passwordArg) {
    const ok = await verifyPasswordLikeAuth(passwordArg, hash);
    console.log(`Password tested: "${passwordArg}"`);
    console.log(`Verification result (same as login API): ${ok ? "OK — match" : "FAIL"}`);
    await client.end();
    process.exit(ok ? 0 : 1);
  }

  console.log("Trying candidate passwords (no arg provided):\n");
  for (const pwd of candidates) {
    const ok = await verifyPasswordLikeAuth(pwd, hash);
    console.log(`  "${pwd}" → ${ok ? "MATCH" : "no match"}`);
  }
  console.log("");
  console.log('To test a single password: node scripts/test-login-from-db.mjs "yourPassword"');

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  if (String(e.message).includes("ENOTFOUND") && DB.host === "postgres") {
    console.error(
      "\nHint: DB_HOST=postgres only works inside the Docker network.\n" +
        "For Postgres on your machine, set DB_HOST=127.0.0.1 (PowerShell):\n" +
        '  $env:DB_HOST="127.0.0.1"; node scripts/test-login-from-db.mjs'
    );
  }
  if (String(e.message).includes("does not exist")) {
    console.error(
      "\nHint: ensure the database name in .env (DB_NAME) exists in PostgreSQL,\n" +
        "or create it / adjust DB_NAME."
    );
  }
  process.exit(1);
});
