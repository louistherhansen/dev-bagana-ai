# Test manual chat CrewAI dengan topic Aqua (Product Launch)
# Pastikan: 1) .env berisi OPENROUTER_API_KEY=sk-or-v1-...  2) npm run dev jalan di http://127.0.0.1:3000
# Jalankan dari root project: .\scripts\test-chat-aqua.ps1

$ErrorActionPreference = "Continue"
$base = if ($PSScriptRoot) { Join-Path $PSScriptRoot ".." } else { ".." }
Set-Location $base

$topic = @"
Brand Information:
- Brand Name: aqua
- Company Type: drink
- Website: aqua.com

Product Information:
- Product Type: Drink

Campaign Context:
- Campaign Type: Product Launch

Please create a comprehensive content plan based on the above brand and campaign information.
"@

Write-Host "=== Test Chat CrewAI (topic: Aqua Product Launch) ===" -ForegroundColor Cyan
Write-Host ""

# Cek .env
if (-not (Test-Path ".env")) {
  Write-Host "[X] File .env tidak ada. Copy: cp .env.example .env lalu isi OPENROUTER_API_KEY=sk-or-v1-..." -ForegroundColor Red
  exit 1
}
$envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if ($envContent -notmatch 'OPENROUTER_API_KEY\s*=\s*sk-or-v1-[^\s#]+') {
  Write-Host "[!] OPENROUTER_API_KEY di .env belum diisi atau masih placeholder. Isi key dari https://openrouter.ai/settings/keys" -ForegroundColor Yellow
}

Write-Host "[1] Validasi API key (GET .../api/crew?validate=1)..." -ForegroundColor Yellow
try {
  $check = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/crew?validate=1" -Method GET -TimeoutSec 10
  if ($check.valid) {
    Write-Host "    [OK] Key valid. $($check.message)" -ForegroundColor Green
  } else {
    Write-Host "    [X] Key invalid: $($check.error)" -ForegroundColor Red
    exit 1
  }
} catch {
  Write-Host "    [i] Frontend tidak jalan atau timeout. Jalankan: npm run dev" -ForegroundColor Gray
  Write-Host "    $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2] POST /api/crew dengan topic Aqua (timeout 5 menit)..." -ForegroundColor Yellow
$body = @{
  message = $topic.Trim()
  user_input = $topic.Trim()
  language = "en"
} | ConvertTo-Json -Depth 2

try {
  $response = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/crew" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
  if ($response.status -eq "complete") {
    $outLen = if ($response.output) { $response.output.Length } else { 0 }
    $taskCount = if ($response.task_outputs) { $response.task_outputs.Count } else { 0 }
    Write-Host "    [OK] status=complete, output length=$outLen, task_outputs=$taskCount" -ForegroundColor Green
    if ($response.output -and $response.output.Length -gt 0) {
      Write-Host ""
      Write-Host "--- Output (potongan) ---" -ForegroundColor Cyan
      $preview = $response.output.Substring(0, [Math]::Min(800, $response.output.Length))
      if ($response.output.Length -gt 800) { $preview += "..." }
      Write-Host $preview -ForegroundColor Gray
    }
  } elseif ($response.status -eq "error") {
    Write-Host "    [X] Error: $($response.error)" -ForegroundColor Red
  } else {
    Write-Host "    [?] status=$($response.status)" -ForegroundColor Yellow
  }
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  $errBody = ""
  try { $errBody = $_.ErrorDetails.Message } catch {}
  Write-Host "    [X] Request gagal (HTTP $statusCode): $errBody" -ForegroundColor Red
  Write-Host "    $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Test di browser: http://127.0.0.1:3000/chat lalu paste topic yang sama." -ForegroundColor Cyan
Write-Host "Log: project-context/2.build/logs/trace.log" -ForegroundColor Cyan
