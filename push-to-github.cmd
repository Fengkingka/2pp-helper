@echo off
cd /d "%~dp0"
echo ============================================================
echo   2PP Helper  -  Upload local changes to GitHub
echo   Repo: https://github.com/Fengkingka/2pp-helper
echo ============================================================
echo.
set "msg="
set /p "msg=Commit message (what did you change? Enter = 'update'): "
if not defined msg set "msg=update"
echo.
git add -A
git commit -m "%msg%"
git push
echo.
echo ------------------------------------------------------------
echo Done. If you see "main -> main" above, upload succeeded.
echo ------------------------------------------------------------
pause
