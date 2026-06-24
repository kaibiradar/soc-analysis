@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules" (
  echo Installing frontend dependencies...
  call npm.cmd install || exit /b 1
)

echo Starting Vite frontend on http://127.0.0.1:5173
call npm.cmd run dev -- --host 127.0.0.1
