#!/usr/bin/env node
/**
 * Ensure admin user exists with password 123456.
 * Uses same .env as the app (DB_*). No Python required.
 * Run: node scripts/ensure-admin.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bagana_ai',
  user: process.env.DB_USER || 'bagana_user',
  password: process.env.DB_PASSWORD,
};

const ADMIN_EMAIL = 'admin@bagana.ai';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123456';
const SALT_ROUNDS = 12;

async function main() {
  if (!DB.password) {
    console.error('Error: DB_PASSWORD tidak di-set di .env');
    process.exit(1);
  }

  const client = new pg.Client(DB);
  try {
    await client.connect();
    console.log('Terhubung ke database:', DB.database);

    // Ensure users table exists (minimal)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);

    const existing = await client.query(
      `SELECT id, username, email FROM users WHERE username = $1 OR email = $2`,
      [ADMIN_USERNAME, ADMIN_EMAIL]
    );

    const hash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hash, row.id]
      );
      console.log('Password admin direset.');
      console.log('  Username:', ADMIN_USERNAME);
      console.log('  Email:', ADMIN_EMAIL);
      console.log('  Password:', ADMIN_PASSWORD);
    } else {
      const id = `user_${Date.now()}_${Buffer.from(ADMIN_USERNAME).toString('hex').slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, email, username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ADMIN_EMAIL, ADMIN_USERNAME, hash, 'Administrator', 'admin', true]
      );
      console.log('User admin dibuat.');
      console.log('  Username:', ADMIN_USERNAME);
      console.log('  Email:', ADMIN_EMAIL);
      console.log('  Password:', ADMIN_PASSWORD);
    }

    console.log('\nSilakan login di browser dengan kredensial di atas.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
