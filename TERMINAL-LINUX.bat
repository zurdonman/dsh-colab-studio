@echo off
setlocal
chcp 65001 >nul 2>&1

rem ============================================================
rem  DSH Colab Studio - TERMINAL-LINUX.bat
rem  Doble clic: abre una terminal Linux en la carpeta del panel.
rem  Prioridad: WSL (Linux real) > Git Bash > PowerShell.
rem ============================================================

set "DIR=%~dp0app"
if not exist "%DIR%\server.mjs" set "DIR=%~dp0"
set "DIRF=%DIR:\=/%"

echo.
echo   Buscando una terminal Linux...

rem --- 1) WSL: Linux de verdad ---
where wsl.exe >nul 2>&1
if errorlevel 1 goto try_git
set "WSLDIR="
for /f "delims=" %%p in ('wsl.exe wslpath -a "%DIR%" 2^>nul') do set "WSLDIR=%%p"
if not defined WSLDIR set "WSLDIR=%DIR:\=/%"
echo     WSL: %WSLDIR%
start "DSH Colab - Terminal Linux (WSL)" wsl.exe --cd "%WSLDIR%" bash --login
exit /b 0

rem --- 2) Git Bash ---
:try_git
set "GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GITBASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined GITBASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined GITBASH goto fallback
echo     Git Bash: %GITBASH%
start "DSH Colab - Terminal Linux (Git Bash)" "%GITBASH%" -c "cd '%DIRF%'; exec bash --login -i"
exit /b 0

rem --- 3) Sin terminal Linux: PowerShell ---
:fallback
echo     No hay WSL ni Git Bash: abro PowerShell en esta carpeta.
echo     (instala Git for Windows o ejecuta: wsl --install)
powershell -NoProfile -NoExit -Command "Set-Location -LiteralPath '%DIR%'"
