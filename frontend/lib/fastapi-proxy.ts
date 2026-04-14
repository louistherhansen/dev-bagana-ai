/**
 * Proxy server Next.js → FastAPI: Authorization dari header atau cookie auth_token,
 * (opsional) X-Bagana-Crew-Internal (HMAC SECRET_KEY) untuk panggilan internal tertentu.
 */
import crypto from "crypto";
import { NextRequest } from "next/server";
import { loadProjectEnv } from "@/lib/load-env";

loadProjectEnv();

export function getFastAPIBaseUrl(): string {
  const raw =
    process.env.BACKEND_API_URL ||
    (process.env.NODE_ENV === "production" ? "http://bagana-ai-backend:8000" : "http://localhost:8000");
  return raw.replace(/\/$/, "");
}

/** Bearer untuk FastAPI: header dari klien, atau cookie `auth_token` (login Next.js). */
export function getBearerForFastAPI(request: NextRequest): string {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h;
  const cookie = request.cookies.get("auth_token")?.value;
  if (cookie) return `Bearer ${cookie}`;
  return "Bearer dev-token";
}

/** Sama dengan backend: HMAC-SHA256(SECRET_KEY, 'bagana-crew-internal-v1'). */
export function getFastAPIInternalHeader(): string {
  const sk = (process.env.SECRET_KEY ?? "super-secret-key").trim();
  if (!sk) return "";
  return crypto.createHmac("sha256", sk).update("bagana-crew-internal-v1").digest("hex");
}

export function fastAPIProxyHeaders(
  request: NextRequest,
  extra?: Record<string, string>,
  opts?: { includeInternal?: boolean }
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: getBearerForFastAPI(request),
    ...extra,
  };
  if (opts?.includeInternal) {
    const internal = getFastAPIInternalHeader();
    if (internal) {
      headers["X-Bagana-Crew-Internal"] = internal;
    }
  }
  return headers;
}
