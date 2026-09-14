@echo off
setlocal
cd /d "%~dp0"
echo.
echo ============================================
echo   VitalCare Minha Fila 5.1.3
echo ============================================
echo.
echo Abrindo em http://localhost:8012/login.html
start "" http://localhost:8012/login.html
py -m http.server 8012
if errorlevel 1 python -m http.server 8012
pause
