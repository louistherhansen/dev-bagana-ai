/**
 * Load .env from monorepo root and/or frontend when `npm run dev` runs from workspace root.
 * Ensures DB_* and other secrets in frontend/.env are visible to process.env.
 */
import fs from "fs";
import path from "path";
import { config } from "dotenv";

let didLoad = false;

function findProjectRoots() {
  let dir = process.cwd();
  let last = "";

  while (dir !== last) {
    const monorepoMarker = path.join(dir, "frontend", "next.config.mjs");
    const frontendMarker = path.join(dir, "next.config.mjs");

    if (fs.existsSync(monorepoMarker)) {
      return { monorepoRoot: dir, frontendDir: path.join(dir, "frontend") };
    }
    if (fs.existsSync(frontendMarker)) {
      return { monorepoRoot: path.resolve(dir, ".."), frontendDir: dir };
    }

    last = dir;
    dir = path.resolve(dir, "..");
  }

  // Fallback: best effort with current working directory
  return { monorepoRoot: process.cwd(), frontendDir: path.join(process.cwd(), "frontend") };
}

export function loadProjectEnv(): void {
  if (didLoad) return;
  didLoad = true;

  const { monorepoRoot, frontendDir } = findProjectRoots();

  const roots = [monorepoRoot, frontendDir];
  const names = [".env", ".env.local"] as const;

  for (const root of roots) {
    for (const name of names) {
      const filePath = path.join(root, name);
      if (fs.existsSync(filePath)) {
        // Only .env.local should override already-set env vars
        config({ path: filePath, override: name.endsWith(".local") });
      }
    }
  }
}
