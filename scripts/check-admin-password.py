#!/usr/bin/env python3
"""Cek user admin dan password hash di database. Tidak menampilkan hash lengkap (keamanan)."""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("Install: pip install psycopg2-binary")
    sys.exit(1)

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
        "SELECT id, email, username, password_hash, LENGTH(password_hash) as len FROM users WHERE username = 'admin' OR email = 'admin@bagana.ai'"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print("Tidak ada user admin di database.")
        return

    for r in rows:
        uid, email, username, pwd_hash, length = r
        if pwd_hash.startswith("$2"):
            hash_type = "bcrypt"
        elif len(pwd_hash) == 64 and all(c in "0123456789abcdef" for c in pwd_hash.lower()):
            hash_type = "SHA-256"
        else:
            hash_type = "other"
        print("id:", uid)
        print("email:", email)
        print("username:", username)
        print("password_hash (preview):", (pwd_hash[:20] + "..." if len(pwd_hash) > 20 else pwd_hash))
        print("hash_length:", length)
        print("hash_type:", hash_type)
        if hash_type == "SHA-256":
            print("(Password default dari create-admin-user.py: 123456)")
        elif hash_type == "bcrypt":
            print("(Password dari init/script yang pakai bcrypt, mis. admin123 atau 123456)")


if __name__ == "__main__":
    main()
