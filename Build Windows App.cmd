@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this again.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 goto failed
call npm run build:win
if errorlevel 1 goto failed
echo.
echo Portable EXE created in the dist folder.
pause
exit /b 0
:failed
echo.
echo Build failed. See the error above.
pause
exit /b 1
