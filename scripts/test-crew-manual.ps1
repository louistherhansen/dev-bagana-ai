# Test Crew AI manual: jalankan crew via Python lalu tes API
# Jalankan dari folder root project (parent dari scripts).

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "=== Test Crew AI Manual ===" -ForegroundColor Cyan
Write-Host ""

# 1. Test Python crew langsung (harus ada OPENROUTER_API_KEY di .env)
Write-Host "[1] Menjalankan: echo {\"message\":\"Buat satu kalimat ide konten.\"} | python -m crew.run --stdin" -ForegroundColor Yellow
$payload = '{"message":"Buat satu kalimat ide konten."}'
$stdout = $payload | python -m crew.run --stdin 2>&1 | Out-String
$idx = $stdout.IndexOf('{"status"')
if ($idx -ge 0) {
  $block = $stdout.Substring($idx)
  try {
    $obj = $block | ConvertFrom-Json
    if ($obj.status -eq "complete" -and ($obj.output -or ($obj.task_outputs -and $obj.task_outputs.Count -gt 0))) {
      Write-Host "    [OK] Crew Python: status=$($obj.status), output length=$($obj.output.Length)" -ForegroundColor Green
      Write-Host "    Output (potongan): $($obj.output.Substring(0, [Math]::Min(120, $obj.output.Length)))..." -ForegroundColor Gray
    } elseif ($obj.status -eq "error") {
      Write-Host "    [X] Crew Python error: $($obj.error)" -ForegroundColor Red
    } else {
      Write-Host "    [?] Crew Python: status=$($obj.status), output kosong?" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "    [?] Tidak bisa parse JSON. Potongan: $($stdout.Substring(0, [Math]::Min(300, $stdout.Length)))" -ForegroundColor Yellow
  }
} else {
  Write-Host "    [X] Tidak ada JSON di stdout. Pastikan .env berisi OPENROUTER_API_KEY=sk-or-v1-..." -ForegroundColor Red
  $preview = if ($stdout.Length -gt 400) { $stdout.Substring(0, 400) + "..." } else { $stdout }
  Write-Host "    Output: $preview" -ForegroundColor Gray
}

Write-Host ""

# 2. Test API (jika frontend/backend jalan)
Write-Host "[2] POST http://127.0.0.1:3000/api/crew (perlu frontend + backend atau npm run dev)" -ForegroundColor Yellow
try {
  $body = '{"message":"Buat satu kalimat ide konten."}'
  $r = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/crew" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
  if ($r.status -eq "complete" -and ($r.output -or ($r.task_outputs -and $r.task_outputs.Count -gt 0))) {
    Write-Host "    [OK] API: status=complete, output ada" -ForegroundColor Green
  } elseif ($r.status -eq "complete") {
    Write-Host "    [X] API mengembalikan complete tapi output kosong. Backend (Docker) mungkin tidak punya OPENROUTER_API_KEY." -ForegroundColor Red
    Write-Host "    Solusi: isi .env lalu docker compose up -d --build backend" -ForegroundColor Yellow
  } elseif ($r.status -eq "error") {
    Write-Host "    [X] API error: $($r.error)" -ForegroundColor Red
  } else {
    Write-Host "    [?] API: status=$($r.status)" -ForegroundColor Yellow
  }
} catch {
  if ($_.Exception.Response -and $_.ErrorDetails.Message) {
    try {
      $errBody = $_.ErrorDetails.Message | ConvertFrom-Json
      if ($errBody.error) { Write-Host "    [X] API error: $($errBody.error)" -ForegroundColor Red; exit 0 }
    } catch {}
  }
  Write-Host "    [i] API tidak merespons atau error. $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Jika [1] OK tapi Chat di browser tetap kosong: pakai backend Docker maka backend harus punya OPENROUTER_API_KEY." -ForegroundColor Cyan
Write-Host "  Cek: http://localhost:8000/health  harus has_crew_api_key: true" -ForegroundColor Cyan
Write-Host "  Atau jalankan frontend + crew lokal: set USE_BACKEND_API=false di .env lalu npm run dev" -ForegroundColor Cyan
