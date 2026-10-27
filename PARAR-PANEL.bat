@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

rem ============================================================
rem  DSH Colab Studio - PARAR-PANEL.bat
rem  Doble clic: para el panel local.
rem  (No toca las sesiones de Google Colab: solo el panel.)
rem ============================================================

set "APP=%~dp0app"
if not exist "%APP%\panel.cmd" set "APP=%~dp0"
if not exist "%APP%\panel.cmd" (
  echo.
  echo   No encuentro panel.cmd.
  echo.
  pause
  exit /b 1
)

echo.
echo   Parando DSH Colab Studio...
call "%APP%\panel.cmd" stop
echo.
pause
