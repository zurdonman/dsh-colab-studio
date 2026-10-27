@echo off
REM ============================================================
REM  DSH Colab Studio — panel.cmd (Windows)
REM    panel.cmd start | stop | restart | status
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0panel.ps1" %*
