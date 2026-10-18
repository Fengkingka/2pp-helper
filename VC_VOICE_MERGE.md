# VC voice interview merge — 17 October 2026

Base: this v3.3 FitCheck directory. Imported module: the approved v3.1-J1 investor-panel voice practice, not an older replacement for the whole website.

## Open the new module

Run `start-vc-demo.cmd` from this directory, then open:

http://127.0.0.1:8133/startup/vc-panel.php

The founder sidebar now has a separate **Voice investor interview / 語音投資者面試** entry. The existing **Hostile VC / Investor challenge** entry still opens the original three-question text exercise. Existing launchers and routes are retained.

The new page includes the supplied static investor portrait, three investor roles/six rounds, optional local PDF extraction, English/Cantonese speech, a visible three-second post-playback countdown, automatic answer capture, pause/continue, end/review/submit, local microphone download and founder-answer-only evaluation. Normal text-start/switch controls are hidden on the new page; transcript correction/recovery remains explicit. Speech configuration and team chat/evaluation routing use the existing private configuration unchanged.

## Preservation audit

356 of 371 original files remain byte-identical. These include `.env`, all examples, package manifests/lockfile, FitCheck and its PDF vendor tree, finance calculators, the original investor challenge page/script, graduate interview page/controllers and shared capture/recognition implementations. The source v3.1 directory and original uploaded zip were not edited.

Changed original files (only additive VC hooks, generated output or test compatibility):

- `engine/lib/content.ts`: register the new scenario/rubric.
- `engine/lib/plan.ts`: VC assessed-core average; unassessed demos do not count as scored milestones.
- `engine/scripts/build-site.mjs`: validate this project's generated-content targets before synchronization.
- `site/assets/js/engine.js`: rebuilt from the current v3.3 engine, not copied from v3.1.
- `site/api/evaluate.php`, `site/lib/Evaluator.php`, `site/lib/MockLlm.php`: VC-scenario-specific evaluation branch.
- `site/lib/Tasks.php`: add vc_panel without replacing founder_feedback or other tasks.
- `site/api/speech.php`, `site/lib/SpeechClient.php`: optional whitelisted role voices/status; no-speaker requests retain their previous settings.
- `site/includes/layout.php`, `site/assets/js/i18n-v32.js`: separate bilingual navigation entry.
- `site/assets/js/pages/reports.js`: VC-only assessed dimensions, labels, original quotes and disclaimer; existing FitCheck links, next actions and graduate job-description context retained.
- `site/tests/v32-dom.cjs`: portable Windows filename check in the test harness.
- `engine/tests/interview-browser.test.ts`: perform the already-existing transcript-confirmation step in one outdated retry test.

## Verification

| Check | Result |
| --- | --- |
| Engine unit tests | 136 passed |
| VC Chrome, including 3/2/1, cancellation, permission/replay/recovery, download, six rounds and PDF | 43 passed |
| Existing graduate Chrome | 49 passed |
| Original PHP | Core 23; J1 13; advisor routing 17; conversation 5; interview scoring 29; v3.2 5; FitCheck 36; speech 21 passed |
| Added PHP | VC contracts/scoring 5; VC speech/HTTP 25 passed |
| Existing Node helpers | J1 6; v3.2 5 passed |
| Original general DOM integration | 33 passed |
| FitCheck DOM + local fixture provider integration | 33 passed |
| TypeScript, PHP/JS syntax and site build | Passed |
| Real Chrome HTTP/UI smoke | Original investor exercise, FitCheck, graduate setup and new voice page passed |
| Visual inspection | Desktop and 375px, English/Chinese countdown; no horizontal overflow or page errors |

Speech/model tests use fake microphone devices and mocked/local fixture providers. No real MiniMax/DeepSeek request was made; physical microphone permissions, actual English/Cantonese voices and demonstration-network recognition still need a live pilot. Startup-script PHP discovery works on the current computer; teammates may need PHP installed or TP_PHP set to their executable.

When sharing, omit `.env`, `node_modules`, test caches and logs. Preserve the existing secret-free examples; teammates can run `npm ci` in engine if they need development/build tools. Both PDF vendor trees retain their licenses.
