# 2PP Helper v3.3 — FitCheck

本版已用 FitCheck 取代 Black Swan 入口，並保留原有 AI 設定。先閱讀 [FitCheck 使用及 API 接入指南](FITCHECK_GUIDE.md) 及 [本次測試結果](FITCHECK_TEST_RESULTS.md)。下方 v3.2／舊版說明為歷史紀錄；FitCheck 以新指南為準。

# 2PP Helper（先練習，再上場）：職涯與創業訓練平台

**目前版本：v3.2（2026-10-15）**。已更新畢業生資料、CV 同步、行動／規劃、面試及創業模型，並啟用 Hostile VC 原型。先閱讀 [v3.2 更新及啟動說明](V3.2_UPGRADE_GUIDE.md) 與 [本次測試結果](V3.2_TEST_RESULTS.md)。下方第 2 版、J1 分工和日期保留作歷史參考。

給應屆畢業生和初創創辦人的 AI 訓練場。網站用 **HTML + PHP**（不需要資料庫和登入），計算邏輯和練習內容來自 **engine**（TypeScript），兩者用一個 build 指令連接。

```
training-platform/
├── engine/     練習引擎、計算器、劇本、評分準則（TypeScript，有測試）
├── site/       網站（PHP 8.1+，放上任何 PHP 主機即可）
├── scripts/    smoke.sh：一鍵檢查所有頁面和 API
└── .env.example
```

## 快速開始

```bash
cd site
php -S localhost:8000 router.php
```

打開 http://localhost:8000 。未設定 AI 時會自動用**示範模式**：頁面可供操作；建議使用後備規則，對話面試標示為未進行能力評分，其他舊練習的示範分數亦有標示。

## 中英文切換

每一頁右上角都有「中文／English」切換器。選擇會保留在瀏覽器，之後前往其他頁面仍會沿用；英文模式同時套用到頁面文案、動態練習內容、語音識別／朗讀、AI 回覆和評分報告。切回中文不會改動已填寫的資料。

共用翻譯和切換邏輯在 `site/assets/js/i18n.js`。新增前端文案時，請把對應英文加入該檔案的 `TEXT`；包含數字或名稱的動態句子可加入 `PATTERNS`。第 2 版新增內容的翻譯放在 `i18n-v2-grad.js` 和 `i18n-v2-startup.js`（在 `i18n.js` 之前載入，用 `window.TPI18nExtra` 加入），不用改動 `i18n.js`。

接上真正的 AI：把 `.env.example` 複製成 `.env`（放在根目錄），填入供應商資料。任何 OpenAI 相容的端點都可以，換供應商只需改 `.env`。

## engine 怎樣接到網站

```
engine/lib/calc/*.ts ──┐
engine/lib/engine/*.ts ─┼─ npm run build:site ─→ site/assets/js/engine.js   （瀏覽器即時計算）
engine/hk.ts ───────────┤                    ─→ site/assets/js/opencc-hk.js（簡轉繁）
engine/scenarios/*.json ┤                    ─→ site/data/scenarios/        （PHP 和頁面共用）
engine/rubrics/*.json ──┘                    ─→ site/data/rubrics/
```

- **數字由程式計算：** 運營成本、Black Swan 現金流、Term Sheet 股權和退出分配，全部在瀏覽器用 `Engine.*` 計算，拖動滑桿即時更新，不經伺服器。
- **評分在伺服器：** 練習完成後，頁面把 `SessionLog` POST 到 `site/api/evaluate.php`。PHP 評分器檢查格式、呼叫 AI、核對每條引文都是用戶的原句，最後回傳 `EvaluationReport`。API key 只在伺服器。
- **本機儲存：** 用戶資料、CV 和報告存在 localStorage（前綴 `tp:`），側欄和首頁都有「清除我的資料」。使用 AI 時會傳送所需文字；雲端語音另會傳送回答音頻。

改了 engine 的程式碼或 JSON 之後：

```bash
cd engine
npm install        # 第一次
npm run build:site # 先跑測試，通過後才更新 site/
```

打包後的檔案要一併提交，所以只做 PHP 或部署的組員不需要 Node.js。

## 網站結構

| 頁面 | 檔案 | 用到的 engine／API | 負責 |
|---|---|---|---|
| 首頁 | `site/index.php` | — | J1 |
| 畢業生路線總覽＋專業資格 | `site/grad/index.php` | `Engine.demo.user`、`Engine.demo.plan` | J1、K |
| 性格與強項問卷（第 2 版） | `site/grad/strengths.php` | `data/questionnaires/`、`Engine.strengths.score` | J1、J2 |
| 職涯方向 AI 助理 | `site/grad/advisor.php` | `api/llm.php`（advisor_paths、advisor_chat） | J1 |
| CV Builder | `site/grad/cv.php` | `api/llm.php`（cv_rewrite） | K |
| 工作與活動 | `site/grad/opportunities.php` | `data/opportunities.json`（程式計分，不用 AI） | K |
| AI 面試教練 | `site/grad/interview.php` | 面試題庫、`api/llm.php`、`api/evaluate.php` | S |
| 我的五年規劃（第 2 版） | `site/grad/plan.php` | `api/llm.php`（plan_draft）、`Engine.plan.*` | J1 |
| 創業者路線總覽 | `site/startup/index.php` | `Engine.calc.quickRunway` | V |
| Black Swan | `site/startup/black-swan.php` | `Engine.engine.drawEvents`、`runBlackSwan` | V |
| Term Sheet | `site/startup/term-sheet.php` | `Engine.calc.simulateRounds`、`exitScenarios` | V |
| B2B 電郵練習 | `site/startup/b2b.php` | 劇本分支、`api/llm.php`（check） | V |
| 我的報告 | `site/reports.php` | `OpenCCHK.toHK` | J1 |

```
site/
├── api/            evaluate.php、llm.php、scenario.php
├── lib/            Config、Validator、Evaluator、LlmClient、MockLlm、Tasks、Content、RateLimit、Http
├── includes/       bootstrap.php、layout.php（側欄、頂部導航、CSP）、icons.php
├── assets/css/     app.css（設計系統：深色底、青綠＝畢業生、珊瑚橙＝創業者）
├── assets/js/      app.js（共用）、pages/*.js（各頁）、engine.js、opencc-hk.js（由 engine 產生）
├── data/           roles.json、tags.json、opportunities.json、policy.json（K）、scenarios/、rubrics/、questionnaires/（由 engine 複製）
├── tests/run.php   PHP 測試
├── router.php      本機開發用
└── .htaccess       Apache 設定（阻擋 lib、includes、tests）
```

## AI 面試教練用到的檔案

見 [`docs/ai-interview-coach-files.md`](docs/ai-interview-coach-files.md)：列出面試功能的頁面、JS、CSS、API、伺服器程式、題庫和評分準則，以及換語音方案、加題、改評分時要改哪個檔案。

## 測試

```bash
cd engine && npm test          # 66 個：計算器（包括反稀釋、跟投權）、引擎、劇本格式、簡轉繁、問卷計分、五年規劃指標、政策卡格式
cd site && php tests/run.php   # 22 個：評分器、資料檢查、AI 任務的後備做法、政策卡、五年規劃初稿、問卷私隱
bash scripts/smoke.sh          # 啟動伺服器，檢查全部頁面和 API
```

## 部署

任何支援 PHP 8.1+（需要 `curl`、`mbstring`）的主機都可以：

1. 上傳整個資料夾，把網站根目錄（document root）設為 `site/`。
2. 在根目錄（`site/` 的上一層）建立 `.env`。主機不支援 `.env` 的話，改用環境變數，名稱相同。
3. Apache 會自動使用 `site/.htaccess`。Nginx 要自行加上：`location ~ ^/(lib|includes|tests)/ { return 404; }`。
4. 需要 HTTPS，瀏覽器才會允許使用咪高峰。

## 安全與私隱

- 所有 AI 文字用 `textContent` 顯示，加上 CSP（`script-src 'self'`），防止 AI 回覆或用戶輸入注入程式碼。
- 伺服器檢查每個請求的格式和長度（`Validator.php`），劇本名稱只接受 `a-z0-9_`。
- 每個 IP 每小時的 AI 用量有上限（`RateLimit.php`，可在 `.env` 調整）。
- 伺服器不儲存用戶資料；錄音只留在用戶的瀏覽器。
- 問卷結果預設不送出：`app.js` 在送出前移除未同意分享的 `strengths`；伺服器也只在 `shareWithAI` 為 true 時把三個分數交給 AI。強項不會用來排除或排序路徑。
- 政策內容只來自 `data/policy.json` 的政策資料卡，一律顯示「根據〔文件〕」和出處連結，不評價政策。

## 各人接下來要做的事

- **J1：** 替換 `[平台名稱]`（`includes/layout.php` 的 `SITE_NAME`）；檢查各頁在手機上的效果；把首頁插畫換成最終版本。
- **K：** 填寫 `data/opportunities.json` 的真實連結和核實日期（`url` 為 null 時按鈕顯示「連結待核實」）；補充 `data/roles.json` 的職位卡片；調整 `lib/Tasks.php` 裡 CV 改寫的 prompt。
- **S：** 語音暫時用瀏覽器內建的 Web Speech API（桌面版 Chrome 支援廣東話）。選定語音方案後，只需替換 `assets/js/pages/interview.js` 裡的 `Voice` 物件；角色插畫放在 `#avatar`，按 `data-state`（idle、speaking、listening、thinking）切換。
- **V：** 試玩 Black Swan 並調整 `engine/lib/calc/runway.ts` 的 `DEFAULT_PARAMS`；確認 `LATER_ROUNDS` 的假設。
- **J2：** 在 `engine/scenarios`、`engine/rubrics` 補充內容，然後 `npm run build:site`。頁面按 JSON 自動產生，不用改程式。


## 第 2 版新增（2026 年 10 月，按建站指南第 2 版）

| 功能 | 做了甚麼 | 位置 |
|---|---|---|
| 政策資料卡（6.9） | 13 張卡：五年規劃、「四中心、一高地」、青年專章、三萬青年職位及實習計劃、AI 技能提升計劃、人才清單、北部都會區大學城等；每張有出處、官方全文連結和核實狀態，超過 60 日會提示重新核實 | `site/data/policy.json`、`assets/js/policy.js` |
| 職位卡 | 由 6 張增至 12 張（新增財務、物流、AI 產品營運、UX／UI、招聘、社區項目）；每張加入 `recommendedCerts` 和 `policyIds` | `site/data/roles.json` |
| 專業資格（6.12） | 路線總覽可加入資格（名稱、機構、資歷架構級別、狀態、年份）；CV 加入「證書」一節；推薦證書相符 +1；「計劃考取」自動成為五年規劃里程碑草稿 | `grad/index.php`、`cv.js`、`opportunities.js` |
| 性格與強項問卷（6.11） | IPIP-VIA-R 核心強項短版 18 題（公有領域），每頁 6 題，程式計分（有反向題測試），只顯示相對強項；預設不送給 AI | `grad/strengths.php`、`engine/questionnaires/`、`engine/lib/strengths.ts` |
| 我的五年規劃（6.10） | 由職涯路徑一鍵建立初稿（AI 或後備規則）；願景、3 至 5 個目標（可連政策卡）、每年 1 至 3 個里程碑；面試報告和證書狀態自動計算進度；年度檢討；列印 PDF | `grad/plan.php`、`engine/lib/plan.ts`、`Tasks::plan_draft` |
| 職涯方向 AI 助理 | 路徑詳情加「與香港五年規劃的關係」和建議證書；「把這條路徑變成我的五年規劃」；用戶同意時「為甚麼適合你」會提到強項 | `advisor.js`、`Tasks.php` |
| 工作與活動 | 按主修 ×3、興趣 ×2、技能 ×1、專業資格 +1 配對，每張卡列明相符的是哪一項；44 項都有連結（13 個政府青年就業及培訓計劃連官方網頁，職位和實習連 JobsDB 搜尋結果，另有課程與考證、活動、比賽），寫明核實日期；頁底有免責聲明 | `opportunities.js`、`grad/opportunities.php`、`data/opportunities.json` |
| AI 面試教練 | 可選的「行業認知」題（4 條，附政策卡出處）；rubric 新增選用維度 `requiresMetric`，有答才評；強項提示 | `interview.js`、`engine/rubrics/interview_v1.json`、`Evaluator::applicableRubric` |
| 我的報告 | 顯示平均分（與五年規劃同一計法）、這份報告計入哪個里程碑、下一步可參考的政策卡 | `reports.js` |
| Black Swan（6.6） | 事件卡由 5 張增至 15 張，其中 3 張是連到政策卡的虛構情景；示範 seed 改為 20261011 | `engine/scenarios/black_swan_saas_v1.json` |
| Term Sheet（6.5） | 由 2 輪增至 6 輪（反稀釋、跟投權、創辦人股份歸屬、否決權）；下跌輪壓力測試和跟投權計算器（有手算測試）；新增「政府引導基金（虛構示範）」投資者 | `term_sheet_*.json`、`engine/lib/calc/antidilution.ts`、`prorata.ts` |
| B2B 電郵（6.7） | 由 3 封增至 4 輪：預算凍結、資料合規、要求免費試用、壓價，每輪有分支 | `engine/scenarios/b2b_procurement_v1.json` |

**仍要人手完成：**
- **K：** `policy.json` 中與施政報告第 120 和 286 段有關的 5 張卡已改用官方全文作出處（由 AI 助手對照，請覆核）；其餘 8 張仍按新聞報道整理，要對照 hk5yplan.gov.hk 核實。`opportunities.json` 的 44 個連結在 2026-10-08 打開檢查過，決賽前一天要再檢查一次；「三萬青年職位及實習計劃」的一站式申請網頁公布後，把連結換成官方申請頁。
- **J2：** 問卷中文版是試譯，按指南做回譯和 5 位同學預試；檢查新事件卡、Term Sheet 條款和電郵的用詞。
- **V：** 調整 `DEFAULT_PARAMS`。現時示範公司處於現金邊緣：首席工程師離職反而因為省下薪金令結果較好；增加市場預算在 12 個月內很難回本，所以「大學城查詢增加」事件中加大投入總是令 12 個月現金較少。
- **S：** 「行業認知」題已加入題庫；選定語音方案後一併測試。
