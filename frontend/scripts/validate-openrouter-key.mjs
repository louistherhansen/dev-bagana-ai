/**
 * Test OpenRouter API key manually (baca dari .env).
 * Jalankan: node scripts/validate-openrouter-key.mjs
 * Dari folder root project (yang ada package.json dan .env).
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const monorepoRoot = join(frontendRoot, "..");

function findEnvPath() {
  const candidates = [
    join(monorepoRoot, ".env.local"),
    join(monorepoRoot, ".env"),
    join(frontendRoot, ".env.local"),
    join(frontendRoot, ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return join(monorepoRoot, ".env");
}

/** Bersihkan key seperti backend: hapus semua spasi/newline/kutip (sering bikin 401). */
function cleanKey(val) {
  if (!val || typeof val !== "string") return "";
  return val.replace(/\s/g, "").replace(/^["']|["']$/g, "").trim();
}

function extractKeyFromContent(content) {
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)$/);
    if (m) {
      const val = cleanKey(m[1].split("#")[0]);
      if (val && val !== "your-openrouter-api-key-here" && !val.startsWith("sk-or-v1-xxx")) return val;
    }
  }
  const m2 = content.match(/OPENAI_API_KEY\s*=\s*([^\n#]+)/m);
  if (m2) {
    const val = cleanKey(m2[1]);
    if (val && !val.startsWith("your-") && val.length > 20) return val;
  }
  return null;
}

function loadKey() {
  const candidates = [
    join(monorepoRoot, ".env.local"),
    join(monorepoRoot, ".env"),
    join(frontendRoot, ".env.local"),
    join(frontendRoot, ".env"),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf-8").replace(/\r\n/g, "\n");
    const key = extractKeyFromContent(content);
    if (key) return key;
  }
  console.error("OPENROUTER_API_KEY is not set in .env or is still a placeholder (check repo root and frontend/).");
  process.exit(1);
}

async function main() {
  let key = loadKey();
  key = cleanKey(key);
  if (!key || key.length < 25) {
    console.error("Key is too short or empty after cleaning. Ensure .env contains OPENROUTER_API_KEY=sk-or-v1-... (full value, no extra quotes/spaces).");
    process.exit(1);
  }
  console.log("Validating API key with OpenRouter...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) {
      console.error("❌ Key rejected (401). Steps:");
      console.error("   1. Open https://openrouter.ai/settings/keys → Create Key (or use an active key)");
      console.error("   2. Copy the full key (sk-or-v1-...). In .env add a single line: OPENROUTER_API_KEY=sk-or-v1-... (no quotes/spaces)");
      console.error("   3. Save .env, then run again: npm run validate-key");
      console.error("   4. If OK, restart: npm run dev");
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`❌ OpenRouter returned ${res.status}`);
      process.exit(1);
    }
    console.log("✅ API key is valid. OpenRouter is ready.");
  } catch (e) {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  }
}

main();
