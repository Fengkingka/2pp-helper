# 快速啟動說明（2PP Helper）

這是一個 **PHP 網站（PHP 8.1+）**，**不需要 Node.js、不需要數據庫**。
引擎 `site/assets/js/engine.js` 已構建好並包含在倉庫內，clone / 下載後即可運行。

## 1. 安裝 PHP（只需一次）

**Windows（最簡單，用 winget）**：打開 PowerShell 或命令提示字元，執行

```powershell
winget install PHP.PHP
```

裝完**重開一個終端窗口**，確認：

```powershell
php -v
```

能看到 PHP 8.x 版本即可。需啟用的擴展（一般預設已開）：`curl`、`mbstring`、`openssl`、`fileinfo`。

> 若沒有 winget：到 <https://windows.php.net/download/> 下載 Non Thread Safe 的 PHP 8.x zip，解壓後把資料夾加入系統 PATH。

**macOS**：`brew install php`

**Linux (Debian/Ubuntu)**：`sudo apt install php-cli php-curl php-mbstring`

## 2. 取得代碼

```bash
git clone https://github.com/Fengkingka/2pp-helper.git
```

或綠色 **Code → Download ZIP** 後解壓。

## 3. 啟動

在專案根目錄（能看到 `site` 資料夾那層）執行：

```bash
cd site
php -S localhost:8000 router.php
```

或直接雙擊根目錄的 `start-vc-demo.cmd`（Windows，VC 面板，端口 8133）。然後打開 <http://localhost:8000/>。

## 4. AI 金鑰配置（可选）

**倉庫不含 `.env`，也不附帶任何 API 金鑰。** 未配置時網站自動進入**示範模式**（頁面可操作，AI 評分/回覆為規則模擬，語音不可用）。

要啟用真實 AI 對話、語音與評分：

1. 在**根目錄**（`site` 的上一層）複製範本：`.env.example` → `.env`
2. 到對應服務申請金鑰並填入 `.env`：
   - `LLM_BASE_URL` / `LLM_API_KEY`：任何 OpenAI 相容的 `/chat/completions` 端點（如 DeepSeek）
   - `MINIMAX_API_KEY`：MiniMax 語音（TTS / ASR，可选）
   - `FITCHECK_SERPAPI_KEY`：FitCheck 檢索（可选）
3. 重啟服務即可。

> `.env` 已在 `.gitignore` 中，**切勿把真實金鑰提交到倉庫**。

## 運行模式

- 有 `.env` 且填入金鑰 → **live 真實模式**：真實 AI 對話、語音、評分。
- 沒有 `.env` → 自動**示範模式**：完整界面可操作，AI 為規則模擬。

## 常見問題

- **`php 不是內部或外部命令`**：PHP 未安裝或未加入 PATH，重開終端再試。
- **語音/AI 報錯**：檢查 `.env` 中金鑰是否有效、本機能否聯網（企業網路需設 `LLM_CA_FILE`）。
- 想跑引擎測試（可選，需要 Node）：`cd engine && npm install && npm test`。純部署運行不需要。
