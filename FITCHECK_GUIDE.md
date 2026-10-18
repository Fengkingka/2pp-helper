# 2PP Helper v3.3 — FitCheck 使用及接入指南

本次以你上傳的 `training-platform-v3.2(2).zip` 修改，使用原有 PHP、JavaScript、TypeScript 引擎及中英介面。Black Swan 的主要入口已換成 FitCheck，沒有重建另一個獨立網站。

## 立即開始

1. 解壓整個專案；保留根目錄 `.env` 及 `certs/`。
2. 使用原有啟動檔，或在根目錄執行：

   ```sh
   php -S localhost:8000 -t site site/router.php
   ```

3. 開啟 `http://localhost:8000/startup/fitcheck.php`，或由「創業者路線 → FitCheck」進入。
4. 填寫五項必填內容：痛點、目標客戶、解決方案、收入模式、市場規模假設。未知可寫「待驗證」，不要編造數字。
5. 可匯入 TXT、MD 或文字型 PDF，然後按「AI 整理成表格」。**先核對擷取草稿，再按套用**。PDF 最多 5 MB／30 頁，提案文字最多 20,000 字元；不支援掃描 OCR、受保護 PDF 或直接讀取 PPTX。
6. 加入有來源及日期的證據，再按「分析提案」。未設定市場 API 時，仍可用手動證據及已連接的 AI 完成報告。
7. 在報告查看風險、警示、優勢、出處、改寫建議及驗證實驗。套用改寫後，按「修改並重查」返回提案頁核對並重新分析；已套用的草稿修改會保留。
8. 用「列印／儲存 PDF」在瀏覽器選擇儲存為 PDF；亦可下載 Markdown 提案與報告，或 JSON 資料。這不是伺服器直接產生 PDF 的服務。

## 本次已完成

- 中英文提案表格；本機草稿自動保存。
- 本機 PDF 文字擷取，附 PDF.js 相容版本、CMaps 及字型，不依賴外部 CDN。
- 沿用現有 `LLM_*` 設定：提案擷取、證據分析、修改草稿及實驗建議。
- 資料連接器：Google Trends 及競爭對手搜尋經 SerpApi（同一個 key），Hacker News 社群討論（免 key、免註冊）。
- 最多 10 項手動證據，包含類別、內容、來源網址及原始資料日期。
- 清楚區分「已設定」、「本次取得資料」、「未查詢」、「查無結果」和「連接失敗」。
- AI 引文必須引用本次 evidence ID，且引文須出現在來源標題或內容；不合格的該項 AI finding 會移除。這不能自動證明推論正確，仍需人工核對。
- 不可變的報告快照、修改後重查、同一提案的版本差異；最多保存 12 份。
- FitCheck 報告出現在「我的報告」；驗證實驗可加入現有行動清單。
- PDF 列印、Markdown／JSON 匯出，以及草稿和報告 JSON 備份。備份為資料下載，目前沒有自動還原匯入功能。
- 舊 `startup/black-swan.php` 導向 FitCheck；舊模擬引擎和已儲存報告保留，以維持歷史報告相容。
- 修正上傳版本的 `api/llm.php` 未使用既有 `Tasks::runConfigured()` 的問題：職涯助理專用設定及共享 AI 後備路由可正常生效。

## AI 設定：不需要另一份 .env

**你的原有根目錄 `.env` 已逐位元保留。** 它是私人設定，包含既有憑證；不要把這個私人 ZIP 或 `.env` 公開到 GitHub／公開網站。網頁根目錄應指向 `site/`，不能指向整個專案根目錄。

FitCheck 使用以下原有設定，呼叫 OpenAI 相容的 `/chat/completions`：

```dotenv
LLM_MODE=live
LLM_BASE_URL=https://YOUR_PROVIDER/v1
LLM_API_KEY=YOUR_EXISTING_KEY
LLM_MODEL_CHAT=YOUR_PROVIDER_CHAT_MODEL
LLM_JSON_MODE=true
LLM_TIMEOUT=45
```

上面只是格式範例，**不要用佔位文字覆蓋現有有效設定**。是否使用 `/v1` 及 JSON mode，依供應商要求；程式會在 BASE_URL 後加上 `/chat/completions`。FitCheck 不使用 `LLM_MODEL_EVAL`。`LLM_CA_FILE` 繼續支援原有根目錄相對憑證路徑。

2026-10-16 已用一份虛構 invoice-helper 提案，實際測試這次上傳中的 AI 設定：成功取得 live 分析及 3 項改寫建議。這是一次當時的連線結果，不保證供應商將來的配額或可用性。

AI 未設定、逾時或回傳無效 JSON 時，分析仍產生明確標示的「規則檢查報告」，列出缺失證據及實驗建議；**不會冒充已完成 AI 分析**。AI 擷取失敗則保留原稿，讓你自行填表。

## 市場資料設定

一個 SerpApi key 同時啟用 Google Trends 和競爭對手搜尋兩個來源；Hacker News 社群搜尋使用官方 Algolia API，**免費、無需 key、無需註冊**，永久啟用。

將 SerpApi key 加入同一個根目錄 `.env`；空白即停用 Trends 和競爭對手搜尋。完整樣板也在 `.env.example`。

```dotenv
FITCHECK_SERPAPI_KEY=
RATE_LIMIT_FITCHECK_PER_HOUR=20
```

| 來源 | 接入方法 | 本 MVP 的輸出與限制 |
|---|---|---|
| Google Trends | SerpApi 的 Google Trends `TIMESERIES`，需要 `FITCHECK_SERPAPI_KEY` | 單一關鍵字、過去 12 個月、選定地區的 0–100 相對指數。不是絕對搜尋量、TAM、付費意願或按年增長。可能使用供應商約一小時內快取。 |
| 競爭對手 | SerpApi 的 Google 搜尋引擎（同一個 key），查詢「關鍵字 + startup/app/platform」 | 最多 5 條搜尋結果作為候選競爭者。不能宣稱已找齊競爭者、已確認直接競爭或融資額。 |
| Hacker News | 官方 Algolia 搜尋 API `hn.algolia.com/api/v1/search`，無需 key | 最多 5 篇相關貼文；不收集作者名稱／個人檔案。供 AI 作少量觀察分析，不計算代表整體市場的「情緒百分比」。 |

Google Trends 官方 API 在查閱時仍為需要申請的 alpha，因此此版**明確使用第三方 SerpApi**，沒有假稱已接入官方 alpha。若你將來獲批官方 API，可替換 `FitCheckSources::trends()`。

SerpApi 免費檔每月約 100 次查詢，Trends 和競爭對手搜尋共用配額，一次分析約用 2–3 次。啟用前請確認所獲存取權包含本用途及向所選 AI 供應商傳送資料；不要把 API key 當作無限制的資料使用許可。報告含來源快照，對外分享前也應檢查權限及個人資料。

只有公開搜尋關鍵字送往資料 API；完整提案和選定證據送往你的 AI 供應商。手動來源網址只是引用，不會由伺服器自動抓取任意網頁。抓取只允許程式內的固定供應商主機（`serpapi.com`、`hn.algolia.com`），無自動重試，單次請求有時間及大小限制。

## 評分定義

介面使用 **Evidence readiness／證據準備度**，不是已驗證的 product-market fit 分數，也不是創業成功率。原因是：LLM、搜尋趨勢、競爭者及論壇貼文不能直接證明客戶留存或可持續付費需求。

| 類別 | 對應提案欄位 |
|---|---|
| 痛點 | problem |
| 需求 | audience |
| 競爭 | differentiator |
| 付費 | revenue |
| 市場規模 | marketSize |

每類最多 20 分：對應提案欄位有內容 +5；有至少一項證據 +10；其中一項原始資料日期在過去 365 日內 +5。五類合共 100 分，版本為 `evidence-readiness-v1`。

這是透明的文件完整性檢查，不評估證據的真實性、代表性或結論是否正面。手動資料與 API 資料均可計分；負面客戶回饋也可增加準備度。公司記錄等沒有原始日期的資料，不以抓取日期冒充資料日期。相同證據不會重複增加同類分數。

市場是否成立仍須做訪談、付費試驗、留存及重複使用等實際驗證。AI 建議的數字門檻是待調整的實驗設計，不是預測結果。

## 部署與範圍

- PHP 8.1+，啟用 `curl`、`mbstring`。前端使用現代瀏覽器及 JavaScript modules；本版附帶相容型 PDF.js。
- Apache 已加入 `.mjs` MIME 設定；PHP 開發 router 亦有處理。其他伺服器須以 JavaScript MIME 類型提供 `.mjs`。
- 對外 HTTP／PHP 反向代理請允許最長約 120 秒的分析請求，並保持 HTTPS。外部資料 API 可能有配額、超時或付費限制。
- 無須新增 Node／Python 服務、PostgreSQL、向量資料庫或另建 Next.js 專案。只有修改 TypeScript 引擎／執行測試才需要 Node 開發依賴。
- 本機資料沒有帳戶同步；清除瀏覽器資料會失去草稿及報告。示範模式使用獨立命名空間。
- 未建立收費訂閱、團隊協作、pitch deck 生成、導師配對、全網爬取或創業成功預測。這些不是本次 Phase 1。
- 未有獲授權市場資料 API 憑證時，SerpApi 來源只完成 fixture／失敗處理測試，沒有宣稱完成付費或獲批帳戶的端到端驗證。Hacker News 來源免 key，同樣以 fixture 測試。詳見 `FITCHECK_TEST_RESULTS.md`。

## English quick start

Start the existing PHP app and open `startup/fitcheck.php`. Import a text-based PDF/TXT or complete the guided form, add dated evidence, and select **Analyze proposal**. Review citations and draft rewrites, apply selected changes, return to Proposal, and analyze again. Historical versions appear in **My reports**.

The existing private `.env` is preserved and its AI connection was successfully checked with a synthetic proposal. Google Trends and competitor search both use **SerpApi** (one key), not Google's gated alpha API; community discussions use the keyless Hacker News Algolia API. No-source or failed-AI reports are clearly labelled checklists. The 0–100 score measures **evidence readiness**, not proven PMF. PDF export uses the browser's Print → Save as PDF dialog.

## 查閱的官方技術資料（2026-10-16）

- Google Trends alpha: https://developers.google.com/search/apis/trends
- SerpApi Google Trends: https://serpapi.com/google-trends-api
- SerpApi Google Search: https://serpapi.com/search-api
- Hacker News Algolia Search API: https://hn.algolia.com/api
- PDF.js: https://mozilla.github.io/pdf.js/examples/
