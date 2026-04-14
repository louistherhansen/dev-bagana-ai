# Unified documentation (summary of former `docs/`)

This file replaces the removed **`docs/`** folder. It keeps a lightweight summary of the previously separate markdown docs as a single entry point.

Code paths reference the current structure: the Next.js app lives under **`frontend/`** (e.g. `frontend/app/`, `frontend/components/`, `frontend/lib/`).

---

## Source list and summaries

### Chat & data

| Former doc | Summary |
|------------|---------|
| **CHAT_HISTORY_SETUP.md** | PostgreSQL chat history setup: DB init scripts, `conversations`/`messages` tables, `DB_*` env, and `/api/chat-history` endpoints. |
| **CONTENT_PLANS_SETUP.md** | PostgreSQL content plans setup: tables (`content_plans`, versions, talents), related API endpoints, and schema notes. |

### Dynamic UI configuration

| Former doc | Summary |
|------------|---------|
| **DYNAMIC_LOGO.md** | Dynamic header logo: `frontend/lib/logo-config.ts`, `frontend/components/Logo.tsx`, and `PageLayout` options. |
| **DYNAMIC_MENU.md** | Dynamic navigation menu: `frontend/lib/nav-config.ts`, `frontend/components/AppNav.tsx`, and `PageLayout` options. |

### CrewAI & cost

| Former doc | Summary |
|------------|---------|
| **CREWAI_TOKEN_COST_ANALYSIS.md** | How token usage grows across sequential tasks; mitigation ideas (shorter prompts, lower `max_iter`, cheaper models). |
| **DEVELOPMENT_PHASES.md** | High-level phased rollout plan (MVP → enhanced → scale). |

### Authentication, sessions, and user management

| Former doc | Summary |
|------------|---------|
| **REVIEW_SESSION_LOGIN_LOGOUT.md** | Session flow: `POST /api/auth/login`, HTTP-only cookie `auth_token`, `GET /api/auth/me`, logout, and protected routes. |
| **LOGIN_FIX_MANUAL_TEST.md** | Password verification migration strategy (legacy SHA-256 + bcrypt) and manual test steps. |
| **FIX_LOGIN_BCRYPT.md** | Notes for bcrypt in Docker environments and how to rebuild/re-verify. |

Current implementation notes:
- **Profile updates**: handled by Next.js (`PUT /api/user/profile`) directly against PostgreSQL.
- **Admin bootstrap**: `POST /api/admin/bootstrap` can promote the first admin (only if no admin exists yet).

### Database security

| Former doc | Summary |
|------------|---------|
| **DATABASE_SECURITY_AUDIT.md** | Initial audit: risks of SHA-256 for passwords, env hygiene, recommendations. |
| **DATABASE_SECURITY_FIXES.md** | Summary of the implemented fixes (bcrypt support, DB env validation). |

### Other

| Former doc | Summary |
|------------|---------|
| **REVIEW_TRENDS_MARKET.md** | Trend research artifacts vs `tasks.yaml`, data persistence, and naming notes. |
| **DEMO_REQUEST_EMAIL_SETUP.md** | SMTP setup for `/api/demo-request`: `SMTP_*`, `DEMO_REQUEST_RECIPIENT`, nodemailer dependency. |

---

## Maintenance notes

- Scripts referenced by older docs may exist under **`scripts/`** (repo root) and/or **`frontend/scripts/`**.
- Environment variables can be placed in **repo root** and/or **`frontend/`**; `frontend/lib/load-env.ts` loads from both.
- This file is intentionally a high-level index; for historical detail, use Git history of the removed `docs/` folder.

---

*Compiled as a summary of the former `docs/` folder before its removal.*
