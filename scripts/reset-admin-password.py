#!/usr/bin/env python3
"""
Reset password user admin ke 123456 (bcrypt, salt rounds 12).
Jalankan dengan env DB_* sama seperti aplikasi.
"""
import os
import sys

try:
    import psycopg2
    import bcrypt
except ImportError as e:
    print("Required: pip install psycopg2-binary bcrypt")
    sys.exit(1)

NEW_PASSWORD = "123456"
SALT_ROUNDS = 12

def main():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "bagana_ai"),
        user=os.getenv("DB_USER", "bagana_user"),
        password=os.getenv("DB_PASSWORD"),
    )
    cur = conn.cursor()
    cur.execute(
        "SELECT id, email, username FROM users WHERE username = 'admin' OR email = 'admin@bagana.ai'"
    )
    row = cur.fetchone()
    if not row:
        print("User admin tidak ditemukan di database.")
        cur.close()
        conn.close()
        sys.exit(1)

    uid, email, username = row
    password_hash = bcrypt.hashpw(NEW_PASSWORD.encode(), bcrypt.gensalt(SALT_ROUNDS)).decode()
    cur.execute("UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (password_hash, uid))
    conn.commit()
    cur.close()
    conn.close()
    print("Password admin berhasil direset.")
    print("  Username:", username)
    print("  Email:", email)
    print("  Password baru: " + NEW_PASSWORD)
    print("Silakan login di browser dengan password di atas.")


if __name__ == "__main__":
    main()
