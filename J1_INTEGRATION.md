# Franklin / J1 - V3.1 integration

Based on the team's `training-platform-v3.zip`. This delivery focuses on the graduate Career Direction AI assistant, profile and questionnaire. The report was used for reference and was not edited.

## Completed

- Connect Career Direction to DeepSeek using Franklin's separately supplied private API key. Only `advisor_chat` and `advisor_paths` prefer this key. If the primary call is unavailable or produces unusable output, retry with the team's original chat configuration; if both fail, return the existing labelled rule fallback. Other modules retain the team's original key and model. A live API check succeeded with the new key, and Chinese and English career suggestions/dialogue were tested in the browser.
- Keep the advisor's original role: explore careers, compare the displayed paths, explain skill gaps and suggest practical next steps. Route A/B/C are mapped to authoritative role cards so the AI can compare the paths actually on screen. Unrelated requests are instructed to return to career guidance.
- Keep normal advisor replies free of technical source labels. When the service falls back, show a brief basic-guidance notice. Failed live results are retried when the page is reopened instead of being permanently reused as cached AI suggestions. Guard against overlapping submissions and late replies after refreshed suggestions.
- Switching language retains the conversation, selected route and route order. AI path generation includes both explanation languages in one selection, so switching the interface does not issue another recommendation request. Historical messages keep their original language; new replies follow the language selected when sent. The conversation and selected route also survive a page reload.
- Add optional education level, degree/programme and study status (completed / in progress). Include these in the career context and initial CV draft; keep already edited CV content intact. Do not infer completion when no status is supplied. Future study can be recorded in the existing five-year-plan goals. Legacy planned programmes remain preserved, are sent to AI only as future study goals, and are excluded from initial CV education and major-based opportunity matching.
- Fix translated major options so saving an English profile preserves the canonical major/tag value. Validate graduation years as four digits.
- Add resumable questionnaire answers/page, clear-current-answers and persistent retake state. Retaking or submitting resets sharing consent; sharing remains off by default.
- Keep the team's 18 IPIP items and scoring engine. Equal displayed scores receive equal-strength labels. For live path selection, questionnaire scores are excluded entirely; optional strengths explanations are added after roles are selected. Chat can use only valid shared scores for reflection, never to filter/rank roles.
- Keep the original dark design, navigation and left-chat/right-path layout. Update asset URLs so browsers load changed code. Explain AI data transmission beside the chat.

No homepage/general-purpose agent is added. Five-year-plan UI, policy data, interview scoring engine, founder modules and questionnaire wording are retained from v3.

## Run locally

PHP 8.1+ with curl and mbstring is required. Built frontend assets are included; Node is not required to run the website.

1. Extract the complete archive to its own directory.
2. Retain the team's private `.env` in the project root and append the `ADVISOR_*` settings from `.env.deepseek.example`, entering Franklin's advisor key locally. For a standalone installation, use the example file and configure the keys needed by its modules.
3. Run `start-j1.cmd`, or run `php -S 127.0.0.1:8128 -t site site/router.php` from the project root.
4. Open `http://127.0.0.1:8128/grad/index.php`, save a profile, then visit Career Direction. Normal replies have no source badge; an unavailable service displays a brief basic-guidance notice.

The local J1 `.env` retains all settings from the original team file, including its `LLM_API_KEY`, models, rate limits and MiniMax speech settings. Franklin's key is stored separately as `ADVISOR_LLM_API_KEY`, with advisor-specific mode, base URL, model and rate limit. The original extracted `.env` and uploaded archive are unchanged. Dedicated advisor calls have their own local rate-limit bucket.

`ADVISOR_LLM_MODE=mock` explicitly disables both advisor AI attempts. Team fallback is available only when the team's `LLM_MODE` is live; this preserves its offline/demo setting. Set both modes to mock for a fully offline demo. Separate API keys can still share provider-account balance and concurrency limits.

The V3.1 delivery archives dated 2026-10-11 include the latest J1 changes, the bilingual `J1_UPDATE.md` and the 30-second demo in `docs/`. They exclude `.env`, credentials and runtime caches. When merging code into the team's copy, retain its `.env` and append the advisor settings rather than replacing the file.

The backend sends a limited career summary and chat content to the configured provider. School names and contact details are excluded from the profile summary. Avoid typing identifying details into free-text chat. Questionnaire scores are used only with consent.

Provider setup: https://api-docs.deepseek.com/

## Review / merge

The complete archive contains the runnable site. The changes-only archive contains project-relative paths and a manifest with SHA-256 base/new hashes. Compare the base hashes against your current files; if a teammate has made further edits, merge those files manually before replacing them.

Screenshots are 1600 x 1000, consistent with the previous screenshot ratio. They use fictional test data and are not questionnaire research findings.

## Validation

75 offline checks passed: existing PHP 23, interview scoring 29, conversation 5, J1 PHP 12, J1 JavaScript 6. All 63 PHP/JavaScript files passed syntax checks during the earlier review; the latest changed files were checked again. A separate billable live check confirmed the supplied DeepSeek key worked at review time.

17 additional checks passed in `php site/tests/advisor-routing.php` (92 cumulative offline checks). It exercises the real HTTP entrypoint against a local provider fixture with fake credentials, checking primary-key preference, original-key routing for other modules, ordered AI fallback, final rule fallback and explicit offline mode without spending provider credits. The configured advisor flow also returned a real DeepSeek reply after the separation change. For the latest UI and education refinement, the existing 23 PHP checks, 12 J1 PHP checks and 6 J1 JavaScript checks were rerun successfully, including legacy planned-education handling.

Browser checks cover live bilingual path generation and chat, degree/status persistence, major values after language switching, missing-answer feedback, refresh/resume, completion and default non-sharing, equal-score labels and 375px layouts without horizontal overflow. Paid speech and actual OS PDF printing were outside this change.

The latest advisor language fix adds one bilingual-path regression check (93 cumulative offline checks). The 23 base PHP, 13 J1 PHP, 6 J1 JavaScript and 17 HTTP routing checks were rerun successfully (59 checks). Browser verification confirmed three live Chinese questions, immediate English switching without lost history or changed routes, an English follow-up using the preceding Chinese context, and conversation/selection persistence after reload. A 30-second silent demonstration without subtitles is included in `docs/`.
