# AI 面試教練：用到哪些檔案

> 歷史指南：以下檔案角色和行號以舊版為準。v3.2 的預設對話面試由 `site/assets/js/pages/interview-english.js` 控制，支援 3／5 題、職位描述與評分前回答檢查；請先閱讀 `V3.2_UPGRADE_GUIDE.md`。

給負責面試功能的組員（S）和接手的人看。網站沒有獨立的 `.html` 檔：每一頁都是 `.php`，由 PHP 輸出 HTML，所以下面的「頁面」就是 HTML。行號以 2026-10-08 的版本為準，之後改動可能會移位。

## 1. 流程一覽

```
瀏覽器：site/grad/interview.php（頁面）＋ assets/js/pages/interview.js（流程）
 │
 ├─ 1. 按「開始」          start() → Voice.openMic()：開咪高峰、開始錄音、計算音量
 ├─ 2. 準備 5 條題目        buildQuestions()
 │     ├─ GET  api/scenario.php?id=interview_general_v1   → 題庫（後備題、行為題、情境題、行業認知題）
 │     └─ POST api/llm.php  {task:"interview_questions"}   → 按 CV 出 2 條題（AI 失敗就用題庫）
 ├─ 3. 問問題              ask() → Voice.speak() 朗讀 → Voice.listen() 即時字幕
 ├─ 4. 用戶答完            submitAnswer()
 │     └─ POST api/llm.php  {task:"interview_followup"}    → 欠缺行動或結果就追問一次
 └─ 5. 完結                finish() → Voice.closeMic() 取得錄音（只留在瀏覽器）
       ├─ metrics()：語速、口頭禪、完成題數、行業認知題
       └─ POST api/evaluate.php {log}  → 評分報告 → TP.reports.save() → reports.php 顯示
```

## 2. 面試功能的核心檔案

| # | 檔案 | 類型 | 作用 | 甚麼時候要改 |
|---|---|---|---|---|
| 1 | `site/grad/interview.php` | 頁面（PHP 輸出 HTML） | 三個畫面：`#idle` 開始畫面（第 26 行）、`#session` 面試中（第 46 行）、`#done` 完結（第 69 行）。重要元素：目標職位 `#role`（32）、開始按鈕 `#start-voice`（34）、文字作答 `#start-text`（36）、行業認知題選項 `#industry-q`（37）、題目卡 `#q-kind` `#q-text` `#q-policy`（49）、角色 `#avatar`（51）、即時字幕 `#transcript`（66） | 改版面、加按鈕、放角色插畫 |
| 2 | `site/assets/js/pages/interview.js` | 前端 JS | 全部面試流程。`Voice` 物件（第 20–103 行：`pickVoice`、`speak`、`openMic`、`listen`、`stopListening`、`closeMic`）；`buildQuestions`（143）；`ask`（165）；`submitAnswer`（189）；`metrics`（224）；`finish`（239）；`finishRetry`（274）；`start`（284）；`strengthTip`（318） | 換語音方案（只改 `Voice`）、改題目組合、改追問規則、改語速和口頭禪計法 |
| 3 | `site/assets/css/app.css` | 樣式 | 面試室：`.iv*`、`.ring-btn`、`.float-card`、`.q-card`、`.avatar`（按 `data-state` 播放動畫）、`.iv-status`、`.transcript`（約第 292–335 行）；行業認知題 `.iv-option`、`.q-policy`（約第 439–442 行） | 改外觀、角色狀態動畫 |
| 4 | `site/api/llm.php` | 伺服器 API | 接收 `interview_questions`、`interview_followup` 兩個任務；有 AI 時套用每小時用量上限 | 一般不用改 |
| 5 | `site/lib/Tasks.php` | 伺服器程式 | 兩個任務的 AI 指示（有 AI 時：第 93、105 行）和不用 AI 的後備做法（第 184、204 行） | 改出題或追問的 prompt、後備規則 |
| 6 | `site/api/evaluate.php` | 伺服器 API | 收練習紀錄 → 檢查 → 評分 → 回傳報告；只評適用的維度 | 一般不用改 |
| 7 | `site/lib/Evaluator.php` | 伺服器程式 | 評分器：`collectUserText`（17）、`evidenceIsVerbatim`（44，引文逐字核實）、`applicableRubric`（69，「行業認知」選用維度）、`buildMessages`（78，評分指示）、`evaluate`（165，格式不對時重試） | 改評分規則 |
| 8 | `site/api/scenario.php`、`site/lib/Content.php` | 伺服器 | 讀取題庫和評分準則的 JSON | 一般不用改 |
| 9 | `engine/scenarios/interview_general_v1.json` | 題庫（來源） | 題目分 `cv`（後備）、`behavioral`、`situational`、`industry`（附 `policyId`）；每題可有後備追問 `followUp` | 加題、改題。改完執行 `cd engine && npm run build:site`，會複製到 `site/data/scenarios/` |
| 10 | `engine/rubrics/interview_v1.json` | 評分準則（來源） | STAR 完整度、與職位相關、具體成果、表達清晰、行業認知（`requiresMetric: "industryQuestions"`，有答才評）；每個維度有 1–5 級描述 | 改評分維度。同樣要 `npm run build:site` |

> `site/data/scenarios/interview_general_v1.json` 和 `site/data/rubrics/interview_v1.json` 是 build 出來的副本，不要直接改。

## 3. 面試頁有用到的共用檔案

| 檔案 | 面試頁用到甚麼 |
|---|---|
| `site/assets/js/app.js` | `TP.api()`（第 37 行：送出時加上語言；問卷結果未同意分享就不送出）、`TP.reports`（第 134 行：`save`、`evaluateAndOpen`）、`TP.store`、`TP.el`、`TP.toast` |
| `site/assets/js/engine.js` | `Engine.engine.seededRandom`（每日換一組題）、`Engine.strengths.rank`（強項提示）。由 `engine/browser.ts` 打包，不要直接改 |
| `site/assets/js/opencc-hk.js` | `toHK()`：把 AI 文字轉成香港繁體。`interview.php` 最後一行 `page_end([...], true)` 的 `true` 就是載入它 |
| `site/assets/js/i18n.js`、`i18n-v2-grad.js` | 中英文切換。英文模式下語音識別用 `en-HK`，朗讀改用英文聲音（`Voice.pickVoice`） |
| `site/assets/js/policy.js` | 行業認知題下面的「根據〔文件〕」出處（頁面用 `policy_island()` 放入政策資料卡） |
| `site/includes/layout.php` | `page_start`／`page_end`、CSP；`Permissions-Policy: microphone=(self)`（第 37 行）允許本站使用咪高峰 |
| `site/includes/bootstrap.php`、`site/lib/Http.php`、`Config.php`、`RateLimit.php` | 載入設定、回傳 JSON、用量上限 |
| `site/lib/LlmClient.php` | 連接任何 OpenAI 相容的 AI 服務（`create`、`chat`、`asCallable`） |
| `site/lib/MockLlm.php` | 未設定 AI 時的示範評分（報告標示「示範評分」） |
| `site/lib/Validator.php` | `sessionLog()`（第 14 行）：檢查練習紀錄的格式和長度 |
| `site/reports.php`、`site/assets/js/pages/reports.js` | 報告頁：分數路線、逐字引文、語速、口頭禪、行業認知題數目、與五年規劃的連結 |
| `.env`（由 `.env.example` 複製） | `LLM_MODE`、`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL_CHAT`（出題和追問）、`LLM_MODEL_EVAL`（評分）、`RATE_LIMIT_EVAL_PER_HOUR`、`RATE_LIMIT_CHAT_PER_HOUR` |
| `engine/lib/types.ts` | `QuestionStep`（約第 191 行）、`SessionLog`、`EvaluationReport` 的資料格式 |

## 4. 前端和伺服器之間傳甚麼

**出題** `POST api/llm.php`

```json
{ "task": "interview_questions", "profile": { "...": "UserProfile" }, "role": "Marketing Analyst" }
→ { "source": "ai", "questions": ["……", "……"] }
```

**追問** `POST api/llm.php`

```json
{ "task": "interview_followup", "question": "……", "answer": "……" }
→ { "source": "ai", "followUp": "結果如何？" }      // 不用追問時 followUp 是 null
```

**評分** `POST api/evaluate.php`

```json
{ "log": {
    "scenarioId": "interview_general_v1", "kind": "voice", "steps": [],
    "turns": [ { "speaker": "coach", "text": "……", "start": 0, "end": 4.2 },
               { "speaker": "user",  "text": "……", "start": 4.5, "end": 38.1 } ],
    "finalCalc": { "answeredQuestions": 5, "durationSec": 410, "charsPerMin": 180, "fillerTotal": 6, "industryQuestions": 1 } } }
→ { "scenarioId": "...", "summary": "...", "dimensions": [ { "key": "star", "label": "STAR 完整度", "score": 4, "evidence": "用戶原句", "suggestion": "..." } ], "metrics": { ... } }
```

## 5. 常見改動

| 想做的事 | 改哪裡 |
|---|---|
| 換語音方案（例如 realtime API） | 只替換 `interview.js` 的 `Voice` 物件，保留 `speak`、`openMic`、`listen`、`stopListening`、`closeMic` 這幾個方法，流程其他部分不用改。需要金鑰的話，新增一個伺服器端點（例如 `site/api/voice-token.php`）發短期 token，不要把 key 放在前端 |
| 放角色插畫 | `interview.php` 的 `#avatar`；JS 用 `setStatus()` 把 `data-state` 設為 `idle`、`speaking`、`listening`、`thinking`；口型可以用 `openMic()` 算出的音量（現時寫在 `#levels` 的 CSS 變數 `--level`，0 至 1） |
| 加題或改後備追問 | `engine/scenarios/interview_general_v1.json` → `npm run build:site` |
| 改評分維度或級別描述 | `engine/rubrics/interview_v1.json` → `npm run build:site` |
| 改題目組合（2 條 CV 題＋2 條行為題＋1 條情境題或行業認知題） | `interview.js` 的 `buildQuestions` |
| 改語速、口頭禪的計法 | `interview.js` 的 `metrics` |
| 改出題或追問的 AI 指示 | `site/lib/Tasks.php` |
| 接上真正的 AI | `.env` 的 `LLM_*` 設定 |

## 6. 測試

- `cd site && php tests/run.php`：評分器、引文核實、追問後備、選用維度
- `bash scripts/smoke.sh`：所有頁面和 API
- 手動測試：桌面版 Chrome，在 `localhost` 或 HTTPS 下才可以用咪高峰；戴耳機，避免朗讀被當成回答

## 7. 私隱

錄音只存在瀏覽器記憶體（Blob），離開頁面就消失，用戶可以自行下載。只有文字逐字稿會送到伺服器評分，伺服器不儲存任何內容。
