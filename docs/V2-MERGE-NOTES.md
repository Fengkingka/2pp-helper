# V2 interview integration

This independent directory combines the v2 platform with the tested interview speech and session lifecycle from the bilingual project. The original projects and archives are unchanged.

## Interview entry points

- `grad/interview.php`: personalized conversation in English or Cantonese, pinned when the session starts.
- `grad/interview.php?mode=general`: compatible entrance to the same personalized controller.
- `grad/interview.php?mode=demo`: five fixed English questions with scripted short-answer follow-ups.

The personalized flow loads `interview_general_v1`, selects two CV questions, two behavioural questions, and one situational question. Enabling industry awareness replaces the fifth question with a sourced policy question. CV generation receives the current profile through the consent filter; a deterministic daily question bank is used when generation fails. Each main question permits at most one contextual follow-up.

Personalized reports retain `interview_general_v1`, so they count toward existing five-year-plan interview milestones. The optional industry scoring dimension is included only after an industry question receives an answer. Existing qualifications, strengths, consent, policy cards, planning, opportunities and founder modules remain available.

## Speech and privacy

Browser speech is the default when MiniMax credentials are absent. Cantonese speech requires an installed Cantonese voice; unavailable Cantonese speech falls back to typing. The avatar has idle, listening, thinking and speaking states. Browser answers submit after transcript activity pauses; the manual submit button remains available.

Microphone recording remains on the page and can be downloaded. Enabling optional MiniMax uploads answer clips for transcription; the page explains this before recording. Speech metrics are transcript estimates and exclude typed answers. Report retries preserve answers on the page. No real paid speech or LLM requests were made by the integration verification.

The private `.env` and certificate directory were copied unchanged from the existing configured project for local use. Relative CA paths resolve from this new project root, with TLS verification enabled. Do not include `.env` in distributed archives.

## Local launch and checks

Run `start-v2-demo.cmd` to serve this directory on `http://127.0.0.1:8002` using the existing portable PHP installation.

From `engine`, run the ordinary tests and type check, then build the site with `SITE_DIR` explicitly pointing to this directory's `site`. On this Windows workspace, set `TEMP` and `TMP` to `Hackthon/tmp/v2-vitest` for Node commands.

Browser verification is opt-in: set `TP_BROWSER_TESTS=1`, set `PHP_PATH` to the portable PHP executable and run the Vitest browser suite. These tests use real Chrome microphone/recording APIs with simulated speech and model responses. PHP speech tests use a local HTTP server and a fake transport; no paid provider is called.

## Verified on 8 October 2026

- 102 engine and speech unit tests passed.
- 41 opt-in Chrome flow tests passed, including CV generation, consent filtering, industry scoring, plan linkage, recording, cleanup and fixed-demo language pinning through report retries.
- 49 PHP checks passed: 23 platform tests, 5 contextual interview tests and 21 speech adapter/HTTP tests.
- TypeScript checking, site build and syntax checks for all 34 PHP files passed.
- Independent specification and code-quality reviews passed.
- The original archive and the 110 tracked-by-inspection files in the previous project retained their SHA-256 hashes. Local configuration and certificate hashes match the previous project; the general scenario source and generated copy match.

The Windows sandbox cannot reliably start the PHP/Chrome test subprocesses; the browser and speech HTTP suites passed when permitted to run locally, without changing application behavior. Ordinary engine commands use the workspace temporary directory.

Manual checks still required: browser speech recognition on the actual Hong Kong demonstration network, installed Cantonese voices, and real MiniMax transcription/synthesis after credentials are added. The cloud adapter uses answer clips, not streaming or full-duplex conversation. No external deployment was performed.
