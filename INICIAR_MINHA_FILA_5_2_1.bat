@echo off
setlocal
cd /d "%~dp0"
echo.
echo ============================================
echo   VitalCare Minha Fila 5.2.1.2
echo ============================================
echo.
echo Abrindo em http://localhost:8014/login.html
start "" http://localhost:8014/login.html
py -m http.server 8014
if errorlevel 1 python -m http.server 8014
pause
