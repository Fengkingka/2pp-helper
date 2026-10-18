# Dual-track interview scoring implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver CV-assisted, user-confirmed graduate/experienced coaching rubrics and evidence-based bilingual reports without changing shared schemas.

**Architecture:** Add a focused PHP interview-scoring helper and versioned source rubrics. Existing Tasks and evaluation routes delegate only personalized interview v2 behaviour. The current controller pins context and the report/plan code consumes numeric coverage and mean metrics while legacy reports remain unchanged.

**Tech Stack:** PHP, JavaScript, TypeScript, JSON, Vitest, Playwright/Chrome; current build pipeline.

No Git repository exists. Work only in the independent merged directory; do not create another workspace or claim commits. User approved this design and immediate execution. Use a single implementation worker, then independent specification and quality reviewers.

## Task 1: Integrated scoring upgrade

**Files:** create `site/lib/InterviewScoring.php`, `engine/rubrics/interview_graduate_v2.json`, `engine/rubrics/interview_experienced_v2.json`, `site/tests/interview-scoring.php`, and feature tests. Modify only required portions of `site/lib/Tasks.php`, `site/lib/Evaluator.php`, `site/lib/MockLlm.php`, `site/api/evaluate.php`, `site/grad/interview.php`, `site/assets/js/pages/interview-english.js`, `site/assets/js/pages/reports.js`, bilingual strings, and `engine/lib/plan.ts`. New browser/helper files are allowed only for focused feature responsibilities. Shared `engine/lib/types.ts` schemas and private `.env` must remain unchanged.

- [x] Write failing tests for classification, privacy, both five-level rubrics and score aggregation before production changes. Representative core aggregation assertion:

```ts
expect(reportScore({ scenarioId: 'interview_general_v1', createdAt: '2026-10-08', report: {
  dimensions: [{ score: 4 }, { score: 1 }],
  metrics: { rubricVersion: 2, coreAverage: 4, coreRated: 1 }
} })).toBe(4);
```

- [x] Run the relevant new tests and confirm feature-related failures. Node command from `engine`, using workspace TEMP/TMP:

```powershell
& 'D:\claude code\node.exe' '.\node_modules\vitest\vitest.mjs' run tests/interview-scoring.test.ts
```

- [x] Implement bounded CV-only matching, unknown fallback, evidence validation, strict track selection, role-card lookup and v2-only prompt rules. Request context shape:

```js
api('evaluate.php', { log: state.log, interviewContext: state.interviewContext }, state.language);
```

- [x] Add complete dual source rubrics. Retain existing `interview_v1` for legacy/demo callers. Include `industry` via the existing `requiresMetric` convention.
- [x] Implement v2-only rated flags and program mean. Example numeric metrics contract:

```js
{ rubricVersion: 2, interviewTrack: 1, coreRated: 5, coreAverage: 3.8,
  assessed_relevance: 1, assessed_ownership: 1, assessed_judgement: 1,
  assessed_outcomes: 1, assessed_clarity: 1 }
```

`interviewTrack` is 1 for graduate and 2 for experienced. Document final metric names consistently in tests and feature notes. Zero assessed means no displayed average; do not treat a placeholder score as candidate performance.

- [x] Add recommendation/review controls in the idle personalized interview only. Test privacy-sanitized request data, manual selection while request pending, no starting without confirmed track, generation guards, and identical context on report retry.
- [x] Update bilingual reports to show the confirmed standard/version, dimension reasons, coverage and non-recruitment disclaimer. Keep the current chart for rated scores and show unrated dimensions without numeric placeholder scores.
- [x] Make reportScore and plan progress use v2 core means, excluding unscored reports. Test old reports and startup scenarios still use their original mean.
- [x] Add browser regression cases with simulated classification, follow-up and evaluation responses; never use paid endpoints. Update existing personalized tests to confirm track; retain original assertions about privacy, industry, language pinning and cleanup.
- [x] Run focused tests to green and perform self-review. Report changed files, observed red failures, green evidence and remaining manual limitations.

## Task 2: Independent review and verification

- [x] Specification reviewer reads actual changes against the complete design above; fix and re-review all gaps.
- [x] After specification approval, quality reviewer checks safety, lifecycle, averaging, compatibility, privacy and real test coverage; fix and re-review important findings.
- [x] Root runs fresh complete suites and TypeScript checking, then validates explicit generated directories before site build:

```powershell
$env:TEMP='C:\Users\Makka Pakka\Desktop\Hackthon\tmp\v2-vitest'
$env:TMP=$env:TEMP
$env:TP_BROWSER_TESTS='0'
$env:SITE_DIR='C:\Users\Makka Pakka\Desktop\Hackthon\training-platform-v2-merged\training-platform\site'
& 'D:\claude code\node.exe' '.\node_modules\vitest\vitest.mjs' run
& 'D:\claude code\node.exe' '.\node_modules\typescript\bin\tsc' -p . --noEmit
& 'D:\claude code\node.exe' 'scripts/build-site.mjs'
```

Run browser tests separately with `TP_BROWSER_TESTS=1` and portable `PHP_PATH`; run PHP base, conversation, speech and new scoring tests with the portable PHP executable. Local Chrome/PHP subprocesses require permitted unsandboxed execution. No provider calls are made.

- [x] Confirm private `.env` hash remains `E9BBA2C17EF88B7CEDCD373E134798B28D9C7C8C9E4116F3235ED8D2F06F8EFD`, generated rubrics match source, and PHP syntax passes.
- [x] Document source references, actual verified totals, classification limitations, and clearly labelled pending human calibration examples. Hand off the live local page without altering API credentials.
