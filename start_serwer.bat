@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "CUSTOMER=%ROOT%caffenacci.customer"
set "COMPANY=%ROOT%caffenacci.company"

if not exist "%BACKEND%\.env" goto missing_env
if not exist "%CUSTOMER%\node_modules" goto missing_customer_deps
if not exist "%COMPANY%\node_modules" goto missing_company_deps
where docker >nul 2>&1
if errorlevel 1 goto missing_docker
where alembic >nul 2>&1
if errorlevel 1 goto missing_python_commands
where uvicorn >nul 2>&1
if errorlevel 1 goto missing_python_commands
where npm >nul 2>&1
if errorlevel 1 goto missing_npm

pushd "%BACKEND%"
echo Starting PostgreSQL...
docker compose -f docker-compose.dev.yml up -d
if errorlevel 1 goto docker_failed

set /a attempts=0
:wait_database
docker exec caffenacci-postgres-dev pg_isready -U caffenacci -d caffenacci >nul 2>&1
if not errorlevel 1 goto database_ready
set /a attempts+=1
if %attempts% geq 30 goto database_timeout
timeout /t 2 /nobreak >nul
goto wait_database

:database_ready
echo Applying Alembic migrations...
alembic upgrade head
if errorlevel 1 goto migration_failed
popd

start "Caffenacci API" cmd /k "cd /d ""%BACKEND%"" && uvicorn main:app --reload --port 8000"
start "Caffenacci Customer" cmd /k "cd /d ""%CUSTOMER%"" && npm run dev -- --host localhost --port 5174 --strictPort"
start "Caffenacci Business" cmd /k "cd /d ""%COMPANY%"" && npm run dev -- --host localhost --port 5173 --strictPort"

echo.
echo API:      http://localhost:8000/docs
echo Customer: http://localhost:5174
echo Business: http://localhost:5173
start "" "http://localhost:5174"
start "" "http://localhost:5173"
exit /b 0

:docker_failed
popd
echo ERROR: Docker/PostgreSQL failed to start. Check that Docker Desktop is running.
goto startup_error

:database_timeout
popd
echo ERROR: PostgreSQL did not become ready within 60 seconds.
goto startup_error

:migration_failed
popd
echo ERROR: alembic upgrade head failed. Check the backend terminal output.
goto startup_error

:missing_env
echo ERROR: Missing backend\.env. Create it from backend\.env.example first.
goto startup_error

:missing_customer_deps
echo ERROR: Customer dependencies are missing. Run npm install in caffenacci.customer.
goto startup_error

:missing_company_deps
echo ERROR: Business dependencies are missing. Run npm install in caffenacci.company.
goto startup_error

:missing_docker
echo ERROR: Docker CLI was not found. Install/start Docker Desktop.
goto startup_error

:missing_python_commands
echo ERROR: alembic or uvicorn was not found on PATH.
goto startup_error

:missing_npm
echo ERROR: npm was not found on PATH.
goto startup_error

:startup_error
pause
exit /b 1
