@echo off
rem Installs Super Markdown for this Windows user. No admin rights needed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0files\install.ps1"
echo.
pause
