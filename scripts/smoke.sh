#!/usr/bin/env bash
# 煙霧測試：啟動 PHP 開發伺服器，檢查每頁和每個 API 都正常。用法：bash scripts/smoke.sh
set -u
cd "$(dirname "$0")/../site"
PORT=${PORT:-8123}
LLM_MODE=mock php -S 127.0.0.1:$PORT router.php >/tmp/tp-smoke.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT
sleep 1
URL="http://127.0.0.1:$PORT"
fail=0
check() { # 預期狀態碼 路徑
  code=$(curl -s -o /tmp/tp-out -w "%{http_code}" "$URL/$2")
  if [ "$code" != "$1" ] || grep -qiE "(^|<b>)(warning|notice|fatal error|deprecated)(</b>)?:" /tmp/tp-out; then echo "✗ $2 → $code"; fail=1; else echo "✓ $2 → $code"; fi
}
for p in index.php grad/index.php grad/strengths.php grad/advisor.php grad/cv.php grad/opportunities.php grad/interview.php grad/plan.php \
         startup/index.php startup/fitcheck.php startup/term-sheet.php startup/b2b.php startup/hostile-vc.php reports.php \
         assets/js/v32.js assets/js/i18n-v32.js assets/css/v32.css assets/js/engine.js assets/js/app.js assets/js/policy.js assets/js/i18n-v2-grad.js assets/js/i18n-v2-startup.js assets/css/app.css \
         api/scenario.php?id=black_swan_saas_v1 api/scenario.php?id=term_sheet_guidance_fund_v1; do check 200 "$p"; done
for p in lib/Config.php includes/layout.php tests/run.php .htaccess api/scenario.php?id=..%2Fx; do check 404 "$p"; done
check 302 startup/black-swan.php
check 405 api/fitcheck.php
check 200 assets/js/vendor/pdfjs/pdf.mjs
check 405 api/evaluate.php
post() { curl -s -o /tmp/tp-out -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$2" "$URL/api/$1"; }
code=$(post llm.php '{"task":"check","check":"ROI","text":"每週省 12 小時"}'); grep -q '"pass":true' /tmp/tp-out && [ "$code" = 200 ] && echo "✓ llm check" || { echo "✗ llm check $code"; fail=1; }
code=$(post llm.php '{"task":"plan_draft","pathId":"marketing_analyst","profile":{}}'); grep -q '"milestones"' /tmp/tp-out && [ "$code" = 200 ] && echo "✓ llm 五年規劃初稿" || { echo "✗ llm plan_draft $code"; fail=1; }
code=$(post llm.php '{"task":"nope"}'); [ "$code" = 400 ] && echo "✓ llm 拒絕未知任務" || { echo "✗ llm unknown $code"; fail=1; }
code=$(post evaluate.php '{"log":{"scenarioId":"b2b_procurement_v1","kind":"exercise","steps":[{"stepId":"budget_freeze","inputs":{},"text":"Grace 你好，系統每週可節省 12 小時。下星期二下午 3 點可以通電話嗎？"}]}}')
grep -q '"dimensions"' /tmp/tp-out && grep -q '"mock":1' /tmp/tp-out && [ "$code" = 200 ] && echo "✓ evaluate（示範評分）" || { echo "✗ evaluate $code"; fail=1; }
code=$(post evaluate.php '{"log":{"scenarioId":"b2b_procurement_v1","kind":"exercise","steps":[]}}'); [ "$code" = 400 ] && echo "✓ evaluate 拒絕空紀錄" || { echo "✗ evaluate empty $code"; fail=1; }
code=$(post evaluate.php 'not json'); [ "$code" = 400 ] && echo "✓ evaluate 拒絕非 JSON" || { echo "✗ evaluate bad json $code"; fail=1; }
exit $fail
