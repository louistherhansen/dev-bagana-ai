import os
import uuid
import json
import psycopg2
import logging
import asyncio
import hashlib
import hmac
from pathlib import Path
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from urllib.parse import quote_plus

from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt
from psycopg2.extras import RealDictCursor

# === 1. LOGGING (awal, untuk pesan dotenv / DB) ===
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend.main")


def _load_dotenv_from_repo() -> None:
    """Muat .env dari root repo & backend/ (sama pola dengan Next.js) agar DB_* terbaca saat uvicorn lokal."""
    try:
        from dotenv import load_dotenv

        here = Path(__file__).resolve()
        repo_root = here.parent.parent
        backend_dir = here.parent
        for root in (repo_root, backend_dir):
            env_path = root / ".env"
            local_path = root / ".env.local"
            if env_path.exists():
                load_dotenv(env_path, override=False)
            if local_path.exists():
                load_dotenv(local_path, override=True)
    except Exception as e:
        logger.warning("dotenv tidak dimuat: %s", e)


_load_dotenv_from_repo()

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Diperlama agar tidak cepat logout


def _resolve_database_url() -> str:
    """
    Selama DB_PASSWORD di-set, URL selalu dibuat dari DB_* dengan quote_plus (aman untuk @
    dalam password). DATABASE_URL dari .env / docker-compose yang di-interpolasi mentah
    **diabaikan** — itulah penyebab host salah seperti "Cl0ud@postgres".

    DATABASE_URL dipakai hanya jika DB_PASSWORD kosong (mis. secret manager hanya menyimpan URL).
    """
    user = os.getenv("DB_USER", "postgres")
    host = (os.getenv("DB_HOST") or "").strip()
    port = (os.getenv("DB_PORT") or "5432").strip()
    dbname = os.getenv("DB_NAME", "bagana_ai")
    password = (os.getenv("DB_PASSWORD") or "").strip()

    if password:
        h = host or "127.0.0.1"
        if not host:
            logger.warning(
                "DB_HOST kosong — memakai %s. Di Docker set DB_HOST=postgres di compose/.env.",
                h,
            )
        logger.info("Backend DB target: %s:%s/%s (DB_* + URL-encoded password)", h, port, dbname)
        return f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{h}:{port}/{dbname}"

    explicit = (os.getenv("DATABASE_URL") or "").strip()
    if explicit:
        logger.info("Backend DB: using DATABASE_URL (DB_PASSWORD tidak di-set)")
        return explicit

    logger.error(
        "DB_PASSWORD dan DATABASE_URL kosong. "
        "Set DB_* di .env atau DATABASE_URL agar koneksi Postgres berfungsi."
    )
    return ""


DATABASE_URL = _resolve_database_url()
if not DATABASE_URL:
    logger.warning("DATABASE_URL tidak terbentuk — auth DB akan gagal")

app = FastAPI(title="BAGANA AI Backend")

# In-memory storage untuk status eksekusi
results_storage: Dict[str, dict] = {}

# === 3. CORS (Penting agar Frontend bisa akses) ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === 4. IMPORT LOGIKA CREWAI ===
try:
    from crew.run import kickoff
    logger.info("✅ Berhasil mengimpor fungsi kickoff dari crew.run")
except ImportError as e:
    kickoff = None
    logger.error(f"❌ Gagal impor crew.run: {e}")

# === 5. MODELS ===

# Tambahkan model data di main.py
class SentimentRecord(BaseModel):
    brand_name: str
    positive_pct: float
    negative_pct: float
    neutral_pct: float
    full_output: str
    conversation_id: Optional[str] = None

class ContentPlanRecord(BaseModel):
    id: str
    title: str
    campaign: Optional[str] = None
    brand_name: Optional[str] = None
    conversation_id: Optional[str] = None
    schema_valid: bool = True
    talents: List[str] = []
    version: str = "v1.0"
    content: Dict
    metadata: Optional[Dict] = None

class TrendRecord(BaseModel):
    brand_name: str
    full_output: str
    conversation_id: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None

class CreateUserRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "user"

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class ToggleActiveRequest(BaseModel):
    is_active: bool

class CrewRequest(BaseModel):
    user_input: str

# === 6. AUTH HELPERS ===

def _expected_crew_internal_header() -> str:
    """Sama dengan Next.js: HMAC-SHA256(SECRET_KEY, 'bagana-crew-internal-v1')."""
    sk = (SECRET_KEY or "").strip()
    if not sk:
        return ""
    return hmac.new(sk.encode("utf-8"), b"bagana-crew-internal-v1", hashlib.sha256).hexdigest()


def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    except Exception as e:
        logger.error(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def verify_password(plain_password, stored_hash):
    # Menggunakan SHA256 sesuai standar awal kamu
    return hashlib.sha256(plain_password.encode("utf-8")).hexdigest() == stored_hash

def _user_from_session_token(token: str) -> Optional[dict]:
    """Validasi token sesi Next.js (tabel `sessions`) — sama dengan frontend/lib/auth.ts."""
    if not token or not DATABASE_URL:
        return None
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.email, u.username, u.role
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = %s
                  AND s.expires_at > CURRENT_TIMESTAMP
                  AND u.is_active = TRUE
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "sub": row["id"],
                "email": row["email"],
                "username": row["username"],
                "role": row["role"],
            }
    except Exception as e:
        logger.warning("Session token lookup failed: %s", e)
        return None
    finally:
        if conn:
            conn.close()


def get_current_user(request: Request) -> dict:
    # 0) Proxy Next.js → FastAPI (sudah diverifikasi sesi di route /api/crew)
    exp = _expected_crew_internal_header()
    if exp:
        incoming = (request.headers.get("X-Bagana-Crew-Internal") or "").strip()
        if incoming and hmac.compare_digest(incoming, exp):
            return {"sub": "nextjs-crew-proxy", "role": "user", "email": "proxy@internal"}

    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # 1) JWT (login lama / FastAPI / service account)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub"):
            return payload
    except JWTError:
        pass
    except Exception:
        pass
    # 2) Token sesi Next.js (tabel sessions — DB harus sama)
    session_user = _user_from_session_token(token)
    if session_user:
        return session_user
    logger.warning(
        "Auth gagal: JWT tidak valid & session tidak ada di DB backend. "
        "Pastikan SECRET_KEY sama di Next & backend, atau set DATABASE_URL backend."
    )
    raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login ulang")

# === 7. BACKGROUND LOGIC (SINKRON DENGAN FRONTEND) ===
def _main_text_from_crew_result(raw_result: dict) -> str:
    """
    crew.run.kickoff mengembalikan:
    - sukses: { status, output, task_outputs?, token_usage? }
    - gagal: { status: 'error', error } — tanpa key 'output' (jangan tampilkan pesan generik membingungkan).
    """
    if not isinstance(raw_result, dict):
        return str(raw_result) if raw_result else "Tidak ada hasil dari crew."

    if raw_result.get("status") == "error":
        return (raw_result.get("error") or "Eksekusi crew gagal.").strip()

    main = raw_result.get("output")
    if isinstance(main, str) and main.strip():
        return main.strip()

    # output kosong / None — rangkai dari task_outputs (beberapa versi CrewAI)
    chunks: List[str] = []
    for t in raw_result.get("task_outputs") or []:
        if isinstance(t, dict):
            piece = (t.get("output") or "").strip()
            if piece:
                chunks.append(piece)
    if chunks:
        return "\n\n---\n\n".join(chunks)

    if isinstance(main, str):
        return main

    return (raw_result.get("error") or "").strip() or "Tidak ada teks hasil (output dan task_outputs kosong)."


async def run_crewai_logic(execution_id: str, user_input: str):
    try:
        logger.info(f"🚀 [ID: {execution_id}] Memulai proses CrewAI...")
        loop = asyncio.get_event_loop()
        
        if kickoff:
            # Sesuai crew/run.py baris 330, input harus berupa dict
            crew_inputs = {"user_input": user_input}
            
            # Jalankan kickoff di worker thread
            raw_result = await loop.run_in_executor(None, lambda: kickoff(crew_inputs))
            if not isinstance(raw_result, dict):
                raw_result = {"status": "error", "error": str(raw_result)}

            main_text = _main_text_from_crew_result(raw_result)
            crew_status = raw_result.get("status")
            final_status = "failed" if crew_status == "error" else "complete"

            # Simpan hasil dengan struktur yang konsisten untuk Frontend
            # Frontend mengharapkan: { status, output (string), task_outputs (array) }
            payload = {
                "status": final_status,
                "output": main_text,
                "task_outputs": raw_result.get("task_outputs", []),
                "token_usage": raw_result.get("token_usage") or {},
                "finished_at": datetime.now().isoformat(),
            }
            if crew_status == "error":
                payload["error"] = raw_result.get("error")
            results_storage[execution_id] = payload
            if crew_status == "error":
                logger.warning("Crew selesai dengan error [%s]: %s", execution_id, main_text[:500])
            else:
                logger.info(f"✅ [ID: {execution_id}] Eksekusi sukses.")
        else:
            results_storage[execution_id] = {
                "status": "failed",
                "error": "Sistem CrewAI belum terpasang dengan benar.",
            }

    except Exception as e:
        import traceback
        logger.error(f"❌ Error Detail: {traceback.format_exc()}") 
        results_storage[execution_id] = {
            "status": "failed", 
            "error": str(e)
        }

# === 8. ROUTES ===

@app.post("/api/sentiment/save")
async def save_sentiment(data: SentimentRecord, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sentiment_id = f"sent_{uuid.uuid4().hex[:8]}"
            cur.execute("""
                INSERT INTO sentiment_analyses 
                (id, brand_name, positive_pct, negative_pct, neutral_pct, full_output, conversation_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (sentiment_id, data.brand_name, data.positive_pct, 
                  data.negative_pct, data.neutral_pct, data.full_output, data.conversation_id))
            conn.commit()
            
            # Return format yang sesuai dengan frontend (camelCase)
            return {
                "status": "success",
                "id": sentiment_id,
                "brandName": data.brand_name,
                "positivePct": data.positive_pct,
                "negativePct": data.negative_pct,
                "neutralPct": data.neutral_pct,
                "fullOutput": data.full_output,
                "conversationId": data.conversation_id,
                "createdAt": datetime.now().timestamp() * 1000
            }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving sentiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/sentiment/brands")
async def get_brands(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT brand_name FROM sentiment_analyses ORDER BY brand_name")
            rows = cur.fetchall()
            return {"brands": [r["brand_name"] for r in rows if r["brand_name"]]}
    except Exception as e:
        return {"brands": []}
    finally:
        conn.close()

@app.get("/api/sentiment/list")
async def get_sentiment_list(brand_name: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sql = "SELECT * FROM sentiment_analyses"
            params = []
            if brand_name:
                sql += " WHERE brand_name = %s"
                params.append(brand_name)
            sql += " ORDER BY created_at DESC LIMIT 100"
            
            cur.execute(sql, params)
            rows = cur.fetchall()
            # Mapping ke format yang diharapkan Frontend (camelCase)
            results = []
            for r in rows:
                results.append({
                    "id": r["id"],
                    "brandName": r["brand_name"],
                    "positivePct": float(r["positive_pct"]),
                    "negativePct": float(r["negative_pct"]),
                    "neutralPct": float(r["neutral_pct"]),
                    "fullOutput": r["full_output"],
                    "conversationId": r.get("conversation_id"),  # Bisa None
                    "createdAt": r["created_at"].timestamp() * 1000
                })
            return results
    finally:
        conn.close()

# === CONTENT PLANS ENDPOINTS ===

@app.post("/api/content-plans/save")
async def save_content_plan(data: ContentPlanRecord, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert atau update content plan
            cur.execute("""
                INSERT INTO content_plans (id, title, campaign, brand_name, conversation_id, schema_valid)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    campaign = EXCLUDED.campaign,
                    brand_name = EXCLUDED.brand_name,
                    conversation_id = EXCLUDED.conversation_id,
                    schema_valid = EXCLUDED.schema_valid,
                    updated_at = CURRENT_TIMESTAMP
            """, (data.id, data.title, data.campaign, data.brand_name, data.conversation_id, data.schema_valid))
            
            # Delete existing talents
            cur.execute("DELETE FROM plan_talents WHERE plan_id = %s", (data.id,))
            
            # Insert new talents
            for talent in data.talents:
                cur.execute("""
                    INSERT INTO plan_talents (plan_id, talent_name)
                    VALUES (%s, %s)
                    ON CONFLICT (plan_id, talent_name) DO NOTHING
                """, (data.id, talent))
            
            # Insert atau update version
            version_id = f"{data.id}_{data.version}"
            cur.execute("""
                INSERT INTO plan_versions (id, plan_id, version, content, metadata)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata
            """, (version_id, data.id, data.version, 
                  json.dumps(data.content), json.dumps(data.metadata) if data.metadata else None))
            
            conn.commit()
            
            # Return format yang sesuai dengan frontend (camelCase)
            return {
                "status": "success",
                "id": data.id,
                "title": data.title,
                "campaign": data.campaign,
                "brandName": data.brand_name,
                "conversationId": data.conversation_id,
                "schemaValid": data.schema_valid,
                "talents": data.talents,
                "version": data.version,
                "createdAt": datetime.now().timestamp() * 1000
            }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving content plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/content-plans/brands")
async def get_content_plan_brands(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT brand_name FROM content_plans WHERE brand_name IS NOT NULL ORDER BY brand_name")
            rows = cur.fetchall()
            return {"brands": [r["brand_name"] for r in rows if r["brand_name"]]}
    except Exception as e:
        return {"brands": []}
    finally:
        conn.close()

@app.get("/api/content-plans/list")
async def get_content_plans_list(id: Optional[str] = None, brand_name: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if id:
                # Get specific plan with versions and talents
                cur.execute("""
                    SELECT id, title, campaign, brand_name, conversation_id, schema_valid, created_at, updated_at
                    FROM content_plans WHERE id = %s
                """, (id,))
                plan_row = cur.fetchone()
                
                if not plan_row:
                    raise HTTPException(status_code=404, detail="Content plan not found")
                
                # Get versions
                cur.execute("""
                    SELECT id, version, content, metadata, created_at
                    FROM plan_versions WHERE plan_id = %s ORDER BY created_at DESC
                """, (id,))
                versions_rows = cur.fetchall()
                
                # Get talents
                cur.execute("""
                    SELECT talent_name FROM plan_talents WHERE plan_id = %s ORDER BY talent_name
                """, (id,))
                talents_rows = cur.fetchall()
                
                return {
                    "id": plan_row["id"],
                    "title": plan_row["title"],
                    "campaign": plan_row["campaign"],
                    "brandName": plan_row["brand_name"],
                    "conversationId": plan_row["conversation_id"],
                    "schemaValid": plan_row["schema_valid"],
                    "talents": [r["talent_name"] for r in talents_rows],
                    "versions": [{
                        "id": r["id"],
                        "version": r["version"],
                        "content": r["content"],
                        "metadata": r["metadata"],
                        "createdAt": r["created_at"].timestamp() * 1000
                    } for r in versions_rows],
                    "createdAt": plan_row["created_at"].timestamp() * 1000,
                    "updatedAt": plan_row["updated_at"].timestamp() * 1000
                }
            else:
                # Get all plans (summary) with optional brand filter
                sql = """
                    SELECT id, title, campaign, brand_name, schema_valid, updated_at
                    FROM content_plans
                """
                params = []
                if brand_name:
                    sql += " WHERE brand_name = %s"
                    params.append(brand_name)
                sql += " ORDER BY updated_at DESC LIMIT 100"
                
                cur.execute(sql, params)
                plans_rows = cur.fetchall()
                
                results = []
                for plan_row in plans_rows:
                    # Get talents for this plan
                    cur.execute("""
                        SELECT talent_name FROM plan_talents WHERE plan_id = %s ORDER BY talent_name
                    """, (plan_row["id"],))
                    talents_rows = cur.fetchall()
                    
                    # Get latest version
                    cur.execute("""
                        SELECT version FROM plan_versions WHERE plan_id = %s ORDER BY created_at DESC LIMIT 1
                    """, (plan_row["id"],))
                    version_row = cur.fetchone()
                    
                    results.append({
                        "id": plan_row["id"],
                        "title": plan_row["title"],
                        "campaign": plan_row["campaign"],
                        "brandName": plan_row["brand_name"],
                        "schemaValid": plan_row["schema_valid"],
                        "talents": [r["talent_name"] for r in talents_rows],
                        "version": version_row["version"] if version_row else "v1.0",
                        "updatedAt": plan_row["updated_at"].timestamp() * 1000
                    })
                
                return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching content plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# === TRENDS ENDPOINTS ===

@app.post("/api/trends/save")
async def save_trend(data: TrendRecord, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            trend_id = f"trend_{uuid.uuid4().hex[:8]}"
            
            # Parse full_output untuk extract structured data (sederhana, bisa diperbaiki nanti)
            # Untuk sekarang, simpan full_output saja
            cur.execute("""
                INSERT INTO market_trends (id, brand_name, conversation_id, full_output)
                VALUES (%s, %s, %s, %s)
            """, (trend_id, data.brand_name, data.conversation_id, data.full_output))
            
            conn.commit()
            
            # Return format yang sesuai dengan frontend (camelCase)
            return {
                "status": "success",
                "id": trend_id,
                "brandName": data.brand_name,
                "fullOutput": data.full_output,
                "conversationId": data.conversation_id,
                "createdAt": datetime.now().timestamp() * 1000
            }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving trend: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/trends/list")
async def get_trends_list(brand_name: Optional[str] = None, id: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if id:
                cur.execute("""
                    SELECT id, brand_name, full_output, conversation_id, created_at
                    FROM market_trends WHERE id = %s
                """, (id,))
                row = cur.fetchone()
                
                if not row:
                    raise HTTPException(status_code=404, detail="Trend analysis not found")
                
                return {
                    "id": row["id"],
                    "brandName": row["brand_name"],
                    "fullOutput": row["full_output"],
                    "conversationId": row.get("conversation_id"),
                    "createdAt": row["created_at"].timestamp() * 1000
                }
            else:
                sql = "SELECT id, brand_name, full_output, conversation_id, created_at FROM market_trends"
                params = []
                if brand_name:
                    sql += " WHERE brand_name = %s"
                    params.append(brand_name)
                sql += " ORDER BY created_at DESC LIMIT 100"
                
                cur.execute(sql, params)
                rows = cur.fetchall()
                
                results = []
                for r in rows:
                    results.append({
                        "id": r["id"],
                        "brandName": r["brand_name"],
                        "fullOutput": r["full_output"],
                        "conversationId": r.get("conversation_id"),
                        "createdAt": r["created_at"].timestamp() * 1000
                    })
                return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/trends/brands")
async def get_trend_brands(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT brand_name FROM market_trends ORDER BY brand_name")
            rows = cur.fetchall()
            return {"brands": [r["brand_name"] for r in rows if r["brand_name"]]}
    except Exception as e:
        return {"brands": []}
    finally:
        conn.close()

# === USER PROFILE & PASSWORD ENDPOINTS ===

@app.put("/api/user/profile")
async def update_profile(data: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        user_id = user.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user token")
        
        with conn.cursor() as cur:
            updates = []
            params = []
            
            if data.email is not None:
                # Check if email already exists
                cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data.email, user_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Email already exists")
                updates.append("email = %s")
                params.append(data.email)
            
            if data.username is not None:
                # Check if username already exists
                cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (data.username, user_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Username already exists")
                updates.append("username = %s")
                params.append(data.username)
            
            if data.full_name is not None:
                updates.append("full_name = %s")
                params.append(data.full_name)
            
            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            params.append(user_id)
            sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            cur.execute(sql, params)
            conn.commit()
            
            # Fetch updated user
            cur.execute("SELECT id, email, username, full_name, role FROM users WHERE id = %s", (user_id,))
            updated_user = cur.fetchone()
            
            return {
                "id": updated_user["id"],
                "email": updated_user["email"],
                "username": updated_user["username"],
                "fullName": updated_user["full_name"],
                "role": updated_user["role"]
            }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/user/change-password")
async def change_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        user_id = user.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user token")
        
        # Validate new password
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")
        
        with conn.cursor() as cur:
            # Get current password hash
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
            user_row = cur.fetchone()
            
            if not user_row:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Verify current password (menggunakan SHA256 sesuai dengan backend)
            current_hash = hashlib.sha256(data.current_password.encode("utf-8")).hexdigest()
            stored_hash = user_row["password_hash"]
            
            if current_hash != stored_hash:
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            
            # Check if new password is different
            if data.current_password == data.new_password:
                raise HTTPException(status_code=400, detail="New password must be different from current password")
            
            # Hash new password dengan SHA256 (sesuai dengan sistem yang ada)
            new_hash = hashlib.sha256(data.new_password.encode("utf-8")).hexdigest()
            
            # Update password
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
            conn.commit()
            
            return {"status": "success", "message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/users/list")
async def get_users_list(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        # Only admin can view all users
        user_role = user.get("role")
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized. Admin access required.")
        
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, email, username, full_name, role, is_active, created_at, last_login
                FROM users 
                ORDER BY created_at DESC
            """)
            rows = cur.fetchall()
            
            users = []
            for r in rows:
                users.append({
                    "id": r["id"],
                    "email": r["email"],
                    "username": r["username"],
                    "fullName": r.get("full_name"),
                    "role": r["role"],
                    "isActive": r.get("is_active", True),
                    "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
                    "lastLogin": r["last_login"].isoformat() if r.get("last_login") else None,
                })
            
            return {"users": users}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/users/create")
async def create_user(data: CreateUserRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        # Only admin can create users
        user_role = user.get("role")
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized. Admin access required.")
        
        # Validate password
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
        # Validate role
        valid_roles = ["user", "admin", "moderator"]
        if data.role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
        
        with conn.cursor() as cur:
            # Check if email or username already exists
            cur.execute("SELECT id FROM users WHERE email = %s OR username = %s", (data.email, data.username))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email or username already exists")
            
            # Hash password dengan SHA256 (sesuai dengan sistem yang ada)
            password_hash = hashlib.sha256(data.password.encode("utf-8")).hexdigest()
            
            # Generate user ID
            user_id = f"user_{uuid.uuid4().hex[:8]}"
            
            # Insert user
            cur.execute("""
                INSERT INTO users (id, email, username, password_hash, full_name, role, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_id, data.email, data.username, password_hash, data.full_name, data.role, True))
            
            conn.commit()
            
            # Fetch created user
            cur.execute("""
                SELECT id, email, username, full_name, role, is_active, created_at
                FROM users WHERE id = %s
            """, (user_id,))
            new_user = cur.fetchone()
            
            return {
                "user": {
                    "id": new_user["id"],
                    "email": new_user["email"],
                    "username": new_user["username"],
                    "fullName": new_user.get("full_name"),
                    "role": new_user["role"],
                    "isActive": new_user.get("is_active", True),
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        # Only admin can update users
        user_role = user.get("role")
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized. Admin access required.")
        
        with conn.cursor() as cur:
            # Check if user exists
            cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            
            # Build update query
            updates = []
            params = []
            
            if data.email is not None:
                # Check if email already exists
                cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data.email, user_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Email already exists")
                updates.append("email = %s")
                params.append(data.email)
            
            if data.username is not None:
                # Check if username already exists
                cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (data.username, user_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Username already exists")
                updates.append("username = %s")
                params.append(data.username)
            
            if data.full_name is not None:
                updates.append("full_name = %s")
                params.append(data.full_name)
            
            if data.role is not None:
                valid_roles = ["user", "admin", "moderator"]
                if data.role not in valid_roles:
                    raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
                updates.append("role = %s")
                params.append(data.role)
            
            if data.password is not None:
                if len(data.password) < 6:
                    raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
                password_hash = hashlib.sha256(data.password.encode("utf-8")).hexdigest()
                updates.append("password_hash = %s")
                params.append(password_hash)
            
            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            params.append(user_id)
            sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            cur.execute(sql, params)
            conn.commit()
            
            # Fetch updated user
            cur.execute("""
                SELECT id, email, username, full_name, role, is_active, created_at, last_login
                FROM users WHERE id = %s
            """, (user_id,))
            updated_user = cur.fetchone()
            
            return {
                "user": {
                    "id": updated_user["id"],
                    "email": updated_user["email"],
                    "username": updated_user["username"],
                    "fullName": updated_user.get("full_name"),
                    "role": updated_user["role"],
                    "isActive": updated_user.get("is_active", True),
                    "createdAt": updated_user["created_at"].isoformat() if updated_user["created_at"] else None,
                    "lastLogin": updated_user["last_login"].isoformat() if updated_user.get("last_login") else None,
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.patch("/api/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, data: ToggleActiveRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        # Only admin can toggle user status
        user_role = user.get("role")
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized. Admin access required.")
        
        current_user_id = user.get("sub")
        # Prevent deactivating yourself
        if user_id == current_user_id and not data.is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        
        with conn.cursor() as cur:
            # Check if user exists
            cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            
            # Update user status
            cur.execute("UPDATE users SET is_active = %s WHERE id = %s", (data.is_active, user_id))
            conn.commit()
            
            return {"success": True, "isActive": data.is_active}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error toggling user active: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/")
async def health():
    return {"status": "Online", "service": "Bagana AI"}

@app.post("/api/auth/login")
async def login(data: LoginRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, email, password_hash, role, full_name FROM users WHERE email = %s", (data.email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    access_token = jwt.encode({
        "sub": str(user["id"]), 
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "role": user["role"], "name": user["full_name"]}
    }

@app.get("/api/auth/me")
async def get_me(user_payload: dict = Depends(get_current_user)):
    user_id = user_payload.get("sub")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, username, full_name, role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "id": user["id"],
                "email": user["email"],
                "username": user.get("username") or user["email"].split("@")[0],
                "fullName": user.get("full_name"),
                "role": user["role"]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/crew/execute")
async def execute_crew(req: CrewRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    execution_id = f"exec_{uuid.uuid4().hex[:8]}"
    
    # Status awal saat mulai
    results_storage[execution_id] = {"status": "processing", "result": None}
    
    # Jalankan proses AI di background
    background_tasks.add_task(run_crewai_logic, execution_id, req.user_input)
    
    return {"execution_id": execution_id, "status": "processing"}

@app.get("/api/crew/status/{execution_id}")
async def get_status(execution_id: str):
    data = results_storage.get(execution_id)
    if not data:
        raise HTTPException(status_code=404, detail="ID eksekusi tidak ditemukan")
    
    return data

# === 9. RUN ===
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)