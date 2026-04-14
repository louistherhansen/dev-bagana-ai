# BAGANA AI – Content Strategy Platform

**BAGANA AI** is an AI-powered platform for KOL, influencer, and content creator agencies to manage content strategy at scale. It combines **content planning**, **sentiment analysis**, and **market trend insights** so agencies can create structured multi-talent content plans, optimize messaging and engagement, and run data-driven campaigns without proportionally increasing manual workload.

**Repository:** [github.com/louistherhansen/bagana-ai-conent-planer](https://github.com/louistherhansen/bagana-ai-conent-planer)

This project is built using the **AAMAD** (AI-Assisted Multi-Agent Application Development) framework for context-driven, multi-agent development with CrewAI.

---

## Table of Contents

- [About BAGANA AI](#about-bagana-ai)
- [AAMAD phases at a glance](#aamad-phases-at-a-glance)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Phase 1: Define Workflow (Product Manager)](#phase-1-define-workflow-product-manager)
- [Phase 2: Build Workflow (Multi-Agent)](#phase-2-build-workflow-multi-agent)
- [Core Concepts](#core-concepts)
- [Contributing](#contributing)
- [License](#license)
- [Quick reference](#quick-reference)

---

## About BAGANA AI

BAGANA AI targets agency ops managers, content strategists, and campaign managers who coordinate multiple talents and campaigns. It provides:

- **Structured multi-talent content plans** — Calendars, briefs, and messaging aligned to campaigns
- **Sentiment analysis** — Tone and sentiment inputs for content and briefs
- **Market trend insights** — Trend and market data to inform strategy
- **Unified workflow** — One platform for planning, sentiment, and trends (no manual copy-paste across tools)

System design (CrewAI agents, API, data flow, MVP scope) is specified in the [SAD](project-context/1.define/sad.md).

Key artifacts: [use case](Usecase.txt), [MRD](project-context/1.define/mrd.md), [PRD](project-context/1.define/prd.md), [SAD](project-context/1.define/sad.md), [validation](project-context/1.define/validation-completeness.md), [assumptions & open questions](project-context/1.define/assumptions-and-open-questions.md), and [handoff approval](project-context/1.define/handoff-approval.md) for the technical build phase. Build artifacts: [setup](project-context/2.build/setup.md), [frontend](project-context/2.build/frontend.md), [backend](project-context/2.build/backend.md), [integration](project-context/2.build/integration.md), [QA](project-context/2.build/qa.md) (smoke/functional tests, defects, gaps, future work).

---

## AAMAD phases at a glance

AAMAD organizes work into three phases: Define, Build, and Deliver, each with clear artifacts, personas, and rules to keep development auditable and reusable. 
The flow begins by defining context and templates, proceeds through multi‑agent build execution, and finishes with operational delivery.

```mermaid
flowchart LR
  %% AAMAD phases overview
  subgraph P1[DEFINE]
    D1H[ PERSONA ]:::hdr --> D1L["• Product Manager<br/>(@product-mgr)"]:::list
    D2H[TEMPLATES]:::hdr --> D2L["• Market Research<br/>• PRD"]:::list
  end

  subgraph P2[BUILD]
    B1H[AGENTS]:::hdr --> B1L["• Project Mgr<br/>• System Architect<br/>• Frontend Eng<br/>• Backend Eng<br/>• Integration Eng<br/>• QA Eng"]:::list
    B2H[RULES]:::hdr --> B2L["• core<br/>• development‑workflow<br/>• adapter‑crewai"]:::list
  end

  subgraph P3[DELIVER]
    L1H[AGENTS]:::hdr --> L1L["• DevOps Eng"]:::list
    L2H[RULES]:::hdr --> L2L["• continuous‑deploy<br/>• hosting‑environment<br/>• access‑control"]:::list
  end

  P1 --> P2 --> P3

  classDef hdr fill:#111,stroke:#555,color:#fff;
  classDef list fill:#222,stroke:#555,color:#fff;
``` 

- Phase 1: (Define)
    - Product Manager persona (`@product-mgr`) conducts prompt-driven discovery and context setup, supported by templates for Market Research Document (MRD) and Product Requirements Document (PRD), to standardize project scoping.

- Phase 2: (Build)
    - Multi‑agent execution by Project Manager, System Architect, Frontend Engineer, Backend Engineer, Integration Engineer, and QA Engineer, governed by core, development‑workflow, and CrewAI‑specific rules.

- Phase 3: (Deliver)
    - DevOps Engineer focuses on release and runtime concerns using rules for continuous deployment, hosting environment definitions, and access control.


---

## Repository Structure

    bagana-ai-conent-planer/
    ├─ .cursor/
    │   ├─ agents/    # Agent persona definitions (project-mgr, system-arch, frontend, backend, etc.)
    │   ├─ prompts/   # Phase-specific agent prompts
    │   ├─ rules/     # AAMAD core, workflow, adapter (CrewAI), epics
    │   └─ templates/ # MRD, PRD, SAD generation templates
    ├─ frontend/      # Next.js app (npm workspace `bagana-ai`)
    │   ├─ app/       # App Router (SAD §3)
    │   │   ├─ api/crew/  # Chat API; POST invokes CrewAI crew
    │   │   ├─ chat/      # Chat interface (assistant-ui)
    │   │   ├─ dashboard/ # Features overview
    │   │   ├─ plans/     # Content plans stub (F1)
    │   │   ├─ reports/   # Reports stub (F6)
    │   │   ├─ sentiment/ # Sentiment analysis stub (F2)
    │   │   ├─ trends/    # Trend insights stub (F3)
    │   │   └─ settings/  # Settings stub (F10)
    │   ├─ components/    # React components (PageLayout, ChatInterface, FeatureStub, etc.)
    │   ├─ lib/           # Shared TS (db, auth, API clients)
    │   ├─ public/        # Static assets
    │   └─ package.json   # Next.js, React, assistant-ui, Tailwind
    ├─ config/        # CrewAI agent and task config (SAD §2)
    │   ├─ agents.yaml
    │   ├─ tasks.yaml
    │   └─ stubs.yaml # Backlog agent/task stubs (P1)
    ├─ crew/          # Python CrewAI orchestration layer (SAD §4)
    │   ├─ __init__.py
    │   ├─ run.py     # Entrypoint; kickoff(); --stdin for API
    │   ├─ tools.py   # Stub tools (plan/sentiment/trend validators)
    │   └─ stubs.py   # Backlog stubs (SentimentAPIClient, etc.)
    ├─ project-context/
    │   ├─ 1.define/  # mrd, prd, sad, handoff-approval, assumptions-and-open-questions, validation-completeness
    │   ├─ 2.build/   # setup.md, frontend.md, backend.md, integration.md, qa.md, logs/, artifacts
    │   └─ 3.deliver/ # QA logs, deploy configs, release notes
    ├─ scripts/       # DB / ops / test utilities (Python + shell); JS chat tests may live here too
    ├─ .venv/         # Python virtual environment (create via python -m venv .venv; in .gitignore)
    ├─ env.example    # Env template (copy to .env); OPENAI_API_KEY, AAMAD_ADAPTER
    ├─ package.json   # npm workspaces root; run `npm run dev` from repo root
    ├─ requirements.txt # Python deps: crewai, pyyaml (CrewAI layer) — if present at root
    ├─ Usecase.txt    # BAGANA AI use case (source for PRD)
    ├─ CHECKLIST.md   # Step-by-step execution guide
    └─ README.md      # This file

**Framework artifacts** in `.cursor/` are the AAMAD rules and templates. **project-context/** holds BAGANA AI–specific outputs (MRD, PRD, SAD, [setup](project-context/2.build/setup.md), [frontend](project-context/2.build/frontend.md), [backend](project-context/2.build/backend.md), [integration](project-context/2.build/integration.md), [QA](project-context/2.build/qa.md)). **`frontend/`** (under it, **app/** and **components/**) is the Next.js UI with chat wired to CrewAI; **config/** and **crew/** implement the CrewAI orchestration, agents, and tools.

---

## Architecture Overview

### System Architecture

BAGANA AI uses a **full-stack architecture with a FastAPI backend**. Next.js provides the UI and a small BFF layer:
- **Next.js API routes** handle **authentication/session/profile** directly against PostgreSQL (users + sessions).
- **Next.js API routes** also proxy AI + analytics requests to **FastAPI**.

```
Frontend (Next.js)
  ├─ Chat Interface (assistant-ui)
  ├─ Content Plans View (with history & brand filter)
  ├─ Sentiment Analysis View (with history & brand filter)
  └─ Market Trend Insights View (with history & brand filter)
       ↓
Next.js API Routes (BFF)
  ├─ Auth/session/profile (PostgreSQL)
  │   ├─ /api/auth/login
  │   ├─ /api/auth/logout
  │   ├─ /api/auth/me
  │   └─ /api/user/profile
  ├─ Admin bootstrap (PostgreSQL)
  │   └─ /api/admin/bootstrap
  └─ Proxies to FastAPI
      ├─ /api/crew → FastAPI /api/crew/execute (CrewAI)
      ├─ /api/content-plans, /brands → FastAPI
      ├─ /api/sentiment-analysis, /brands → FastAPI
      └─ /api/trends, /brands → FastAPI
       ↓
Backend FastAPI (Docker)
  ├─ /api/crew/execute → CrewAI Execution
  ├─ /api/content-plans/save → PostgreSQL
  ├─ /api/content-plans/list → PostgreSQL (supports brand filter)
  ├─ /api/content-plans/brands → PostgreSQL
  ├─ /api/sentiment/save → PostgreSQL
  ├─ /api/sentiment/list → PostgreSQL (supports brand filter)
  ├─ /api/sentiment/brands → PostgreSQL
  ├─ /api/trends/save → PostgreSQL
  ├─ /api/trends/list → PostgreSQL (supports brand filter)
  └─ /api/trends/brands → PostgreSQL
       ↓
PostgreSQL Database (Docker)
  ├─ users
  ├─ sessions
  ├─ content_plans
  ├─ sentiment_analyses
  └─ market_trends
```

### Data Flow

1. **Crew AI Execution:**
   - User sends a message in Chat → frontend calls `POST /api/crew`
   - Next.js proxies to FastAPI `POST /api/crew/execute`
   - FastAPI runs CrewAI and returns the result
   - Frontend renders output and the backend persists history (content plans / sentiment / trends)

2. **Auto-Save & Refresh:**
   - After a crew run completes, results are saved to:
     - Content Plans (task `create_content_plan`)
     - Sentiment Analysis (task `analyze_sentiment`)
     - Market Trends (task `research_trends`)
   - The UI triggers a `crew-save-done` event to auto-refresh views
   - All views provide history with a brand filter

3. **Authentication:**
   - Login creates a session cookie `auth_token` (HTTP-only)
   - Some UI calls also include `Authorization: Bearer <token>` from `localStorage` (legacy support)
   - Next.js API routes accept either cookie or Authorization header, and forward Bearer to FastAPI when proxying
   - FastAPI verifies auth via `get_current_user()` (JWT or session token lookup in PostgreSQL)

### Key Features

- **Unified backend:** Content plans, sentiment, and trends use the same FastAPI backend and PostgreSQL.
- **Auto-refresh UX:** Views refresh after a crew run completes (via `crew-save-done`).
- **Secure API:** Endpoints require an authenticated session (cookie) or Bearer token.
- **Data consistency:** Consistent data shapes between frontend (camelCase) and backend (snake_case).
- **History & filtering:** Views provide history with brand filtering for easier navigation.
- **Detail views:** Content Plans has a detail view showing metadata and versions.

---

## Getting Started

### Quick start (chat + CrewAI)

1. **Clone this repository.**
   ```bash
   git clone https://github.com/louistherhansen/bagana-ai-conent-planer.git
   cd bagana-ai-conent-planer
   ```

2. **Set environment.** Copy [env.example](env.example) to `.env` and set required variables:
   ```bash
   # Windows: copy env.example .env
   # Linux/macOS: cp env.example .env
   # Edit .env and set:
   OPENAI_API_KEY=sk-your-key-here
   DATABASE_URL=postgresql://user:password@localhost:5432/bagana_db
   SECRET_KEY=your-secret-key-here
   BACKEND_API_URL=http://localhost:8000
   ```
   **Env file location:** You can place `.env` / `.env.local` in **repo root** or in **`frontend/`**. The project loads env from both locations to support running `npm run dev` from the monorepo root.

   Do not commit `.env` / `.env.local`. Chat and crew runs require a valid `OPENAI_API_KEY`; see [Known issues](project-context/2.build/integration.md#8-known-issues).

3. **Install Node.js dependencies and start the dev server.**
   ```bash
   npm install
   npm run dev
   ```
   The app runs at **http://localhost:3000**. Open it in the browser, then go to `/chat` to use the AI assistant.

   **If you see "Port 3000 is in use"** (or 3001, 3002, …): another dev process is still running. Close other terminals running `npm run dev`, or run:
   ```bash
   npm run dev:clean
   ```
   This script frees ports 3000–3004 and then starts dev on port 3000.

4. **Start Backend FastAPI (Docker).** The backend runs in Docker:
   ```bash
   # Start PostgreSQL and FastAPI backend
   docker-compose up -d
   
   # Check backend health
   curl http://localhost:8000/
   ```

5. **Install Python (for CrewAI).** The chat API spawns the Python crew. Ensure Python 3.10+ is in PATH:
   ```bash
   # Create venv (optional, recommended)
   python -m venv .venv
   # Windows: .\.venv\Scripts\Activate.ps1
   # Linux/macOS: source .venv/bin/activate

   pip install -r requirements.txt
   ```

### Database note (PostgreSQL)

This project expects the PostgreSQL database named by `DB_NAME` (from `.env`) to exist. If you see errors like `database "...\" does not exist`, create it once:

```bash
node frontend/scripts/create-db.mjs
```

### Routes

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/login` | Login page (authentication required) |
| `/dashboard` | Features overview |
| `/chat` | AI chat — content planning crew (plan → sentiment → trends) |
| `/plans` | Content Plans — view and manage content plans |
| `/sentiment` | Sentiment Analysis — view sentiment analysis results |
| `/trends` | Market Trend Insights — view trend research results |
| `/reports` | Reports (UI ready; backend integration deferred) |
| `/settings` | Settings (profile + user management) |

### Run crew from CLI

```bash
python -m crew.run "Create a content plan for a summer campaign with 3 talents"
```

Or with JSON on stdin (e.g. for smoke tests):

```bash
# Linux/macOS:
echo '{"message":"Smoke test"}' | python -m crew.run --stdin

# Windows PowerShell:
'{"message":"Smoke test"}' | python -m crew.run --stdin
```

Expect JSON on stdout: `{"status":"complete", "output":"...", "task_outputs": [...]}` or `{"status":"error", "error":"..."}`. With invalid or missing `OPENAI_API_KEY`, the crew returns `status: "error"`.

### Chat API

POST `/api/crew` accepts JSON and returns the crew output:

```bash
curl -X POST http://localhost:3000/api/crew \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"Create a content plan for a summer campaign"}'
```

Response: `{ "status": "complete", "output": "...", "task_outputs": [...] }` or `{ "status": "error", "error": "..." }`. 

**Note:** Authentication token required. Get token from `/api/auth/login` endpoint. See [backend.md](project-context/2.build/backend.md) §10 for full spec.

---

## Crew Chat Flow (Content Plan) — detailed

This documents the end-to-end flow from **Chat UI → `/api/crew` → CrewAI (local subprocess or cloud) → response**, including the main configuration files and artifacts.

<details>
<summary><strong>Flowchart (click to expand)</strong></summary>

```mermaid
flowchart TD
    Start([User Types Message<br/>in Chat Interface]) --> LangSelect{Language<br/>Selected?}
    LangSelect -->|Yes| SetLang[Set output_language<br/>from dropdown]
    LangSelect -->|No| DefaultLang[Default: Same as<br/>user message]
    SetLang --> ExtractMsg
    DefaultLang --> ExtractMsg[Extract message text<br/>from ChatRuntimeProvider]
    
    ExtractMsg --> APIReq[POST /api/crew<br/>body: message, language]
    
    APIReq --> CheckCloud{CrewAI Cloud<br/>Config Exists?}
    
    CheckCloud -->|Yes<br/>CREWAI_CLOUD_URL +<br/>CREWAI_BEARER_TOKEN| CloudMode[Cloud Mode:<br/>runCrewCloud]
    CheckCloud -->|No| LocalMode[Local Mode:<br/>runCrew]
    
    %% Cloud Flow
    CloudMode --> CloudKickoff[POST /kickoff<br/>Authorization: Bearer token<br/>body: inputs, webhooks]
    CloudKickoff --> CloudPoll{Poll Status<br/>or Webhook?}
    CloudPoll -->|Poll| PollStatus[GET /status/kickoff_id<br/>Poll every 3s<br/>Max 60 attempts]
    PollStatus --> CloudComplete{Status<br/>Complete?}
    CloudComplete -->|No| PollStatus
    CloudComplete -->|Yes| CloudResult[Extract output<br/>from response]
    CloudPoll -->|Webhook| WebhookWait[Wait for webhook<br/>POST /api/crew/webhook]
    WebhookWait --> CloudResult
    CloudResult --> FormatResponse
    
    %% Local Flow
    LocalMode --> ValidateKey{API Key<br/>Valid?}
    ValidateKey -->|No| KeyError[Return 401 Error<br/>with helpful message]
    ValidateKey -->|Yes| SpawnPy[Spawn Python subprocess<br/>python -m crew.run --stdin]
    
    SpawnPy --> WriteStdin[Write JSON payload<br/>to stdin]
    WriteStdin --> PyLoad[Python: Load .env<br/>Detect API key type]
    
    PyLoad --> DetectKey{Key Type?}
    DetectKey -->|sk-or-v1-...| OpenRouter[Configure OpenRouter<br/>model: openrouter/...]
    DetectKey -->|sk-...| OpenAI[Configure OpenAI<br/>base_url: api.openai.com]
    
    OpenRouter --> LoadConfig
    OpenAI --> LoadConfig[Load YAML Configs<br/>agents.yaml, tasks.yaml]
    
    LoadConfig --> BuildAgents[Build Agents<br/>product_intelligence_agent<br/>sentiment_risk_agent<br/>trend_market_agent<br/>content_strategy_agent<br/>brand_safety_compliance_agent]
    
    BuildAgents --> BindTools[Bind Tools per Agent<br/>product_intelligence_schema_validator<br/>sentiment_schema_validator<br/>trend_schema_validator<br/>plan_schema_validator<br/>brand_safety_schema_validator]
    
    BindTools --> BuildTasks[Build Tasks<br/>analyze_product_intelligence<br/>analyze_sentiment_risk<br/>research_trends_market<br/>create_content_strategy<br/>check_brand_safety_compliance]
    
    BuildTasks --> SetContext[Set Task Context<br/>analyze_product_intelligence: []<br/>analyze_sentiment_risk: [product_intelligence]<br/>research_trends_market: [product_intelligence]<br/>create_content_strategy: [product_intelligence, sentiment_risk, trends_market]<br/>check_brand_safety_compliance: [content_strategy]]
    
    SetContext --> BuildCrew[Create Crew<br/>Sequential execution<br/>verbose=False]
    
    BuildCrew --> Kickoff[crew.kickoff inputs:<br/>user_input, output_language]
    
    Kickoff --> Task1[Task 1: analyze_product_intelligence<br/>Agent: product_intelligence_agent<br/>Output: product_intelligence.md]
    
    Task1 --> Task2[Task 2: analyze_sentiment_risk<br/>Agent: sentiment_risk_agent<br/>Context: product_intelligence output]
    
    Task1 --> Task3[Task 3: research_trends_market<br/>Agent: trend_market_agent<br/>Context: product_intelligence output]
    
    Task2 --> Task4[Task 4: create_content_strategy<br/>Agent: content_strategy_agent<br/>Context: product_intelligence, sentiment_risk, trends_market]
    Task3 --> Task4
    
    Task4 --> Task5[Task 5: check_brand_safety_compliance<br/>Agent: brand_safety_compliance_agent<br/>Context: content_strategy output]
    
    Task5 --> CollectOutputs[Collect Task Outputs<br/>raw_output<br/>task_outputs array]
    
    CollectOutputs --> WriteArtifacts[Write Artifacts<br/>project-context/2.build/artifacts/<br/>product_intelligence.md<br/>sentiment_risk.md<br/>trends_market.md<br/>content_strategy.md<br/>brand_safety_compliance.md]
    
    WriteArtifacts --> StepCallback[Step Callback<br/>Log to trace.log]
    
    StepCallback --> ReturnJSON[Return JSON to stdout<br/>status, output, task_outputs]
    
    ReturnJSON --> ReadStdout[Read stdout from<br/>Python subprocess]
    
    ReadStdout --> ParseJSON{Valid<br/>JSON?}
    ParseJSON -->|No| ParseError[Return Error<br/>with stderr]
    ParseJSON -->|Yes| FormatResponse[Format Response<br/>for API]
    
    FormatResponse --> StripMarkdown[Strip Markdown<br/>Remove # headers<br/>Remove ** bold]
    
    StripMarkdown --> ReturnAPI[Return JSON Response<br/>status, output, task_outputs]
    
    ReturnAPI --> DisplayChat[Display in Chat UI<br/>Show formatted text<br/>Show loading indicator]
    DisplayChat --> End([User Sees<br/>Content Plan])
    
    KeyError --> End
    ParseError --> End
    
    style Start fill:#e1f5ff
    style End fill:#d4edda
    style CloudMode fill:#fff3cd
    style LocalMode fill:#d1ecf1
    style Task1 fill:#f8d7da
    style Task2 fill:#f8d7da
    style Task3 fill:#f8d7da
    style Task4 fill:#f8d7da
    style Task5 fill:#f8d7da
    style KeyError fill:#f8d7da
    style ParseError fill:#f8d7da
```

</details>

### Key config files

- **`config/agents.yaml`**: agent roles/goals/backstories + LLM config.
- **`config/tasks.yaml`**: task descriptions, expected outputs, dependencies/context.
- **`.env` / `.env.local`**: API key + optional cloud settings.

### Output artifacts

All artifacts are written to `project-context/2.build/artifacts/`:

- `product_intelligence.md`
- `sentiment_risk.md`
- `trends_market.md`
- `content_strategy.md`
- `brand_safety_compliance.md`

### API Endpoints

**Next.js API (http://localhost:3000):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login (creates session cookie `auth_token`, also returns token) |
| `/api/auth/logout` | POST | Logout (clears session cookie) |
| `/api/auth/me` | GET | Get current user from session |
| `/api/user/profile` | PUT | Update current user's profile (PostgreSQL) |
| `/api/admin/bootstrap` | POST | Bootstrap the first admin (only if no admin exists yet) |
| `/api/crew` | POST | Run CrewAI via FastAPI proxy |
| `/api/content-plans` | GET/POST/PUT | Content plans proxy to FastAPI |
| `/api/content-plans/brands` | GET | Content plan brand list proxy to FastAPI |
| `/api/sentiment-analysis` | GET/POST | Sentiment proxy to FastAPI |
| `/api/sentiment-analysis/brands` | GET | Sentiment brand list proxy to FastAPI |
| `/api/trends` | GET/POST | Trends proxy to FastAPI |
| `/api/trends/brands` | GET | Trends brand list proxy to FastAPI |
| `/api/users` | GET/POST | User management proxy to FastAPI |
| `/api/users/:id` | PUT | Update user proxy to FastAPI |
| `/api/users/:id/toggle-active` | PATCH | Toggle active proxy to FastAPI |

**FastAPI Backend (http://localhost:8000):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crew/execute` | POST | Execute CrewAI crew |
| `/api/crew/status/{id}` | GET | Get execution status |
| `/api/content-plans/save` | POST | Save content plan |
| `/api/content-plans/list` | GET | List content plans (supports `?id=...` or `?brand_name=...`) |
| `/api/content-plans/brands` | GET | Get distinct content-plan brands |
| `/api/sentiment/save` | POST | Save sentiment analysis |
| `/api/sentiment/list` | GET | List sentiment analyses |
| `/api/sentiment/brands` | GET | Get distinct sentiment brands |
| `/api/trends/save` | POST | Save trend analysis |
| `/api/trends/list` | GET | List trend analyses |
| `/api/trends/brands` | GET | Get distinct trend brands |
| `/api/users/list` | GET | List users |
| `/api/users/create` | POST | Create user |
| `/api/users/{id}` | PUT | Update user |
| `/api/users/{id}/toggle-active` | PATCH | Toggle user active status |

Authentication: Next.js uses an HTTP-only session cookie by default; many requests also send `Authorization: Bearer <token>` for compatibility. When proxying to FastAPI, Next.js forwards the Bearer header (from cookie or Authorization).

### Smoke and functional tests

- **Backend-only (Python crew):** Verifies crew accepts JSON on stdin and returns JSON on stdout. Run from repo root (see “Run crew from CLI” above for stdin examples). With invalid `OPENAI_API_KEY` you get `{"status":"error","error":"..."}`; contract is still valid.
- **Full stack (frontend + backend):** With the dev server running (`npm run dev`), run the round-trip test in another terminal:
  ```bash
  node scripts/test-chat-roundtrip.mjs
  ```
  This checks GET `/api/crew` (health) and POST `/api/crew` (chat). Optional: set `BASE_URL` if the app is not on `http://localhost:3000` (e.g. `BASE_URL=http://localhost:3001 node scripts/test-chat-roundtrip.mjs`).

For verification steps, **known issues** (invalid/missing OPENAI_API_KEY, 120s timeout, no streaming), **defects**, **gaps**, and **future work** (E2E, WCAG, streaming), see [integration.md](project-context/2.build/integration.md) §7–8 and [qa.md](project-context/2.build/qa.md).

### Manual verification after build (UI smoke check)

After running `Remove-Item .next; npm run build`:

1. Ensure no other process is using port 3000 (stop other `npm run dev` / `npm start` instances).
2. Start the production server:
   ```powershell
   npm start
   ```
3. Open **http://localhost:3000** in your browser.
4. Verify: Home (header, nav, footer), Chat (message input + Send), Dashboard (feature cards). The UI should look consistent and styled (not unstyled HTML).

If the UI looks broken: confirm `frontend/tailwind.config.js` has the required safelist and `frontend/app/globals.css` contains the base layers; then delete `frontend/.next` and run `npm run build` again.

If the UI does not render (blank page): clear build cache and restart dev server:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

Then open **http://localhost:3000** (hard refresh: Ctrl+Shift+R).

### AAMAD workflow

5. Ensure `.cursor/` contains the full agent, prompt, and rule set (included in repo).
6. Follow [CHECKLIST.md](CHECKLIST.md) to run phases — e.g. *create-mrd*, *create-prd*, *create-sad*, *setup-project*, *develop-fe*, *develop-be* — using Cursor or another agent-enabled IDE.
7. Each persona (e.g. `@project-mgr`, `@system-arch`, `@frontend.eng`, `@backend.eng`) runs its epic(s) and writes artifacts under `project-context/`.
8. Review, test, and iterate toward the MVP defined in the PRD.

---

## Phase 1: Define Stage (Product Manager)

The Product Manager persona (`@product-mgr`) conducts prompt-driven discovery and context setup to standardize project scoping:

- **Market Research:** Generate [MRD](project-context/1.define/mrd.md) using `.cursor/templates/mr-template.md` (review use case and PRD).
- **Requirements:** Generate [PRD](project-context/1.define/prd.md) using `.cursor/templates/prd-template.md` (from use case / research).
- **Validation:** Validate completeness of market analysis, user personas, feature requirements, success metrics, and business goals ([validation-completeness.md](project-context/1.define/validation-completeness.md)).
- **Assumptions & open questions:** Record in [assumptions-and-open-questions.md](project-context/1.define/assumptions-and-open-questions.md) for downstream resolution (SAD, setup, backend, project plan).
- **Handoff approval:** Approve context boundaries and artifacts for the technical build phase ([handoff-approval.md](project-context/1.define/handoff-approval.md)).

Phase 1 outputs live in `project-context/1.define/`. After approval, the System Architect (`@system-arch`) creates the [SAD](project-context/1.define/sad.md) using *create-sad* (template + PRD/MRD/use case); then Build executes setup, frontend, backend, integration, and QA per [epics-index](.cursor/rules/epics-index.mdc).

---

## Phase 2: Build Stage (Multi-Agent)

Each role is embodied by an agent persona, defined in `.cursor/agents/`.  
Phase 2 starts after [handoff approval](project-context/1.define/handoff-approval.md); run each epic in sequence per [CHECKLIST.md](CHECKLIST.md):

- **Architecture:** System Architect generates [SAD](project-context/1.define/sad.md) (`*create-sad` with PRD, MRD, use case, [sad-template](.cursor/templates/sad-template.md)).
- **Setup:** Project Manager scaffolds environment per PRD/SAD: [setup.md](project-context/2.build/setup.md) documents `config/`, `crew/`, `requirements.txt`, env; Backend implements crew and tools.
- **Frontend:** Next.js + assistant-ui chat, feature stubs, responsive layout; documented in [frontend.md](project-context/2.build/frontend.md)
- **Backend:** Implement backend, document (`backend.md`)
- **Integration:** Wire up chat flow, verify, document (`integration.md`)
- **Quality Assurance:** Test end-to-end, log results and limitations (`qa.md`)

Artifacts are versioned and stored in `project-context/2.build` for traceability.

---

## Core Concepts

- **Persona-driven development:** Each workflow is owned and documented by a clear AI agent persona with a single responsibility principle.
- **Context artifacts:** All major actions, decisions, and documentation are stored as markdown artifacts, ensuring explainability and reproducibility.
- **Parallelizable epics:** Big tasks are broken into epics, making development faster and more autonomous while retaining control over quality.
- **Reusability:** Framework reusable for any project—simply drop in your PRD/SAD and let the agents execute.
- **Open, transparent, and community-driven:** All patterns and artifacts are readable, auditable, and extendable.

---

## Contributing

Contributions are welcome.

- Open an [issue](https://github.com/louistherhansen/bagana-ai-conent-planer/issues) for bugs, feature ideas, or improvements.
- Submit pull requests for template updates, agent persona changes, or documentation.
- Keep artifacts under `project-context/` and `.cursor/` consistent with the PRD and AAMAD rules.

---

## License

Licensed under Apache License 2.0.

> Why Apache-2.0
>    Explicit patent grant and patent retaliation protect maintainers and users from patent disputes, which is valuable for AI/ML methods, agent protocols, and orchestration logic.
>    Permissive terms enable proprietary or closed-source usage while requiring attribution and change notices, which encourages integration into enterprise stacks.
>    Compared to MIT/BSD, Apache-2.0 clarifies modification notices and patent rights, reducing legal ambiguity for contributors and adopters.

---

---

## Quick reference

| Topic | Link |
|-------|------|
| Use case | [Usecase.txt](Usecase.txt) |
| PRD / SAD / MRD | [project-context/1.define/](project-context/1.define/) |
| Setup, frontend, backend, integration, QA | [project-context/2.build/](project-context/2.build/) — [setup](project-context/2.build/setup.md), [frontend](project-context/2.build/frontend.md), [backend](project-context/2.build/backend.md), [integration](project-context/2.build/integration.md), [qa](project-context/2.build/qa.md) |
| Smoke test (Python crew) | `'{"message":"Smoke test"}' \| python -m crew.run --stdin` (PowerShell) or `echo '{"message":"Smoke test"}' \| python -m crew.run --stdin` (bash) |
| Chat round-trip test | `node scripts/test-chat-roundtrip.mjs` (requires `npm run dev` in another terminal) |
| Known issues (API key, timeout, streaming) | [integration.md §8](project-context/2.build/integration.md#8-known-issues) |
| Defects, gaps, future work | [qa.md](project-context/2.build/qa.md) |

## Recent Updates

### Content plans, sentiment, trends — history & filtering

- **History views**: Plans, Sentiment, and Trends support history browsing with a brand filter.
- **Detail views**: Plans include a detail panel with metadata and versions.
- **Auto-refresh**: Views refresh after a crew run via the `crew-save-done` event.
- **Brand list endpoint**: `/api/content-plans/brands` (proxied to FastAPI).

### Auth & settings improvements

- **Session-first auth**: login creates an HTTP-only cookie `auth_token`; some calls also use Bearer token for compatibility.
- **Profile updates**: handled in Next.js (`PUT /api/user/profile`) directly against PostgreSQL.
- **Admin bootstrap**: `POST /api/admin/bootstrap` can promote the first admin (only when no admin exists).

### Navigation & UI consistency

- **English UI**: user-facing UI strings were normalized to English.
- **Navigation cleanup**: removed pricing/subscription entry points from the main nav and settings.

---

> **Phase 1:** Validate, record assumptions/open questions, then approve handoff ([handoff-approval.md](project-context/1.define/handoff-approval.md)).  
> **Phase 2:** Step-by-step execution in [CHECKLIST.md](CHECKLIST.md).  
> **Reference:** `.cursor/templates/` and `.cursor/rules/` for prompt engineering and adapter rules.

