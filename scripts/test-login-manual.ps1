# Manual login test: GET /login page dan POST /api/auth/login
# Jalankan dari folder proyek (root) saat frontend sudah jalan (npm run dev atau Docker).

param(
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [string]$Email = "admin@bagana.ai",
    [string]$Password = "123456"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BAGANA AI - Tes Login Manual" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# 1. Tes halaman login
Write-Host "[1] GET $BaseUrl/login ..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/login" -UseBasicParsing -TimeoutSec 10
    Write-Host "     Status: $($r.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "     Gagal: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Tes API login
Write-Host "[2] POST $BaseUrl/api/auth/login (email=$Email, password=***) ..." -ForegroundColor Yellow
$body = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "     Login berhasil." -ForegroundColor Green
    Write-Host "     User: $($resp.user.email) | Role: $($resp.user.role)" -ForegroundColor Gray
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "Invalid email or password" }
    Write-Host "     Gagal: HTTP $code - $msg" -ForegroundColor Red
    Write-Host ""
    Write-Host "Jika user admin belum ada, buat dulu (pakai nilai DB dari .env):" -ForegroundColor Yellow
    Write-Host "  Set env: DB_HOST=127.0.0.1 DB_NAME=bagana_ai DB_USER=bagana_user DB_PASSWORD=<isi DB_PASSWORD dari .env>" -ForegroundColor Gray
    Write-Host "  Lalu: python scripts/create-admin-user.py" -ForegroundColor Gray
    Write-Host "  Password login admin nanti: 123456" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Semua tes login manual OK." -ForegroundColor Green
