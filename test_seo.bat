@echo off
setlocal
REM Uzycie: test_seo.bat TWOJ-SLUG
set "ROOT=%~dp0"
set "DIST=%ROOT%caffenacci.customer\dist"
set "SLUG=%~1"

echo [1/3] Build klienta...
set "VITE_API_URL=http://localhost:8000"
set "VITE_COMPANY_URL=http://localhost:5173"
set "VITE_CUSTOMER_URL=http://localhost:5174"
set "VITE_COMPANY_URL=http://localhost:5173"

pushd "%ROOT%caffenacci.customer"
call npm run build
if errorlevel 1 (
  echo BLAD: build nie powiodl sie.
  popd
  pause
  exit /b 1
)
popd

findstr /C:"SEO_HEAD" /C:"SEO_BODY" "%DIST%\index.html" >nul
if errorlevel 1 echo UWAGA: w dist\index.html brak znacznikow SEO - Vite je wyciol!

echo [2/3] Start backendu na :8000...
REM zmienne nadpisuja backend\.env i sa dziedziczone przez nowe okno
set "ENV=development"
set "CUSTOMER_DIST_DIR=%DIST%"
set "PUBLIC_SITE_URL=http://localhost:8000"

REM opcjonalny venv
if exist "%ROOT%backend\venv\Scripts\activate.bat"  call "%ROOT%backend\venv\Scripts\activate.bat"
if exist "%ROOT%backend\.venv\Scripts\activate.bat" call "%ROOT%backend\.venv\Scripts\activate.bat"

start "Caffenacci backend :8000" /D "%ROOT%backend" cmd /k uvicorn main:app --port 8000

echo [3/3] Czekam na start...
timeout /t 5 /nobreak >nul

echo.
echo ===== robots.txt =====
curl.exe -s http://localhost:8000/robots.txt
echo.
echo ===== sitemap.xml =====
curl.exe -s http://localhost:8000/sitemap.xml
echo.

if "%SLUG%"=="" (
  echo Podaj slug, aby przetestowac strone kawiarni: test_seo.bat moj-slug
  goto :end
)

echo ===== HTML dla robotow =====
curl.exe -s http://localhost:8000/kawiarnia/%SLUG% | findstr /C:"<title>" /C:"ld+json" /C:"<h1" /C:"canonical" /C:"__SITE_DATA__"
echo.
echo ===== Naglowki (szukaj ETag i Cache-Control) =====
curl.exe -s -D - -o NUL http://localhost:8000/kawiarnia/%SLUG%
echo ===== Kod dla nieistniejacej (oczekiwane 404) =====
curl.exe -s -o NUL -w "%%{http_code}\n" http://localhost:8000/kawiarnia/nie-istnieje
echo ===== Redirect /cafe/ (oczekiwane 301) =====
curl.exe -s -o NUL -w "%%{http_code} %%{redirect_url}\n" http://localhost:8000/cafe/%SLUG%

start "" http://localhost:8000/kawiarnia/%SLUG%

:end
echo.
echo Backend dziala w osobnym oknie. Zamknij je, aby zatrzymac.
pause