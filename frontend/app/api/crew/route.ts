import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { loadProjectEnv } from "@/lib/load-env";
import { getUserBySessionToken } from "@/lib/auth";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

loadProjectEnv();

export const runtime = 'nodejs';

// Constants
const CREW_TIMEOUT_MS = 300_000; 
const CREW_CLOUD_POLL_MS = 3_000;
const CREW_CLOUD_POLL_MAX = 100;

// --- Helper Functions ---

function getCrewResultFilePath(): string {
  const dir = path.resolve(process.cwd(), "project-context", "2.build", "logs");
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  return path.join(dir, "crew_result.json");
}

function cleanApiKey(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s/g, "").replace(/^["']|["']$/g, "").trim();
}

function getEnvKey(name: string): string {
  return cleanApiKey(process.env[name] ?? "");
}

function getSessionTokenFromRequest(request: NextRequest): string | null {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return request.cookies.get("auth_token")?.value ?? null;
}

// --- Backend Execution Logic ---

/**
 * Core function: run CrewAI via FastAPI backend (Docker)
 * Forwards Authorization from frontend to backend.
 */
async function runCrewBackend(payload: Record<string, unknown>, request: NextRequest): Promise<Record<string, unknown>> {
  const backendUrl = `${getFastAPIBaseUrl()}/api/crew/execute`;
  const headers = fastAPIProxyHeaders(request, { "Content-Type": "application/json" }, { includeInternal: true });

  // 1) Send task to backend
  const executeRes = await fetch(backendUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!executeRes.ok) {
    const errText = await executeRes.text();
    throw new Error(`Backend API Error (${executeRes.status}): ${errText.slice(0, 200)}`);
  }

  const { execution_id } = await executeRes.json();

  // 2) Poll status
  const statusUrl = backendUrl.replace("/execute", `/status/${execution_id}`);
  
  for (let i = 0; i < CREW_CLOUD_POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, CREW_CLOUD_POLL_MS));

    const statusRes = await fetch(statusUrl, {
      headers: fastAPIProxyHeaders(request, undefined, { includeInternal: true }),
    });
    
    if (statusRes.ok) {
      const data = await statusRes.json();
      if (data.status === "complete" || data.status === "completed") {
        // Backend may return: { status, result (string), output (string), task_outputs (array) }
        // Or: { status, result: { output, task_outputs } }
        // Support both formats for compatibility
        const output = data.output || (typeof data.result === "string" ? data.result : data.result?.output) || "";
        const taskOutputs = data.task_outputs || data.result?.task_outputs || [];
        
        return {
          status: "complete",
          output: output,
          task_outputs: Array.isArray(taskOutputs) ? taskOutputs : []
        };
      }
      if (data.status === "failed" || data.status === "error") {
        throw new Error(data.error || data.output || "AI task failed");
      }
    }
  }

  throw new Error("AI request timed out (polling timeout).");
}

// --- Local Execution (Legacy/Dev) ---
// (Fungsi runCrew dan extractCrewJson tetap ada untuk fallback development)

// ... (Gunakan fungsi runCrew Anda yang lama di sini jika butuh fallback lokal)

// --- API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = body.message ?? body.user_input ?? "";

    // Ping test
    if (message.toLowerCase() === "ping") {
      return NextResponse.json({ status: "complete", output: "Pong! Connection OK." });
    }

    // Require login: verify session in the same DB as Next.js (before proxying to FastAPI)
    const sessionTok = getSessionTokenFromRequest(request);
    if (!sessionTok) {
      return NextResponse.json(
        { error: "Unauthorized", detail: "No active session. Please sign in." },
        { status: 401 }
      );
    }
    const sessionUser = await getUserBySessionToken(sessionTok);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", detail: "Session is invalid or expired." },
        { status: 401 }
      );
    }

    const payload = {
      user_input: message || "No message provided.",
      language: body.language || "id",
    };

    const isProduction = process.env.NODE_ENV === "production";
    const forceBackend = process.env.USE_BACKEND_API === "true";

    let result: Record<string, unknown>;

    // Priority: production & forced-backend always use Docker backend
    if (isProduction || forceBackend) {
      console.log("➡️ Routing to Backend Docker...");
      result = await runCrewBackend(payload, request);
    } else {
      console.log("➡️ Running Local Python...");
      // Call local runCrew function here if enabled
      throw new Error("Local mode is not enabled. Use the backend Docker.");
    }

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("❌ API Route Error:", err.message);
    return NextResponse.json(
      { error: err.message, status: "error" },
      { status: err.message.includes("401") ? 401 : 500 }
    );
  }
}

// GET handler untuk validasi key
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    mode: process.env.NODE_ENV,
    backend_url: `${getFastAPIBaseUrl()}/api/crew/execute`
  });
}