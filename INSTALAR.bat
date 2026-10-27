@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

rem ============================================================
rem  DSH Colab Studio - INSTALAR.bat
rem  Doble clic: instala panel + skill + puente MCP en tu DSH.
rem ============================================================

set "PS1=%~dp0install.ps1"
if not exist "%PS1%" set "PS1=%~dp0..\install.ps1"
if not exist "%PS1%" (
  echo.
  echo   No encuentro install.ps1
  echo.
  pause
  exit /b 1
)

echo.
echo   Instalando DSH Colab Studio...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
echo.
pause
