# FitCheck v3.3 — verification record

Run date: **2026-10-16**. Source: the uploaded `training-platform-v3.2(2).zip`.

## Results

| Check | Result |
|---|---|
| FitCheck PHP validation, readiness, AI normalization, source-adapter fixtures | **34 passed** |
| FitCheck UI + actual local PHP API + actual LlmClient HTTP call to a local fixture provider | **33 passed** |
| Graduate, startup finance, FitCheck navigation, investor challenge, interview and report DOM integration | **33 passed** |
| TypeScript engine | **120 passed; 49 browser-dependent tests skipped** |
| TypeScript typecheck | Passed |
| Browser-engine build | Passed |
| Existing PHP suites | Core 23; interview 29; conversation 5; J1 13; advisor routing 17; v3.2 tasks 5; speech 21 — all passed |
| Existing JavaScript helper suites | v3.2 5; J1 6 — all passed |
| HTTP smoke checks | **40 passed**, including FitCheck, old-route redirect, API method controls and PDF module MIME type |
| Bundled PDF.js text extraction | English and Traditional Chinese fixtures passed |
| Actual configured external AI | One synthetic proposal returned **live** analysis, with 3 rewrite suggestions |
| Original private `.env` | Byte-for-byte preserved; values never printed in this report |

## Important coverage

- Guided form → reviewed AI extraction → evidence → analyzed report → explicit rewrite → Edit & re-check → immutable revision.
- Applying a rewrite then selecting Edit & re-check keeps the edited text. Undo restores the prior draft field values.
- Report snapshots survive reload; old versions can be opened by URL, continued, and listed in My reports.
- Language switching retains draft fields and evidence. The report text keeps the language requested for that report.
- Draft and report storage is separate in demo mode. Existing graduate profiles and reports remain separate.
- Browser Print is invoked for PDF export; Markdown export includes sources, status and readiness limitations.
- Missing AI, malformed AI JSON and provider outages produce explicitly labelled fallback checklists. Failed extraction retains the draft.
- Unsupported source IDs and quotations absent from evidence are rejected. The application does not treat quote matching as verification of an inference.
- Empty, oversized and non-JSON requests are rejected. Invalid requests do not call the AI provider. HTML in proposal text is rendered as text.
- Unconfigured sources and opted-out source fetching make no provider calls. Individual source failure does not block the report.
- Connector fixtures cover SerpApi time series (including zero/partial samples), Crunchbase search/header/attribution, and Reddit OAuth/search without author names or tokens in output.
- Readiness calculation follows the displayed formula. Negative evidence can increase readiness; old evidence has no recency credit.
- The older uploaded `api/llm.php` bypassed the existing advisor-routing implementation; it now uses `Tasks::runConfigured()`. Dedicated-advisor/shared-key/fallback tests pass.
- PDF.js initially needed a compatibility build for newer typed-array APIs; the packaged version is the tested compatibility build with local CMaps/fonts.

## Limits of this verification

- jsdom checks behaviour and real local HTTP interactions, **not visual layout, print pagination or a full browser worker lifecycle**. A real Chromium process could not start in this execution environment. No claim of full visual-browser QA is made.
- The bundled PDF parser was tested on text PDFs in Node with its worker and CMaps. Scanned OCR, protected files and direct PPTX import are not supported. Founders must review extracted text.
- No paid/approved credentials were provided for SerpApi, Crunchbase or Reddit. Their adapters were tested against documented response fixtures and failure cases, **not authenticated live market-data accounts**.
- The real AI check used only a fictional, nonconfidential proposal. It verifies the configured service worked for that request on this date; availability and quotas can change.
- Existing historical v3.2 test reports are retained for context and must not be read as verification of this release.

## Reproduction

Requirements: PHP with cURL/mbstring, and the Node version specified in `engine/package.json`.

```sh
cd engine
npm ci
npm run typecheck
npm test
npm run build:site
npm run test:fitcheck
npm run test:integration
```

From the project root:

```sh
php site/tests/run.php
php site/tests/interview-scoring.php
php site/tests/conversation.php
php site/tests/j1.php
php site/tests/advisor-routing.php
php site/tests/v32.php
php site/tests/speech.php
node site/tests/v32.cjs
node site/tests/j1.cjs
bash scripts/smoke.sh
```

FitCheck's automated PHP/DOM tests use fixture credentials and never spend the user's external API quota. `PHP_PATH` can point to a PHP executable for the Node integration scripts. The DOM fixture server uses ports 8793 and 8794; the existing regression script uses 8791.
