@echo off
setlocal
chcp 65001 >nul 2>&1

rem ============================================================
rem  DSH Colab Studio - EJECUTAR-SH.bat
rem  Ejecuta un script .sh en la terminal Linux (WSL o Git Bash).
rem
rem    - Doble clic aqui y arrastra un .sh encima
rem    - O: EJECUTAR-SH.bat script.sh [args...]
rem    - Sin argumentos: abre la terminal Linux en esta carpeta
rem ============================================================

set "DIR=%~dp0app"
if not exist "%DIR%\server.mjs" set "DIR=%~dp0"
set "DIRF=%DIR:\=/%"

if "%~1"=="" goto sin_args

rem --- con script ---
where wsl.exe >nul 2>&1
if errorlevel 1 goto try_git_script
set "WSLSCRIPT="
for /f "delims=" %%p in ('wsl.exe wslpath -a "%~1" 2^>nul') do set "WSLSCRIPT=%%p"
if not defined WSLSCRIPT set "WSLSCRIPT=%~f1"
echo   Ejecutando en WSL: %WSLSCRIPT%
wsl.exe --cd "%DIRF%" bash "%WSLSCRIPT%"
goto fin

:try_git_script
set "GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GITBASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined GITBASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined GITBASH goto sin_bash
echo   Ejecutando en Git Bash: %~f1
"%GITBASH%" -c "cd '%DIRF%'; bash '%~f1'"
goto fin

:sin_bash
echo   No hay WSL ni Git Bash: no puedo ejecutar .sh
echo   Instala Git for Windows o ejecuta: wsl --install
goto fin

rem --- sin argumentos: terminal abierta en la carpeta ---
:sin_args
echo.
echo   Abriendo terminal Linux en:
echo     %DIR%
echo   (arrastra un .sh aqui para ejecutarlo, o escribe: bash panel.sh start)
echo.
where wsl.exe >nul 2>&1
if errorlevel 1 goto try_git
set "WSLDIR="
for /f "delims=" %%p in ('wsl.exe wslpath -a "%DIR%" 2^>nul') do set "WSLDIR=%%p"
if not defined WSLDIR set "WSLDIR=%DIR:\=/%"
start "DSH Colab - Terminal Linux (WSL)" wsl.exe --cd "%WSLDIR%" bash --login
goto fin

:try_git
set "GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GITBASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined GITBASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined GITBASH goto fallback
start "DSH Colab - Terminal Linux (Git Bash)" "%GITBASH%" -c "cd '%DIRF%'; exec bash --login -i"
goto fin

:fallback
powershell -NoProfile -NoExit -Command "Set-Location -LiteralPath '%DIR%'"

:fin
echo.
pause
