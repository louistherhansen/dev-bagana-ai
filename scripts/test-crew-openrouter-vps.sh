#!/usr/bin/env bash
# Manual smoke test: CrewAI + OpenRouter inside backend container (VPS / Docker Compose).
# Usage (repo root): bash scripts/test-crew-openrouter-vps.sh
set -euo pipefail
cd "$(dirname "$0")/.."

JSON='{"user_input":"Short test: reply with one line starting with CREW_OK","language":"id"}'
echo "$JSON" | docker compose exec -T backend python -m crew.run --stdin
