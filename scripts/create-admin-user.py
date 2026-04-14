#!/usr/bin/env python3
"""
Create Admin User in PostgreSQL Database
Creates a default admin user with username: admin, password: 123456
"""

import psycopg2
import sys
import os
from datetime import datetime
import bcrypt
import hashlib

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "bagana_ai"),
    "user": os.getenv("DB_USER", "bagana_user"),
    "password": os.getenv("DB_PASSWORD", "123456"),
}

def hash_password_simple(password: str) -> str:
    """Simple SHA-256 hash (matching Node.js implementation in lib/auth.ts)"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_admin_user():
    """Create admin user in database."""
    print("=" * 60)
    print("BAGANA AI - Create Admin User")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("Connection Parameters:")
    print(f"  Host: {DB_CONFIG['host']}")
    print(f"  Port: {DB_CONFIG['port']}")
    print(f"  Database: {DB_CONFIG['database']}")
    print(f"  User: {DB_CONFIG['user']}")
    print()

    conn = None
    try:
        print("Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        print("[OK] Connected successfully!")
        print()

        cur = conn.cursor()

        # Check if admin user already exists
        print("Checking if admin user exists...")
        cur.execute("SELECT id, username, email FROM users WHERE username = 'admin' OR email = 'admin@bagana.ai'")
        existing = cur.fetchone()
        
        if existing:
            print(f"[SKIP] Admin user already exists:")
            print(f"  ID: {existing[0]}")
            print(f"  Username: {existing[1]}")
            print(f"  Email: {existing[2]}")
            print()
            print("To update password, delete the user first and run this script again.")
            cur.close()
            return True

        # Create admin user
        print("Creating admin user...")
        admin_id = f"user_{int(datetime.now().timestamp() * 1000)}_{hashlib.md5(b'admin').hexdigest()[:8]}"
        admin_email = "admin@bagana.ai"
        admin_username = "admin"
        admin_password = "123456"
        password_hash = hash_password_simple(admin_password)
        
        cur.execute("""
            INSERT INTO users (id, email, username, password_hash, full_name, role, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            admin_id,
            admin_email,
            admin_username,
            password_hash,
            "Administrator",
            "admin",
            True
        ))
        
        conn.commit()
        print("[OK] Admin user created successfully!")
        print()
        print("Admin Credentials:")
        print(f"  Username: {admin_username}")
        print(f"  Password: {admin_password}")
        print(f"  Email: {admin_email}")
        print(f"  Role: admin")
        print()
        print("=" * 60)
        print("[OK] Admin user setup completed!")
        print("=" * 60)
        
        cur.close()
        return True

    except psycopg2.OperationalError as e:
        print("[FAIL] Connection failed!")
        print(f"Error: {e}")
        return False
    except psycopg2.Error as e:
        print(f"[FAIL] Database error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
            print("\nConnection closed.")

if __name__ == "__main__":
    success = create_admin_user()
    sys.exit(0 if success else 1)
