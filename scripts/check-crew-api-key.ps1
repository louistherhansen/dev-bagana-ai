# Cek apakah API key Crew/OpenRouter sudah siap (untuk Chat)
# Jalankan dari folder root project.

Write-Host "=== Cek Crew / Chat API Key ===" -ForegroundColor Cyan
Write-Host ""

# 1. .env
$envFile = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw
  $hasOr = $content -match 'OPENROUTER_API_KEY\s*=\s*sk-or-v1-[^\s#]+'
  $hasOa = $content -match 'OPENAI_API_KEY\s*=\s*sk-[^\s#]+'
  if ($hasOr -or $hasOa) {
    Write-Host "[OK] .env ada dan berisi OPENROUTER_API_KEY atau OPENAI_API_KEY" -ForegroundColor Green
  } else {
    Write-Host "[X] .env ada tapi OPENROUTER_API_KEY/OPENAI_API_KEY belum diisi (sk-or-v1-... atau sk-...)" -ForegroundColor Red
    Write-Host "    Isi di .env lalu restart backend / npm run dev" -ForegroundColor Yellow
  }
} else {
  Write-Host "[X] File .env tidak ditemukan di root project" -ForegroundColor Red
  Write-Host "    Copy .env.example ke .env, isi OPENROUTER_API_KEY=sk-or-v1-..." -ForegroundColor Yellow
}

# 2. Backend health (jika backend jalan)
Write-Host ""
try {
  $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 3
  if ($health.has_crew_api_key -eq $true) {
    Write-Host "[OK] Backend (port 8000) punya API key (has_crew_api_key: true)" -ForegroundColor Green
  } else {
    Write-Host "[X] Backend jalan tapi has_crew_api_key: false" -ForegroundColor Red
    Write-Host "    Tambahkan OPENROUTER_API_KEY di .env lalu: docker compose up -d --build backend" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[i] Backend tidak merespons di localhost:8000 (normal jika belum jalankan backend)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Jika pakai Docker: docker compose up -d --build backend" -ForegroundColor Cyan
Write-Host "Lalu buka http://127.0.0.1:3000/chat dan coba lagi." -ForegroundColor Cyan
