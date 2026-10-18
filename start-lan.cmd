@echo off
setlocal
rem ============================================================
rem  Local network (phone) access: php -S 0.0.0.0:8000
rem  Binds to ALL interfaces, not just localhost.
rem ============================================================
set "TP_PHP=%USERPROFILE%\learning\Hackson\php82\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=php"
cd /d "%~dp0site"

echo ============================================================
echo  Local:   http://localhost:8000/
echo  Phone:   http://192.168.1.166:8000/
echo  (phone must be on the same Wi-Fi as this PC)
echo  Press Ctrl+C to stop.
echo ============================================================
"%TP_PHP%" -S 0.0.0.0:8000 router.php
pause
endlocal
