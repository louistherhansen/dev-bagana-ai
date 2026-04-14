"""
BAGANA AI — CrewAI stub tools.
SAD §2, §4: File I/O, schema validation. MVP uses stubs; no external APIs.
Per backend-eng prohibited-actions: no persistent storage, analytics, or external integrations.
"""

# CrewAI 0.30 in Docker may not export tool; agents need Tool instances with .bind(), not plain functions.
TOOLS_AVAILABLE = False
try:
    from crewai.tools import tool
    TOOLS_AVAILABLE = True
except ImportError:
    try:
        from crewai import tool
        TOOLS_AVAILABLE = True
    except ImportError:
        def tool(name_or_fn=None):
            """No-op when crewai.tool missing (CrewAI 0.30). run.py will pass tools=[] to agents."""
            if callable(name_or_fn):
                return name_or_fn
            def dec(fn):
                return fn
            return dec


@tool("Validate plan schema")
def plan_schema_validator(content: str) -> str:
    """Validate that a content plan follows the expected schema (Overview, Objectives, Talent Assignments, etc.). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


@tool("Validate sentiment output schema")
def sentiment_schema_validator(content: str) -> str:
    """Validate that sentiment analysis output follows the expected schema (Summary, Risks, Opportunities). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


@tool("Validate trend output schema")
def trend_schema_validator(content: str) -> str:
    """Validate that trend research output follows the expected schema (Key Trends, Implications, Recommendations). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


@tool("Validate product intelligence schema")
def product_intelligence_schema_validator(content: str) -> str:
    """Validate that product intelligence output follows the expected schema (Product Overview, Key Features, Target Audience, etc.). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


@tool("Validate brand safety compliance schema")
def brand_safety_schema_validator(content: str) -> str:
    """Validate that brand safety compliance output follows the expected schema (Compliance Summary, Brand Safety Assessment, etc.). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


@tool("Validate executive summary schema")
def executive_summary_schema_validator(content: str) -> str:
    """Validate that executive summary output follows the expected schema (Executive Summary, Campaign Overview, Strategic Assessment, Risk Analysis, Compliance Status, Recommendations, Decision Record, Audit). Returns validation result. Stub: accepts any content."""
    if not content or not content.strip():
        return "Validation failed: empty content."
    return "Validation passed. Schema structure confirmed. (Stub)"


# --- P1 stubs (report_summarizer, F6) ---


@tool("Render report from plan, sentiment, and trends")
def report_template_renderer(plan: str, sentiment: str, trends: str) -> str:
    """Stub: Render plan + sentiment + trends into report template. P1. Implement in Report crew."""
    if not plan and not sentiment and not trends:
        return "Report (stub): no inputs."
    return "Report rendered. (Stub)"


@tool("Load calendar events from external source")
def calendar_brief_loader(source_path: str, format: str = "ical") -> str:
    """Stub: Load calendar or brief from file/URL. P1 F7. Implement when calendar integration is adopted."""
    return f"Loaded 0 events from {source_path}. (Stub)"
