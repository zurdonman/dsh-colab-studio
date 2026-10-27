@echo off
setlocal
chcp 65001 >nul 2>&1

rem ============================================================
rem  DSH Colab Studio - INICIAR-PANEL-SH.bat
rem  Doble clic: arranca el panel usando el script .sh de verdad
rem  (terminal Linux: WSL o Git Bash). Para ver la salida en el
rem  terminal en lugar de en segundo plano.
rem ============================================================

set "DIR=%~dp0app"
if not exist "%DIR%\server.mjs" set "DIR=%~dp0"
set "DIRF=%DIR:\=/%"

echo.
echo   Iniciando el panel con panel.sh (terminal Linux)...

where wsl.exe >nul 2>&1
if errorlevel 1 goto try_git
set "WSLDIR="
for /f "delims=" %%p in ('wsl.exe wslpath -a "%DIR%" 2^>nul') do set "WSLDIR=%%p"
if not defined WSLDIR set "WSLDIR=%DIR:\=/%"
wsl.exe --cd "%WSLDIR%" bash -lc "bash panel.sh start"
goto fin

:try_git
set "GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GITBASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined GITBASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined GITBASH goto fallback
"%GITBASH%" -c "cd '%DIRF%'; bash panel.sh start"
goto fin

:fallback
echo   No hay WSL ni Git Bash: uso el lanzador nativo de Windows.
call "%DIR%\panel.cmd" start

:fin
echo.
echo   Panel: http://127.0.0.1:8787
echo.
pause
