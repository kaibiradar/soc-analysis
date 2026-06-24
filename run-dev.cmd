@echo off
setlocal
cd /d "%~dp0"

start "SOC Backend" cmd /k "%~dp0run-backend.cmd"
start "SOC Frontend" cmd /k "%~dp0run-frontend.cmd"

echo Backend:  http://127.0.0.1:5000
echo Frontend: http://127.0.0.1:5173
