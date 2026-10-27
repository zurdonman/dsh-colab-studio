@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

rem ============================================================
rem  DSH Colab Studio - INICIAR-PANEL.bat
rem  Doble clic: arranca el panel y abre el navegador.
rem ============================================================

set "APP=%~dp0app"
if not exist "%APP%\panel.cmd" set "APP=%~dp0"
if not exist "%APP%\panel.cmd" (
  echo.
  echo   No encuentro panel.cmd.
  echo   Ejecuta primero INSTALAR.bat
  echo.
  pause
  exit /b 1
)

echo.
echo   Iniciando DSH Colab Studio...
call "%APP%\panel.cmd" start
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8787"
echo.
echo   Panel: http://127.0.0.1:8787
echo   Para pararlo: PARAR-PANEL.bat
echo.
pause
