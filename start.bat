@echo off
rem Hyderabad, above the clouds - double-click to play
cd /d "%~dp0"
start "" http://localhost:8791
node serve.mjs 8791
