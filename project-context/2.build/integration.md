# BAGANA AI — Integration Artifact

**Document version:** 1.0  
**Persona:** @integration.eng  
**Invocation:** *integrate-api, *verify-messageflow, *log-integration  
**Sources:** frontend.md, backend.md, prd.md, mrd.md, sad.md, Usecase.txt, setup.md  
**Output:** project-context/2.build/integration.md (this file)

---

## Context

This document records the *integrate-api review of the MVP chat flow between the Next.js frontend and the CrewAI backend. It confirms wiring, documents the message flow, and notes gaps and caveats. No external or third-party integrations; MVP chat flow only (Integration epic per epics-index).

**Use case (anchor):**  
BAGANA AI is an AI-powered platform designed for KOL, influencer, and content creator agencies to manage content strategy at scale through integrated content planning, sentiment analysis, and market trend insights.

---

## 1. Integration Summary

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Frontend → API** | Done | ChatRuntimeProvider uses crewAdapter; POST /api/crew with { message } |
| **API → CrewAI** | Done | app/api/crew/route.ts spawns python -m crew.run --stdin; JSON in/out |
| **Response handling** | Done | Frontend renders data.output as assistant text; errors shown as diagnostics |
| **Abort/cancel** | Done | crewAdapter passes abortSignal to fetch |
| **Streaming** | Not implemented | P1 per backend.md; full JSON after crew completes |

**Verdict:** MVP chat flow is wired end-to-end. User message → /api/crew → CrewAI crew.kickoff() → JSON response → assistant reply. Prerequisites: OPENAI_API_KEY in .env (or OpenRouter: OPENAI_API_KEY + OPENAI_BASE_URL + OPENAI_MODEL per §7.6); Python with crewai on PATH.

---

## 2. Traceability to PRD

| PRD requirement | Integration implementation | Status |
|-----------------|----------------------------|--------|
| **F4 — Integrated workflow** | Single chat path: UI → API → crew (plan → sentiment → trend) | Done |
| **§6 — MVP: CLI or minimal UI** | Web chat at /chat using assistant-ui; API as gateway | Done |
| **§3 — Agent orchestration** | API invokes single crew; no manual copy-paste for core path | Done |

---

## 3. Traceability to SAD

| SAD section | Integration implementation | Status |
|-------------|----------------------------|--------|
| **§4 — Next.js API routes** | app/api/crew/route.ts as gateway to CrewAI layer | Done |
| **§4 — Request/response** | POST accepts JSON (message, user_input?, campaign_context?); returns JSON | Done |
| **§6 — Request path** | User input → API → CrewAI layer → crew.kickoff() → outputs | Done |
| **§6 — Streaming** | Not implemented; full response after crew completion (P1) | Deferred |
| **§3 — assistant-ui** | ChatRuntimeProvider + crewAdapter; /chat page | Done |

---

## 4. Traceability to Frontend (frontend.md)

| Frontend artifact | Integration status |
|-------------------|--------------------|
| ChatRuntimeProvider with crewAdapter | Implemented; POST /api/crew, body { message } |
| Mock adapter replaced | Yes; crewAdapter calls real API |
| /api/crew route | Implemented in app/api/crew/route.ts |
| Deferred: Backend wiring | Completed by this integration |
| Deferred: assistant-ui → API | Completed; useLocalRuntime(crewAdapter) |

---

## 5. Traceability to Backend (backend.md)

| Backend artifact | Integration status |
|------------------|--------------------|
| POST /api/crew | Implemented; spawns python -m crew.run --stdin |
| Request body: message, user_input?, campaign_context? | API forwards to crew payload; frontend sends message only |
| Response: status, output, task_outputs or status, error | API returns as-is; frontend uses output for assistant text |
| GET /api/crew | Returns { status: "ok", message: "..." }; usable for health/description |
| Timeout 120s | Enforced in route.ts |
| ChatRuntimeProvider wired to /api/crew | Confirmed in ChatRuntimeProvider.tsx |

---

## 6. Message Flow (MVP Chat)

1. **User:** Types message in chat (ChatInterface → Composer).
2. **Frontend:** crewAdapter.run() takes last user message, POSTs to /api/crew with JSON body { message }.
3. **API (route.ts):** Parses body; builds payload { user_input, message, campaign_context }; spawns `python -m crew.run --stdin`; writes JSON payload to stdin; reads JSON from stdout; returns result or 500 with error.
4. **Python (crew/run.py):** --stdin mode reads JSON, calls kickoff(payload), writes { status, output, task_outputs } or { status, error } to stdout.
5. **Crew:** build_crew() from YAML; crew.kickoff(inputs); three agents run: **Content Planner** → **Sentiment Analyst** → **Trend Researcher** (context from plan). Output: output (string) and task_outputs (array of { task, output }).
6. **Frontend:** On 200 and status !== "error", displays data.output (or combined task_outputs if output empty) as assistant message; on error, displays "Crew error: ..." or "Error: ...".

### 6.1 End-to-end flow: Chat → CrewAI (3 agents) → PostgreSQL → Plans / Sentiment / Trends

The correct integration flow is:

| Step | Component | Action |
|------|-----------|--------|
| 1 | User | Sends message at **http://127.0.0.1:3000/chat** (e.g. brand/campaign brief). |
| 2 | Frontend | POST /api/crew with { message }; crewAdapter in ChatRuntimeProvider. |
| 3 | API | app/api/crew/route.ts spawns `python -m crew.run --stdin`, passes payload, returns { status, output, task_outputs }. |
| 4 | CrewAI | crew/run.py runs 3 agents in sequence: **Content Planner** (create_content_plan), **Sentiment Analyst** (analyze_sentiment), **Trend Researcher** (research_trends). Requires OPENROUTER_API_KEY or OPENAI_API_KEY in .env. |
| 5 | Frontend (on success) | ChatRuntimeProvider extracts from task_outputs and saves to DB: extractAndSaveContentPlan → POST /api/content-plans; extractAndSaveSentimentAnalysis → POST /api/sentiment-analysis; extractAndSaveTrends → POST /api/trends. |
| 6 | PostgreSQL | content_plans, sentiment_analyses, market_trends tables store results (via lib/db and API routes). |
| 7 | Menus | **Plans** (/plans), **Sentiment** (/sentiment), **Trends** (/trends) pages load data from GET /api/content-plans, GET /api/sentiment-analysis, GET /api/trends and display via ContentPlansView, SentimentAnalysisView, TrendInsightsView. |

If crew returns no text output, the user sees: *"Crew finished with no text output. Check .env (OPENROUTER_API_KEY or OPENAI_API_KEY) and logs at project-context/2.build/logs/trace.log."* Backend (crew/run.py) builds output from task_outputs when raw is empty so valid runs should always return content.

---

## 7. Verification (*verify-messageflow)

### 7.1 Contract check

- **Request:** Frontend sends Content-Type: application/json, body { message: string }. API expects message or user_input or campaign_context; default "No message provided." if all empty. Aligned.
- **Response:** API returns JSON with status ("complete" | "error"), output (string), task_outputs (array), or error (string). Frontend checks res.ok, data.status === "error", then uses data.output. Aligned.
- **Abort:** crewAdapter passes options.abortSignal to fetch; cancel is supported.

### 7.2 Manual verification steps

1. Set OPENAI_API_KEY in .env. For OpenRouter, also set OPENAI_BASE_URL and OPENAI_MODEL (see §7.6).
2. From repo root: npm run dev (Next.js); ensure Python has crewai and can run `python -m crew.run --stdin`.
3. Open /chat; send a message (e.g. "Create a content plan for a summer campaign.").
4. Expect: request to POST /api/crew; after crew run (may take 30s–2 min), assistant message shows crew output or an error message.
5. GET /api/crew: expect { status: "ok", message: "..." }.

### 7.3 Round-trip test procedure

**Backend-only (no Next.js):** Verifies Python crew accepts JSON on stdin and returns JSON on stdout.

- From repo root: `'{"message":"Test round-trip"}' | python -m crew.run --stdin`
- Expect: JSON on stdout with `status` ("complete" or "error") and either `output`/`task_outputs` or `error`. Exit code 0 on success, 1 on crew error.
- Observed: JSON contract verified; with invalid/expired OPENAI_API_KEY, crew returns `{"status":"error","error":"..."}` (exit 1). Frontend would receive this and show "Crew error: ...".

**Full API (Next.js + Python):**

1. Start dev server: `npm run dev`.
2. In another terminal: `node scripts/test-chat-roundtrip.mjs` (or set BASE_URL if different).
3. Script tests: GET /api/crew → expect `{ status: "ok", message: "..." }`; POST /api/crew with `{ message: "Test round-trip" }` → expect `status: "complete"` (with valid OPENAI_API_KEY) or `status: "error"` with error message.
4. Manual browser: Open /chat, send a message; assistant reply shows crew output or error.

### 7.4 Round-trip test results (2025-02-02)

| Test | Result | Notes |
|------|--------|-------|
| Python crew.run --stdin with JSON | Pass | Returns valid JSON; error path returns {"status":"error","error":"..."}. |
| GET /api/crew | Not run (server down) | Use script when npm run dev is running. |
| POST /api/crew (via script) | Not run (server down) | Use script when npm run dev is running. |
| Chat UI → API → crew (browser) | Manual | Requires OPENAI_API_KEY; verify in /chat. |

### 7.5 Known limitations

- No automated E2E test run in this review; QA epic owns E2E (frontend.md §7).
- Long crew runs may hit 120s timeout; user sees timeout error.
- No streaming; user sees loading until full response.

### 7.6 OpenRouter (optional LLM provider)

To use [OpenRouter](https://openrouter.ai) instead of OpenAI, set in `.env` (do not commit `.env`):

- **OPENROUTER_API_KEY** — set to your OpenRouter API key (from https://openrouter.ai/settings/keys). Preferred; crew/run.py uses it as OPENAI_API_KEY when set.
- Or **OPENAI_API_KEY** plus **OPENAI_BASE_URL** — `https://openrouter.ai/api/v1`, **OPENAI_MODEL** — e.g. `openai/gpt-4o-mini`.

CrewAI reads these env vars when `llm: openai` is used in agent config. Documented in `env.example`.

---

## 8. Known Issues

| Issue | Severity | Behavior | Mitigation |
|-------|----------|-----------|------------|
| **Invalid or expired OPENAI_API_KEY** | High | Crew returns 401; Python writes error to stderr and JSON `{"status":"error","error":"..."}` to stdout. Frontend shows "Crew error: ...". | Set valid OPENAI_API_KEY in .env (or OpenRouter key when using OpenRouter); do not commit keys. |
| **Missing OPENAI_API_KEY** | High | Crew/LLM calls fail; same JSON error response. | Ensure .env exists and OPENAI_API_KEY is set before running crew or chat. When using OpenRouter, also set OPENAI_BASE_URL and OPENAI_MODEL (§7.6). |
| **120s timeout** | Medium | Full crew run (plan → sentiment → trend) can exceed 120s; API returns 500; frontend shows "Error: Crew timed out...". | Increase CREW_TIMEOUT_MS in app/api/crew/route.ts or add env override (P1). |
| **No streaming** | Medium | User sees loading until full response; long runs feel unresponsive. | P1: implement streaming from crew to API to client (SAD §6). |
| **Python not on PATH or wrong name** | Medium | API spawn fails; "Failed to start crew" or process error. Frontend shows "Error: ...". | Use `python` (Windows) or `python3` (Unix) per route.ts; ensure crewai installed in that env. |
| **Non-JSON or empty stdout from crew** | Low | API may reject or throw; frontend shows generic "Error: ...". | Backend always writes JSON in --stdin mode; if process crashes before write, stdout may be empty. |
| **Crew finished with no text output** | High | API returns 500; frontend shows "Crew finished with no text output. Check .env (OPENROUTER_API_KEY or OPENAI_API_KEY) and logs at project-context/2.build/logs/trace.log." | Set OPENROUTER_API_KEY (or OPENAI_API_KEY) in .env at project root; crew/run.py builds output from task_outputs when raw is empty. **Docker:** Backend image uses crewai>=1.0; rebuild with `docker compose build backend` and ensure .env is passed (OPENROUTER_API_KEY). If using an older image with crewai 0.30, see §8.1. |
| **Round-trip test script requires server** | Low | scripts/test-chat-roundtrip.mjs fails with "fetch failed" if npm run dev is not running. | Start dev server first; document in README or integration.md. |

### 8.1 Chat in Docker (http://127.0.0.1:3000/chat)

Chat **can** work in Docker. Required:

1. **Backend image must use CrewAI 1.x.**  
   In `Full-Stack HITL with FastAPI Backend/requirements.txt`, use `crewai>=1.0,<2`. Older images that pulled crewai 0.30 can cause `'str' object has no attribute 'bind'` or empty output, because 0.30 has different APIs (no top-level LLM, different tool API).

2. **Rebuild backend after changing requirements:**  
   `docker compose build backend` then `docker compose up -d`.

3. **.env at project root** must contain `OPENROUTER_API_KEY` (or `OPENAI_API_KEY`). Docker Compose passes these into the backend container.

4. **If you still see "Crew finished with no text output":**  
   - Check `docker exec bagana-ai-backend cat /app/storage/crew_result.json` — if it shows `"status":"error"`, the message is the real cause.  
   - Rebuild backend so it uses crewai 1.x: `docker compose build --no-cache backend` then `docker compose up -d`.

---

## 10. Gaps and Caveats

| Item | Severity | Owner | Notes |
|------|----------|-------|-------|
| Streaming | P1 | Backend/Integration | SAD §6; improves perceived latency; not in MVP scope for this review |
| campaign_context from UI | Low | Frontend | API supports it; chat currently sends only message; can add later |
| Timeout tuning | Low | Backend | 120s may be tight for full crew; consider env override |
| E2E tests | P1 | QA epic | frontend.md defers to QA; recommend Playwright for /chat round-trip |

---

## 11. File Reference

| File | Role |
|------|------|
| components/ChatRuntimeProvider.tsx | crewAdapter; POST /api/crew; extractAndSaveContentPlan, extractAndSaveSentimentAnalysis, extractAndSaveTrends → save to DB; display output or task_outputs |
| app/api/crew/route.ts | POST/GET handlers; runCrew(); spawn crew.run --stdin; timeout; validate key |
| crew/run.py | --stdin mode; kickoff(); 3 agents (Content Planner, Sentiment Analyst, Trend Researcher); builds output from task_outputs when raw empty; JSON in/out |
| app/api/content-plans/route.ts | GET/POST content plans → PostgreSQL content_plans, plan_versions, plan_talents |
| app/api/sentiment-analysis/route.ts | GET/POST sentiment analyses → PostgreSQL sentiment_analyses |
| app/api/trends/route.ts | GET/POST market trends → PostgreSQL market_trends |
| app/chat/page.tsx | Chat page; ChatRuntimeProvider + ChatInterface |
| app/plans/page.tsx, app/sentiment/page.tsx, app/trends/page.tsx | Plans, Sentiment, Trends menus; load from APIs and display via ContentPlansView, SentimentAnalysisView, TrendInsightsView |
| scripts/test-chat-roundtrip.mjs | Basic round-trip test: GET and POST /api/crew (run with npm run dev) |
| scripts/test-chat-aqua.ps1 | Manual test with Aqua topic; validates key and POST /api/crew |

---

## Sources

- **project-context/2.build/frontend.md** — Chat UI, crewAdapter, deferred wiring.
- **project-context/2.build/backend.md** — API spec, crew.run --stdin, ChatRuntimeProvider wiring.
- **project-context/1.define/prd.md** — F4, §3, §6.
- **project-context/1.define/mrd.md** — Technical feasibility, workflow.
- **project-context/1.define/sad.md** — §3 Frontend, §4 Backend, §6 Data Flow.
- **Usecase.txt** — Product anchor.
- **.cursor/agents/integration-end.md** — Persona, actions, outputs, prohibited actions.
- **.cursor/rules/epics-index.mdc** — Integration epic, output integration.md.

---

## Assumptions

- Backend and frontend artifacts (backend.md, frontend.md) accurately describe the implemented code.
- OPENAI_API_KEY (or OpenRouter key + OPENAI_BASE_URL + OPENAI_MODEL) and Python environment are operator responsibility; not validated in this review.
- MVP scope is chat flow only; no other API or third-party integration required for this epic.

---

## Open Questions

- None blocking MVP chat flow. Streaming and campaign_context in UI can be decided in P1.

---

## Audit

| Timestamp   | Persona           | Action          |
|------------|-------------------|-----------------|
| 2025-02-02 | @integration.eng  | *integrate-api review |
| 2025-02-02 | @integration.eng  | *verify-messageflow |
| 2025-02-02 | @integration.eng  | *log-integration |
| 2025-02-02 | @integration.eng  | Round-trip test; Known issues §8; test script scripts/test-chat-roundtrip.mjs |
| 2025-02-02 | @integration.eng  | OpenRouter env config §7.6; env.example OPENAI_BASE_URL, OPENAI_MODEL |

Integration review complete. MVP chat flow wired; backend JSON contract verified; round-trip procedure and known issues documented. No code fences around machine-parsed sections.
