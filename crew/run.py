"""
BAGANA AI — Crew run entrypoint.
SAD §2, §4: Load agents and tasks from config/agents.yaml, config/tasks.yaml;
orchestrate crew; bind tools in code.
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

# Fix Windows console encoding before any library writes to stdout/stderr (avoids UnicodeEncodeError)
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load .env from project root so OPENROUTER_API_KEY / OPENAI_API_KEY etc. are set when running python -m crew.run
try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
except ImportError:
    pass

import yaml

# OpenRouter: when OPENROUTER_API_KEY is set, use it as OPENAI_API_KEY so CrewAI/LLM client uses it.
# Bersihkan key dari BOM, spasi, newline, kutip (sering bikin 401).
def _clean_key(val: str | None) -> str:
    if not val:
        return ""
    s = val.strip().strip("'\"").replace("\r", "").replace("\n", "").replace("\uFEFF", "").strip()
    return "".join(c for c in s if not c.isspace())


_or = _clean_key(os.environ.get("OPENROUTER_API_KEY"))
_oa = _clean_key(os.environ.get("OPENAI_API_KEY"))

# Detect key type: OpenRouter keys start with "sk-or-v1-", OpenAI keys with "sk-" or "sk-proj-"
def _is_openrouter_key(key: str) -> bool:
    return key.startswith("sk-or-v1-") if key else False

def _is_openai_key(key: str) -> bool:
    return (key.startswith("sk-") and not key.startswith("sk-or-")) if key else False

# Determine which provider to use based on available keys
_use_openrouter = _is_openrouter_key(_or) or _is_openrouter_key(_oa)
_use_openai_direct = not _use_openrouter and (_is_openai_key(_oa) or _is_openai_key(_or))

if _use_openrouter:
    _api_key = _or if _is_openrouter_key(_or) else _oa
    os.environ["OPENROUTER_API_KEY"] = _api_key
    os.environ["OPENAI_API_KEY"] = _api_key
elif _use_openai_direct:
    _api_key = _oa if _is_openai_key(_oa) else _or
    os.environ["OPENAI_API_KEY"] = _api_key
    # Clear OpenRouter settings to avoid confusion
    if "OPENROUTER_API_KEY" in os.environ:
        del os.environ["OPENROUTER_API_KEY"]
else:
    _api_key = _oa or _or
    if _api_key:
        os.environ["OPENAI_API_KEY"] = _api_key

# Configure base URL and model based on provider
_base = (os.environ.get("OPENAI_API_BASE") or os.environ.get("OPENAI_BASE_URL") or "").lower()
_configured_model = os.environ.get("OPENAI_MODEL") or os.environ.get("OPENAI_MODEL_NAME") or "gpt-4o-mini"


def _litellm_openrouter_model(raw: str) -> str:
    """LiteLLM membutuhkan prefix openrouter/ (lihat docs.litellm.ai/providers/openrouter)."""
    m = (raw or "gpt-4o-mini").strip()
    if m.startswith("openrouter/"):
        return m
    # Tanpa slash: anggap model OpenAI (openai/gpt-4o-mini), bukan openrouter/gpt-4o-mini (invalid)
    if "/" not in m:
        m = f"openai/{m}"
    return f"openrouter/{m}"


if _use_openrouter:
    # OpenRouter + LiteLLM (dipakai CrewAI): lihat https://docs.litellm.ai/docs/providers/openrouter
    _openrouter_base = (
        os.environ.get("OPENROUTER_API_BASE")
        or os.environ.get("OPENAI_API_BASE")
        or "https://openrouter.ai/api/v1"
    ).strip()
    _openrouter_model = _litellm_openrouter_model(_configured_model)
    os.environ["OPENAI_BASE_URL"] = _openrouter_base
    os.environ["OPENAI_API_BASE"] = _openrouter_base
    os.environ["OPENROUTER_API_BASE"] = _openrouter_base
    os.environ["OPENAI_MODEL"] = _openrouter_model
    os.environ["OPENAI_MODEL_NAME"] = _openrouter_model
    # Disarankan LiteLLM untuk OpenRouter (ranking / kompatibilitas klien)
    if not (os.environ.get("OR_SITE_URL") or "").strip():
        os.environ["OR_SITE_URL"] = (os.environ.get("OPENROUTER_SITE_URL") or "http://localhost:3000").strip()
    if not (os.environ.get("OR_APP_NAME") or "").strip():
        os.environ["OR_APP_NAME"] = (os.environ.get("OPENROUTER_APP_NAME") or "Bagana AI").strip()
elif _use_openai_direct:
    # OpenAI direct: use OpenAI API endpoint, strip any openrouter prefix from model
    _openrouter_base = None
    _openrouter_model = None
    _openai_model = _configured_model.replace("openrouter/", "").replace("openai/", "")
    os.environ["OPENAI_BASE_URL"] = "https://api.openai.com/v1"
    os.environ["OPENAI_API_BASE"] = "https://api.openai.com/v1"
    os.environ["OPENAI_MODEL"] = _openai_model
    os.environ["OPENAI_MODEL_NAME"] = _openai_model
else:
    _openrouter_base = "https://openrouter.ai/api/v1" if "openrouter.ai" in _base else None
    _openrouter_model = None
    if _openrouter_base:
        _openrouter_model = (_configured_model or "openai/gpt-4o-mini").strip()
        os.environ["OPENAI_MODEL"] = _openrouter_model
        os.environ["OPENAI_MODEL_NAME"] = _openrouter_model
    if os.environ.get("OPENAI_BASE_URL") and not os.environ.get("OPENAI_API_BASE"):
        os.environ["OPENAI_API_BASE"] = os.environ["OPENAI_BASE_URL"]
    if os.environ.get("OPENAI_MODEL") and not os.environ.get("OPENAI_MODEL_NAME"):
        os.environ["OPENAI_MODEL_NAME"] = os.environ["OPENAI_MODEL"]

try:
    from crewai import Agent, Task, Crew, LLM
    _LLM_AVAILABLE = True
except ImportError:
    from crewai import Agent, Task, Crew
    LLM = None
    _LLM_AVAILABLE = False

from crew.tools import (
    plan_schema_validator,
    sentiment_schema_validator,
    trend_schema_validator,
    TOOLS_AVAILABLE,
)

# Backlog stubs: crew.stubs (SentimentAPIClient, TrendAPIClient, build_report_summarizer_agent_stub, etc.)

# Create LLM instance based on detected provider (when crewai exports LLM; else rely on env)
CONFIGURED_LLM = None
if _LLM_AVAILABLE and LLM is not None:
    if _use_openrouter and _openrouter_model and _api_key:
        # OpenRouter: model ID = provider/model (e.g. openai/gpt-4o-mini), base_url = OpenRouter
        CONFIGURED_LLM = LLM(
            model=_openrouter_model,
            api_key=_api_key,
            base_url=_openrouter_base,
        )
    elif _use_openai_direct and _api_key:
        # OpenAI direct: use OpenAI API with standard model names
        _openai_model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        CONFIGURED_LLM = LLM(
            model=_openai_model,
            api_key=_api_key,
            base_url="https://api.openai.com/v1",
        )

# When CONFIGURED_LLM is None (e.g. crewai without top-level LLM), agents use env: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
ENV_MODEL_STRING = os.environ.get("OPENAI_MODEL") or os.environ.get("OPENAI_MODEL_NAME") or "gpt-4o-mini"

# Backward compatibility alias
OPENROUTER_LLM = CONFIGURED_LLM

# Config paths per SAD
CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
AGENTS_PATH = CONFIG_DIR / "agents.yaml"
TASKS_PATH = CONFIG_DIR / "tasks.yaml"
LOGS_DIR = Path(__file__).resolve().parent.parent / "project-context" / "2.build" / "logs"

# Agent ID -> tools mapping. When CrewAI has no @tool (e.g. 0.30 in Docker), use [] to avoid .bind() error.
AGENT_TOOLS = (
    {
        "content_planner": [plan_schema_validator],
        "sentiment_analyst": [sentiment_schema_validator],
        "trend_researcher": [trend_schema_validator],
    }
    if TOOLS_AVAILABLE
    else {
        "content_planner": [],
        "sentiment_analyst": [],
        "trend_researcher": [],
    }
)

# Valid Agent constructor params (filter YAML to avoid passing invalid fields)
# Per adapter rules: explicitly set llm, allow_delegation, verbose, max_iter, max_execution_time, 
# tools, memory, respect_context_window, max_retry_limit
AGENT_PARAMS = {
    "role", "goal", "backstory", "llm", "allow_delegation", "verbose",
    "max_iter", "max_execution_time", "max_retry_limit", "respect_context_window",
    "tools", "memory",  # memory added per adapter rules
}

# Valid Task constructor params
TASK_PARAMS = {
    "name", "description", "expected_output", "agent", "context",
    "output_file", "create_directory",
}


def _load_yaml(path: Path) -> dict:
    """Load and parse YAML file."""
    if not path.exists():
        raise FileNotFoundError(f"Config missing: {path}. Run *setup-project.")
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _build_agent(agent_id: str, config: dict) -> Agent:
    """Build CrewAI Agent from YAML config. Bind tools in code per adapter."""
    params = {k: v for k, v in config.items() if k in AGENT_PARAMS}
    params.pop("tools", None)  # We bind tools in code
    tools = AGENT_TOOLS.get(agent_id, [])
    params["tools"] = tools
    # Use configured LLM when crewai exports LLM; else leave llm from YAML so Agent uses env (OPENAI_*).
    # CrewAI 0.30 calls .bind() on llm — do not pass a string; omit or use CONFIGURED_LLM only.
    yaml_llm = params.get("llm", "")
    if CONFIGURED_LLM is not None and (not yaml_llm or yaml_llm in ("openai", "gpt-4o-mini", "openai/gpt-4o-mini")):
        params["llm"] = CONFIGURED_LLM
    elif CONFIGURED_LLM is None:
        # CrewAI 0.30 calls .bind() on llm — never pass a string. Omit llm so Agent uses default from env.
        params.pop("llm", None)
    # Enforce memory=False for reproducible artifacts per adapter rules (unless explicitly set in YAML)
    if "memory" not in params:
        params["memory"] = False
    # Validate required attributes per adapter rules
    required_attrs = ["role", "goal", "backstory"]
    for attr in required_attrs:
        if attr not in params or not params[attr] or not params[attr].strip():
            raise ValueError(f"Agent {agent_id}: missing or empty required attribute '{attr}'")
    return Agent(**params)


def _build_task(
    task_id: str,
    config: dict,
    agents: dict[str, Agent],
    task_refs: dict[str, Task],
) -> Task:
    """
    Build CrewAI Task from YAML config. Resolve context_from to Task refs.
    Per adapter rules: explicit Task.context for inter-task dependencies.
    """
    agent_ref = config.get("agent")
    if agent_ref not in agents:
        raise ValueError(f"Task {task_id}: unknown agent '{agent_ref}'. Available agents: {list(agents.keys())}")
    agent = agents[agent_ref]

    params = {k: v for k, v in config.items() if k in TASK_PARAMS}
    params["agent"] = agent
    params.pop("context_from", None)  # Remove context_from, we'll resolve it below

    # Resolve context_from to actual Task references
    context_from = config.get("context_from", [])
    if context_from:
        # Resolve task IDs to Task objects
        context_tasks = []
        for ctx_task_id in context_from:
            if ctx_task_id in task_refs:
                context_tasks.append(task_refs[ctx_task_id])
            else:
                import warnings
                warnings.warn(f"Task {task_id}: context task '{ctx_task_id}' not yet built. This may cause issues.")
        params["context"] = context_tasks
    elif "context" not in params:
        # Default to empty context if not specified
        params["context"] = []

    return Task(**params)


def load_config() -> tuple[dict, dict]:
    """Load agent and task config from YAML."""
    agents_data = _load_yaml(AGENTS_PATH)
    tasks_data = _load_yaml(TASKS_PATH)
    return agents_data, tasks_data


def build_crew() -> Crew:
    """
    Build Crew from YAML config.
    MVP Flow per SAD §2: content_planner → (sentiment_analyst, trend_researcher) with shared plan context.
    Sequential execution for deterministic builds; no delegation; memory=False for reproducibility.
    """
    agents_data, tasks_data = load_config()
    agents_cfg = agents_data.get("agents", {})
    tasks_cfg = tasks_data.get("tasks", {})

    # Validate tool presence per adapter (pre-run check to avoid KeyError: 'tools')
    missing_tools = []
    for aid in agents_cfg:
        if aid not in AGENT_TOOLS:
            missing_tools.append(aid)
    if missing_tools:
        raise ValueError(f"Agents with missing tool bindings: {missing_tools}. Add to AGENT_TOOLS in run.py.")

    # Build agents
    agents = {aid: _build_agent(aid, cfg) for aid, cfg in agents_cfg.items()}
    
    # Validate all agents have memory=False per adapter rules (for reproducible artifacts)
    for aid, agent in agents.items():
        if hasattr(agent, "memory") and agent.memory is not False:
            # Log warning but don't fail (YAML may have explicit memory=True for specific use cases)
            import warnings
            warnings.warn(f"Agent {aid}: memory is not False. Artifacts may not be fully reproducible per adapter rules.")

    # Build tasks in dependency order per MVP flow (SAD §2):
    # 1. create_content_plan (first, no dependencies - context: [])
    # 2. analyze_sentiment, research_trends (parallel, depend on content_plan via context_from)
    task_refs: dict[str, Task] = {}
    tasks: list[Task] = []

    # Task order matches MVP flow: plan → sentiment + trend (parallel)
    # Dependencies are resolved via context_from in tasks.yaml
    task_order = [
        "create_content_plan",  # First: no dependencies
        "analyze_sentiment",    # Second: depends on create_content_plan
        "research_trends",      # Third: depends on create_content_plan (parallel with analyze_sentiment)
    ]

    for tid in task_order:
        if tid not in tasks_cfg:
            raise ValueError(f"Task {tid} not found in tasks.yaml. Required for MVP flow.")
        t = _build_task(tid, tasks_cfg[tid], agents, task_refs)
        task_refs[tid] = t
        tasks.append(t)
    
    # Validate task dependencies are resolved (optional check for debugging)
    # Note: CrewAI will handle task dependencies automatically, but we log warnings for debugging
    for task in tasks:
        if hasattr(task, "context") and task.context:
            task_name = getattr(task, "name", "unknown")
            context_task_names = [getattr(ctx, "name", "unknown") for ctx in task.context if hasattr(ctx, "name")]
            if context_task_names:
                # Log for debugging (can be removed in production)
                import logging
                logging.debug(f"Task {task_name} depends on: {context_task_names}")

    return Crew(agents=list(agents.values()), tasks=tasks, verbose=False, step_callback=_step_callback)


def _step_callback(step: object) -> None:
    """Write step to Trace Log per adapter Memory and Logging. Also send progress to stdout for API streaming."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / "trace.log"
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    info = getattr(step, "__dict__", {}) if hasattr(step, "__dict__") else (step if isinstance(step, dict) else {})
    
    # Extract agent and task info
    agent_obj = info.get("agent") or getattr(step, "agent", None)
    task_obj = info.get("task") or getattr(step, "task", None)
    
    # Get agent name/id
    if agent_obj:
        agent_name = getattr(agent_obj, "role", None) or getattr(agent_obj, "__class__", {}).__name__ if hasattr(agent_obj, "__class__") else str(agent_obj)
        if hasattr(agent_obj, "role"):
            agent_name = agent_obj.role
        elif isinstance(agent_obj, str):
            agent_name = agent_obj
        else:
            agent_name = str(agent_obj)[:50]
    else:
        agent_name = "?"
    
    # Get task name/id - prefer name over description for cleaner display
    if task_obj:
        # Try to get task name first (from tasks.yaml name field)
        task_name = getattr(task_obj, "name", None)
        if not task_name:
            # Fallback to description if name not available
            task_name = getattr(task_obj, "description", None)
        if not task_name:
            # Last resort: string representation
            task_name = str(task_obj)
        # Truncate if too long
        if len(str(task_name)) > 100:
            task_name = str(task_name)[:100]
    else:
        task_name = "?"
    
    # Map agent roles to display names (MVP: 3 core agents)
    # Match exact role strings from agents.yaml
    agent_display_map = {
        "Content Strategy Director for multi-talent content plans and campaign execution frameworks": "Content Planner",
        "Sentiment and Tone Analyst for content and briefs in influencer campaigns": "Sentiment Analyst",
        "Market and Trend Researcher for content strategy and campaign timing": "Trend Researcher",
    }
    # Try exact match first, then partial match
    agent_display = agent_display_map.get(agent_name, None)
    if not agent_display:
        # Fallback: try partial match
        for role_key, display_name in agent_display_map.items():
            if role_key in agent_name or agent_name in role_key:
                agent_display = display_name
                break
        if not agent_display:
            agent_display = agent_name  # Use original if no match
    
    # Write to trace log
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] step: {agent_name} | {task_name}\n")
    
    # Send progress update to stderr as JSON line (for API streaming)
    # Format: {"type": "progress", "agent": "...", "task": "...", "timestamp": "..."}
    # This is read by API route and sent to frontend for real-time progress display
    progress = {
        "type": "progress",
        "agent": agent_display,
        "task": str(task_name)[:100] if len(str(task_name)) > 100 else str(task_name),
        "timestamp": ts,
    }
    try:
        # Write to stderr as JSON line (will be parsed by API route)
        # Flush immediately to ensure progress is sent in real-time
        progress_json = json.dumps(progress) + "\n"
        sys.stderr.write(progress_json)
        sys.stderr.flush()
        # Also log to trace log for debugging
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] progress: {progress_json.strip()}\n")
    except Exception as e:
        # Log error but don't fail the crew execution
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{ts}] ERROR writing progress: {str(e)}\n")
        except:
            pass  # Ignore if log file write fails

# Tambahkan ini di crew/run.py
class BaganaCrew:
    def crew(self) -> Crew:
        return build_crew()

def _collect_token_usage(result: object, task_outputs: list) -> dict | None:
    """
    Try to extract token usage from CrewAI result for cost visibility.
    CrewAI/LLM may expose usage in result.usage, result.tasks_output[].usage, or nested in raw.
    Returns dict like { "input_tokens": N, "output_tokens": M } or None if not available.
    """
    total_in, total_out = 0, 0
    # Result-level usage (some CrewAI versions)
    usage = getattr(result, "usage", None)
    if isinstance(usage, dict):
        total_in += int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
        total_out += int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
    # Per-task usage
    for to in task_outputs or []:
        u = getattr(to, "usage", None)
        if isinstance(u, dict):
            total_in += int(u.get("input_tokens") or u.get("prompt_tokens") or 0)
            total_out += int(u.get("output_tokens") or u.get("completion_tokens") or 0)
    if total_in > 0 or total_out > 0:
        return {"input_tokens": total_in, "output_tokens": total_out}
    return None


def kickoff(inputs: dict | None = None) -> dict:
    """
    Run crew.kickoff(inputs). Returns structured result for API/Integration epic.
    inputs: { user_input: str, campaign_context?: str, language?: str, ... } for task interpolation.
    """
    inputs = inputs or {}
    if "user_input" not in inputs:
        inputs["user_input"] = inputs.get("message", inputs.get("campaign_context", "No context provided."))
    # Multi-language: agents will write output in this language (interpolated in task descriptions)
    if "output_language" not in inputs:
        lang = inputs.get("language") or inputs.get("locale") or ""
        if lang and isinstance(lang, str) and lang.strip():
            inputs["output_language"] = lang.strip()
        else:
            inputs["output_language"] = "the same language as the user's message (e.g. Indonesian, English, or other as appropriate)"

    crew = build_crew()
    if crew.step_callback is None:
        crew.step_callback = _step_callback

    try:
        result = crew.kickoff(inputs=inputs)
    except Exception as e:
        err = str(e)
        if "User not found" in err or "user not found" in err.lower():
            err += (
                " | OpenRouter: kunci API tidak dikenali (401). Periksa OPENROUTER_API_KEY=sk-or-v1-... di .env "
                "(satu baris, tanpa spasi/kutip), salin ulang dari https://openrouter.ai/settings/keys , "
                "pastikan ada kredit, lalu restart backend (docker compose up --build backend)."
            )
        if "401" in err or "Incorrect API key" in err or "invalid_api_key" in err:
            if _use_openai_direct:
                err += " | Tip: OpenAI API key invalid/expired. Buat key baru di https://platform.openai.com/api-keys → isi di .env sebagai OPENAI_API_KEY=sk-... lalu restart."
            else:
                err += " | Tip: OpenRouter API key invalid. Buat key baru di https://openrouter.ai/settings/keys → isi di .env sebagai OPENROUTER_API_KEY=sk-or-v1-... lalu restart."
        elif "OpenrouterException" in err or "No cookie auth" in err:
            err += " | Tip: Anda perlu OpenRouter key (sk-or-v1-...). Buat di https://openrouter.ai/settings/keys → isi di .env sebagai OPENROUTER_API_KEY lalu restart."
        return {"status": "error", "error": err}

    # Build JSON-serializable output for API (CrewOutput: raw, tasks_output or tasks)
    raw_output = getattr(result, "raw", str(result))
    if not isinstance(raw_output, str):
        raw_output = str(raw_output) if raw_output is not None else ""
    task_outputs = getattr(result, "tasks_output", None) or getattr(result, "tasks", []) or []
    # Some versions expose executed output on result.tasks[i].output; use as fallback if tasks_output empty
    if not task_outputs and hasattr(result, "tasks"):
        task_outputs = getattr(result, "tasks", [])

    def _task_output_text(obj) -> str:
        """Extract displayable text from a task output (CrewAI versions use .raw, .output, .result, or dict)."""
        if obj is None:
            return ""
        if isinstance(obj, dict):
            out = (obj.get("output") or obj.get("raw") or obj.get("result") or obj.get("content") or "").strip()
            if out:
                return out
            # Nested: e.g. {"raw": {"content": "..."}}
            for key in ("raw", "output", "result", "content"):
                v = obj.get(key)
                if isinstance(v, dict) and (v.get("content") or v.get("text")):
                    return str(v.get("content") or v.get("text") or "").strip()
                if isinstance(v, str) and len(v) > 20:
                    return v.strip()
            return ""
        # Object: try known attributes first
        for attr in ("raw", "output", "result", "content"):
            val = getattr(obj, attr, None)
            if val is None:
                continue
            if isinstance(val, str) and val.strip() and not val.strip().startswith("<"):
                return val.strip()
            if hasattr(val, "content"):
                c = getattr(val, "content", None)
                if c and isinstance(c, str) and len(c) > 10:
                    return c.strip()
        # Fallback: scan __dict__ for output-like keys first, then longest string
        try:
            d = getattr(obj, "__dict__", None) or {}
            for key in ("output", "raw", "result", "content", "text", "data"):
                v = d.get(key)
                if isinstance(v, str) and len(v) > 20 and not v.strip().startswith("<"):
                    return v.strip()
            best = ""
            for v in d.values():
                if isinstance(v, str) and len(v) > len(best) and len(v) > 30:
                    if not v.startswith("<") and "/" not in v[:50] and "\\" not in v[:50]:
                        best = v
            if best:
                return best.strip()
        except Exception:
            pass
        s = str(obj)
        return s.strip() if s.strip() and not s.startswith("<") and len(s) > 20 else ""

    # Optional: log token usage if CrewAI/LLM returned it (for cost visibility)
    token_usage = _collect_token_usage(result, task_outputs)
    if token_usage:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOGS_DIR / "trace.log", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}] token_usage: {json.dumps(token_usage)}\n")
    
    # Map task outputs to include task name and agent info for frontend
    outputs_list = []
    for i, to in enumerate(task_outputs):
        task_name = getattr(to, "name", None) or getattr(to, "description", None)
        if task_name is None and isinstance(to, dict):
            task_name = to.get("name") or to.get("task") or to.get("description")
        task_name = task_name or f"task_{i}"
        # Try to get agent from task if available
        task_agent = None
        if hasattr(to, "agent"):
            agent_obj = to.agent
            if hasattr(agent_obj, "role"):
                task_agent = agent_obj.role
        elif isinstance(to, dict):
            task_agent = to.get("agent")
        task_out = _task_output_text(to)
        outputs_list.append({
            "task": str(task_name)[:80],
            "agent": task_agent,
            "output": task_out,
        })

    # If CrewAI returns empty raw (e.g. some versions), build output from task_outputs
    if not (raw_output or "").strip() and outputs_list:
        raw_output = "\n\n---\n\n".join(
            f"## {o.get('task', '')}\n{o.get('output', '')}" for o in outputs_list
        )

    out = {
        "status": "complete",
        "output": raw_output or "",
        "task_outputs": outputs_list,
    }
    if token_usage:
        out["token_usage"] = token_usage
    return out


if __name__ == "__main__":
    """CLI entrypoint. Usage: python -m crew.run [message] | python -m crew.run --stdin (reads JSON from stdin, writes JSON to stdout for API)."""
    import json
    import sys
    import os

    # Fix Windows console encoding
    if sys.platform == "win32":
        try:
            # Set UTF-8 encoding for stdout/stderr
            if hasattr(sys.stdout, 'reconfigure'):
                sys.stdout.reconfigure(encoding='utf-8')
            if hasattr(sys.stderr, 'reconfigure'):
                sys.stderr.reconfigure(encoding='utf-8')
            # Also set environment variable
            os.system('chcp 65001 >nul 2>&1')
        except Exception:
            pass  # Ignore if reconfigure not available

    if len(sys.argv) > 1 and sys.argv[1] == "--stdin":
        # API mode: read JSON from stdin; write result to file (primary) and stdout (fallback)
        output_file = os.environ.get("CREW_OUTPUT_FILE", "").strip()
        try:
            payload = json.load(sys.stdin)
            result = kickoff(payload)
            result_json = json.dumps(result, indent=2, ensure_ascii=False)
            if output_file:
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(result_json)
            sys.stdout.write(result_json)
            sys.stdout.flush()
        except Exception as e:
            err_result = {"status": "error", "error": str(e)}
            err_json = json.dumps(err_result, indent=2, ensure_ascii=False)
            if output_file:
                try:
                    with open(output_file, "w", encoding="utf-8") as f:
                        f.write(err_json)
                except Exception:
                    pass
            sys.stdout.write(err_json)
            sys.stdout.flush()
            sys.exit(1)
    else:
        # CLI mode: human-readable output
        msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Create a content plan for a summer campaign with 3 talents."
        result = kickoff({"user_input": msg})
        try:
            print("Status:", result.get("status"))
            if result.get("error"):
                error_msg = str(result["error"]).encode('utf-8', errors='replace').decode('utf-8')
                print("Error:", error_msg)
            else:
                out = result.get("output", "")
                out_str = str(out)[:500] + "..." if len(str(out)) > 500 else str(out)
                out_encoded = out_str.encode('utf-8', errors='replace').decode('utf-8')
                print("Output:", out_encoded)
        except UnicodeEncodeError:
            # Fallback: use ASCII-safe output
            print("Status:", result.get("status"))
            if result.get("error"):
                error_msg = str(result["error"]).encode('ascii', errors='replace').decode('ascii')
                print("Error:", error_msg)
            else:
                out = result.get("output", "")
                out_str = str(out)[:500] + "..." if len(str(out)) > 500 else str(out)
                out_encoded = out_str.encode('ascii', errors='replace').decode('ascii')
                print("Output:", out_encoded)
