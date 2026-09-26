@echo off
cd /d "%~dp0"
start "MOTORLOZ" "http://127.0.0.1:4173/"
node server.cjs
pause
