@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js, then run this launcher again.
  pause
  exit /b 1
)
node server.mjs --open
pause
