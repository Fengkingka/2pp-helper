@echo off
setlocal
cd /d "%~dp0"
if not defined TP_PHP set "TP_PHP=%~dp0tools\php\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=%~dp0..\..\training-platform\tools\php\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=%USERPROFILE%\learning\Hackson\php82\php.exe"
if not exist "%TP_PHP%" set "TP_PHP=php"
echo Open http://127.0.0.1:8133/startup/vc-panel.php
echo This serves the v3.3 folder. Existing API settings are unchanged.
echo Press Ctrl+C to stop the server.
"%TP_PHP%" -S 127.0.0.1:8133 -t site site/router.php
pause
endlocal
