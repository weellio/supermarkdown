@echo off
rem Removes Super Markdown for this Windows user.
if exist "%LOCALAPPDATA%\Programs\SuperMarkdown\uninstall.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\Programs\SuperMarkdown\uninstall.ps1" -Quiet
) else (
  echo Super Markdown is not installed.
)
echo.
pause
