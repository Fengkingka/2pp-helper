@echo off
setlocal
cd /d "%~dp0"
if not defined TP_PHP set "TP_PHP=%~dp0tools\php\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=%USERPROFILE%\learning\Hackson\php82\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=php"
echo Open http://127.0.0.1:8128/grad/advisor.php
echo AI mode follows .env. Press Ctrl+C to stop the server.
"%TP_PHP%" -S 127.0.0.1:8128 -t site site/router.php
pause
endlocal
