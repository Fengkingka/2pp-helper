@echo off
setlocal
set "TP_PHP=%~dp0..\..\training-platform\tools\php\php.exe"
if not exist "%TP_PHP%" (
  echo Portable PHP was not found at "%TP_PHP%".
  echo Install PHP 8.1 or later with mbstring and curl, then serve the site directory.
  pause
  exit /b 1
)
cd /d "%~dp0site"
echo Open http://127.0.0.1:8002/grad/interview.php in Chrome.
echo Press Ctrl+C to stop the server.
"%TP_PHP%" -S 127.0.0.1:8002 router.php
pause
endlocal
