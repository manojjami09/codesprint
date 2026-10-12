@echo off
cd /d "%~dp0"
echo Starting CODE SPRINT...
if not exist node_modules (
  echo Installing dependencies (first run)...
  call npm install
)
call npm start
pause