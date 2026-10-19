[CmdletBinding()]
param([switch]$SkipFrontend)
$ErrorActionPreference = 'Continue'
$root    = (Get-Location).Path
$backend = Join-Path $root 'backend'
$tmp     = Join-Path $env:TEMP 'caff_cfg_test'
New-Item $tmp -ItemType Directory -Force | Out-Null
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = '') {
    $tag = if ($ok) { 'PASS' } else { 'FAIL' }
    $color = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("[{0}] {1}" -f $tag, $name) -ForegroundColor $color
    if (-not $ok -and $detail) { Write-Host ("       " + $detail.Trim()) -ForegroundColor DarkGray }
    $results.Add("$tag $name")
}

function Reset-Env {
    foreach ($k in 'ENV','SECRET_KEY','CORS_ORIGINS','PUBLIC_SITE_URL','COMPANY_APP_URL','API_PUBLIC_URL','DATABASE_URL','PYTHONPATH') {
        Remove-Item "Env:$k" -ErrorAction SilentlyContinue
    }
}

# Import configu z pustego katalogu (bez .env), kod backendu przez PYTHONPATH
function Run-Config([hashtable]$vars) {
    Reset-Env
    foreach ($k in $vars.Keys) { Set-Item "Env:$k" $vars[$k] }
    $env:PYTHONPATH = $backend
    Push-Location $tmp
    $out = & python -c "from app.core.config import settings; print('CONFIG_OK', settings.ENV)" 2>&1 | Out-String
    $code = $LASTEXITCODE
    Pop-Location
    Reset-Env
    [pscustomobject]@{ Code = $code; Out = $out }
}

$goodUrls = @{
    CORS_ORIGINS    = 'https://example.com'
    PUBLIC_SITE_URL = 'https://example.com'
    COMPANY_APP_URL = 'https://panel.example.com'
    API_PUBLIC_URL  = 'https://api.example.com'
}
$key = (& python -c "import secrets; print(secrets.token_hex(32))").Trim()

Write-Host "`n=== 1. Backend: konfiguracja ===" -ForegroundColor Cyan

$r = Run-Config (@{ ENV = 'production' } + $goodUrls)
Check 'production bez SECRET_KEY -> odmowa startu' ($r.Code -ne 0 -and $r.Out -match 'SECRET_KEY jest wymagany') $r.Out

$r = Run-Config @{ ENV = 'production'; SECRET_KEY = $key }
Check 'production z kluczem, ale adresy localhost -> odmowa' ($r.Code -ne 0 -and $r.Out -match 'localhost') $r.Out

$r = Run-Config (@{ ENV = 'production'; SECRET_KEY = 'zmien-to-na-dlugi-losowy-string-xxxxxxxxxxxxxxxx' } + $goodUrls)
Check 'production ze slabym kluczem -> odmowa' ($r.Code -ne 0 -and $r.Out -match 'SECRET_KEY') $r.Out

$r = Run-Config (@{ ENV = 'production'; SECRET_KEY = $key } + $goodUrls)
Check 'production poprawna konfiguracja -> OK' ($r.Code -eq 0 -and $r.Out -match 'CONFIG_OK production') $r.Out

$r = Run-Config @{ ENV = 'development' }
Check 'development bez klucza -> OK (losowy klucz + ostrzezenie)' ($r.Code -eq 0 -and $r.Out -match 'CONFIG_OK development') $r.Out

Write-Host "`n=== 2. Backend: CORS w production (wolny port) ===" -ForegroundColor Cyan

$l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$l.Start(); $port = $l.LocalEndpoint.Port; $l.Stop()

Reset-Env
$env:ENV = 'production'; $env:SECRET_KEY = $key
foreach ($k in $goodUrls.Keys) { Set-Item "Env:$k" $goodUrls[$k] }
$errLog = Join-Path $tmp 'uvicorn.err.log'; $outLog = Join-Path $tmp 'uvicorn.out.log'
$proc = Start-Process python -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port',$port `
    -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
    -RedirectStandardError $errLog -RedirectStandardOutput $outLog
Reset-Env

try {
    $up = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        if ($proc.HasExited) { break }
        $code = (& curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:$port/")
        if ($code -eq '200') { $up = $true; break }
    }
    Check "serwer production wstal na porcie $port" $up ((Get-Content $errLog -ErrorAction SilentlyContinue) -join "`n")

    if ($up) {
        $u = "http://127.0.0.1:$port/auth/login"
        $bad  = & curl.exe -s -i -X OPTIONS $u -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" | Out-String
        $good = & curl.exe -s -i -X OPTIONS $u -H "Origin: https://example.com"   -H "Access-Control-Request-Method: POST" | Out-String
        Check 'origin localhost:5173 jest odrzucony (400, brak allow-origin)' (($bad -match '400') -and ($bad -notmatch 'access-control-allow-origin')) $bad
        Check 'origin https://example.com jest dozwolony' (($good -match '200') -and ($good -match 'access-control-allow-origin: https://example.com')) $good
    }
}
finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}

if (-not $SkipFrontend) {
    Write-Host "`n=== 3. Frontendy: build + brak localhost w bundlu ===" -ForegroundColor Cyan
    foreach ($p in 'caffenacci.company', 'caffenacci.customer') {
        $dir = Join-Path $root $p
        Push-Location $dir
        if (-not (Test-Path 'node_modules')) { Write-Host "  npm install w $p ..."; & npm.cmd install | Out-Null }
        $env:VITE_API_URL = 'https://api.example.com'
        $env:VITE_COMPANY_URL = 'https://panel.example.com'
        $env:VITE_CUSTOMER_URL = 'https://example.com'
        if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }
        $buildOut = & npm.cmd run build 2>&1 | Out-String
        $buildCode = $LASTEXITCODE
        Check "$p : npm run build (tsc + vite)" ($buildCode -eq 0) (($buildOut -split "`n" | Select-Object -Last 25) -join "`n")

        if ($buildCode -eq 0) {
            $js = Get-ChildItem 'dist' -Recurse -Filter *.js -File
            $text = ($js | ForEach-Object { [IO.File]::ReadAllText($_.FullName) }) -join "`n"
            Check "$p : bundle zawiera adres API z VITE_API_URL" ($text -match 'api\.example\.com')
            $n = ([regex]::Matches($text, 'localhost:8000')).Count
            # dopuszczalne max 1: dev-fallback przekazany do read() w config.ts
            Check "$p : 'localhost:8000' w bundlu <= 1 (tylko fallback z config.ts)" ($n -le 1) "znaleziono $n wystapien"
        }
        Remove-Item Env:VITE_API_URL, Env:VITE_COMPANY_URL, Env:VITE_CUSTOMER_URL -ErrorAction SilentlyContinue
        Pop-Location
    }
}

Write-Host "`n=== PODSUMOWANIE ===" -ForegroundColor Cyan
$fails = @($results | Where-Object { $_ -like 'FAIL*' })
$results | ForEach-Object { Write-Host "  $_" }
if ($fails.Count -eq 0) { Write-Host "`nWSZYSTKO OK - etap 1 zamkniety." -ForegroundColor Green }
else { Write-Host "`nBledy: $($fails.Count). Wklej mi ten wydruk." -ForegroundColor Red }