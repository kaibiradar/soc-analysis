@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating local Python virtual environment...
  py -3 -m venv .venv || exit /b 1
)

echo Installing backend dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt || exit /b 1

echo Starting Flask backend on http://127.0.0.1:5000
".venv\Scripts\python.exe" scripts\serve_backend.py
