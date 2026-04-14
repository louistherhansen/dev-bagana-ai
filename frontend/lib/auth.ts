/**
 * Authentication Utilities
 * Handles password hashing, token generation, and session management
 */

import crypto from 'crypto';
import { query } from './db';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Hash password using bcrypt
 * Uses bcrypt with salt rounds 12 for production-grade security
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Try to use bcrypt if available - use require for better compatibility
    const bcrypt = require('bcrypt');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    // Fallback to SHA-256 if bcrypt is not available
    // Note: In production, bcrypt should be installed, but we allow fallback
    // to prevent login failures if bcrypt module has issues
    console.warn(
      '⚠️ WARNING: bcrypt not available, using SHA-256 fallback.\n' +
      'Please install bcrypt: npm install bcrypt @types/bcrypt'
    );
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash;
  }
}

/**
 * Verify password using bcrypt or SHA-256 (for backward compatibility)
 * Detects hash format automatically:
 * - bcrypt: starts with $2a$, $2b$, or $2y$ (60 chars)
 * - SHA-256: 64 hex characters
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Detect hash format
  const isBcryptHash = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
  const isSha256Hash = /^[a-f0-9]{64}$/i.test(hash);

  try {
    if (isBcryptHash) {
      // Use bcrypt for bcrypt hashes - use require for better compatibility
      try {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(password, hash);
      } catch (bcryptError) {
        // If bcrypt import fails, log warning but don't throw in production
        // This allows the app to continue working even if bcrypt has issues
        console.error('⚠️ bcrypt import failed:', bcryptError instanceof Error ? bcryptError.message : String(bcryptError));
        // In production, we should have bcrypt, but if it fails, return false
        // rather than throwing to prevent complete login failure
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ bcrypt is required for production but failed to load. Please rebuild the Docker image.');
          return false;
        }
        // In development, fallback to SHA-256 for testing
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        return passwordHash === hash;
      }
    } else if (isSha256Hash) {
      // Fallback to SHA-256 for old passwords (backward compatibility)
      // This allows existing users to login while migrating to bcrypt
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      return passwordHash === hash;
    } else {
      // Unknown hash format - try bcrypt first, then SHA-256
      try {
        const bcrypt = require('bcrypt');
        const bcryptResult = await bcrypt.compare(password, hash);
        if (bcryptResult) return true;
      } catch (e) {
        // bcrypt failed, try SHA-256
      }
      // Try SHA-256 as fallback
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      return passwordHash === hash;
    }
  } catch (error) {
    // Catch any unexpected errors
    console.error('Password verification error:', error);
    // Try SHA-256 as last resort fallback
    try {
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      return passwordHash === hash;
    } catch (fallbackError) {
      console.error('Fallback verification also failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Generate secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate user ID
 */
export function generateUserId(): string {
  return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<{
    id: string;
    email: string;
    username: string;
    password_hash: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: Date;
    last_login: Date | null;
  }>(
    'SELECT id, email, username, password_hash, full_name, role, is_active, created_at, last_login FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name || undefined,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLogin: row.last_login || undefined,
  };
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await query<{
    id: string;
    email: string;
    username: string;
    password_hash: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: Date;
    last_login: Date | null;
  }>(
    'SELECT id, email, username, password_hash, full_name, role, is_active, created_at, last_login FROM users WHERE username = $1 AND is_active = TRUE',
    [username]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name || undefined,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLogin: row.last_login || undefined,
  };
}

/**
 * Create new user
 */
export async function createUser(params: {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  role?: string;
}): Promise<User | null> {
  const id = generateUserId();
  const passwordHash = await hashPassword(params.password);
  const role = params.role || 'user';

  await query(
    `INSERT INTO users (id, email, username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, params.email, params.username, passwordHash, params.fullName || null, role]
  );

  return getUserByEmail(params.email);
}

/**
 * Create session
 */
export async function createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<Session | null> {
  const id = `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  await query(
    `INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, token, expiresAt, ipAddress || null, userAgent || null]
  );

  // Update last_login
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );

  return {
    id,
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  };
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string): Promise<Session | null> {
  const result = await query<{
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    created_at: Date;
  }>(
    'SELECT id, user_id, token, expires_at, created_at FROM sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
    [token]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Delete session
 */
export async function deleteSession(token: string): Promise<boolean> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
  return true;
}

/**
 * Get user by session token
 */
export async function getUserBySessionToken(token: string): Promise<User | null> {
  const session = await getSessionByToken(token);
  if (!session) return null;
  
  const result = await query<{
    id: string;
    email: string;
    username: string;
    password_hash: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: Date;
    last_login: Date | null;
  }>(
    'SELECT id, email, username, password_hash, full_name, role, is_active, created_at, last_login FROM users WHERE id = $1 AND is_active = TRUE',
    [session.userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name || undefined,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLogin: row.last_login || undefined,
  };
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);
  await query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [passwordHash, userId]
  );
  return true;
}

/**
 * Get user password hash by ID
 */
export async function getUserPasswordHash(userId: string): Promise<string | null> {
  const result = await query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0].password_hash : null;
}
