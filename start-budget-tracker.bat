@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  goto :failed
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm included, then try again.
  goto :failed
)

if not exist "backend\.env" (
  echo Missing database environment configuration.
  echo Copy backend\.env.example to backend\.env and set DATABASE_URL to your local PostgreSQL connection.
  goto :failed
)

if not exist "node_modules" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

set "PORT=5000"
set "CORS_ORIGIN=http://localhost:3000"
set "NEXT_PUBLIC_API_URL=http://localhost:5000/api"

echo Starting Budget Tracker...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo Keep this window open. Press Ctrl+C to stop both services.
call npm run dev
goto :end

:failed
echo.
pause

:end
endlocal
