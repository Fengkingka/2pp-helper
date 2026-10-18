# engine：練習引擎、計算器和內容

網站（`../site`，HTML + PHP）的計算邏輯和練習內容都在這裡，只有一份：

| 路徑 | 內容 | 擁有者 |
|---|---|---|
| `lib/types.ts` | 共用資料格式（zod），PHP 端的 `site/lib/Validator.php` 按同一份定義檢查 | V（UserProfile 由 K 定稿） |
| `lib/calc/captable.ts` | 股權表：投前／投後期權池、多輪融資 | V |
| `lib/calc/waterfall.ts` | 退出分配：清算優先權、participating、seniority | V |
| `lib/calc/runway.ts` | 現金流模擬：Black Swan 和運營成本計算器共用 | V |
| `lib/engine/engine.ts` | 用 seed 抽事件卡、記錄每一步、把決定交給計算器 | V |
| `lib/content.ts` | 劇本和評分準則的登記處（給測試用） | V |
| `scenarios/*.json` | 劇本：Black Swan、Term Sheet、B2B、面試題庫 | J2 |
| `rubrics/*.json` | 評分準則 | J2 |
| `data/demo.ts` | 「載入示範資料」用的虛構畢業生和公司 | K、V |
| `browser.ts` | 瀏覽器入口 → `site/assets/js/engine.js`（全域變數 `Engine`） | V |
| `hk.ts` | 簡轉繁 → `site/assets/js/opencc-hk.js`（全域變數 `OpenCCHK`） | V |

## 怎樣接到 PHP 網站

```bash
npm install
npm run build:site   # 先跑 26 個測試；通過後才會更新網站檔案
```

`build:site` 做三件事：

1. 把 `browser.ts` 打包成 `site/assets/js/engine.js`（約 7 KB）。網站頁面直接呼叫 `Engine.calc.quickRunway`、`Engine.engine.runBlackSwan`、`Engine.calc.exitScenarios` 等，所有數字都在瀏覽器即時計算。
2. 把 `hk.ts` 打包成 `site/assets/js/opencc-hk.js`（約 1 MB，只在顯示 AI 文字的頁面載入）。
3. 把 `scenarios/`、`rubrics/` 複製到 `site/data/`。PHP 評分器（`site/lib/Evaluator.php`）和練習頁面都讀這批 JSON。

**不要直接修改 `site/data/scenarios`、`site/data/rubrics` 和 `site/assets/js/engine.js`**，下次 build 會被覆蓋。打包後的檔案會一併提交到 Git，所以只負責 PHP 或部署的組員不需要安裝 Node.js。

其他指令：`npm test`、`npm run typecheck`。

## 為甚麼評分器在 PHP

評分要用 API key，必須在伺服器執行，所以評分器（連同引文核對、重試、清除無法核實的引文）在 `site/lib/Evaluator.php`，測試在 `site/tests/run.php`。瀏覽器端只負責計算和顯示。

## 各人要做的事

**J2：** 照現有格式把 Black Swan 事件卡補到 15 張、Term Sheet 補到 6 輪、B2B 補到 4 封（含分支）、面試題庫每類補到 5 條以上。改完執行 `npm run build:site`，格式錯誤會被測試抓出來，網站不會被更新。頁面會按劇本自動產生輸入欄位，不用改 JavaScript。

**V：** 調整 `DEFAULT_PARAMS`（增長、流失等假設），試玩後確認 Black Swan 的難度合理。

**K：** 在 `data/demo.ts` 更新示範畢業生；職位卡片和機會清單在 `site/data/roles.json`、`site/data/opportunities.json`。

## 已知的簡化

- **現金流模型：** 增長和流失公式刻意簡單，參數在 `DEFAULT_PARAMS`。
- **退出分配：** 不處理 participation cap 和累積股息。
- **過橋融資：** `bridgeRound` 只增加現金，不計算股權稀釋。
- **Term Sheet：** 種子輪之後的 A 輪、B 輪條款是固定假設，寫在 `site/assets/js/pages/term-sheet.js` 的 `LATER_ROUNDS`。
