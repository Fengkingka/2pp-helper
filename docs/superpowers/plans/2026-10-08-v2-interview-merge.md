# V2 interview merge implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. This is one integration task followed by independent specification and quality reviews.

**Goal:** Deliver the v2 platform with the previous interview functionality without losing v2 features.

**Architecture:** Keep v2 as the canonical base. Port existing independent voice modules and surgically combine shared APIs, tasks, schemas, layout, report metrics and interview entry points. Use the general scenario ID for the default route so existing plan progress continues to count reports.

**Tech Stack:** PHP, JavaScript, TypeScript, Vitest, Playwright, Web Speech, optional MiniMax, DeepSeek-compatible chat API.

## Task 1: Merge and test the interview integration

Source: `../../training-platform-bilingual-merged/training-platform` (resolve relative to workspace explicitly).
Target: `C:/Users/Makka Pakka/Desktop/Hackthon/training-platform-v2-merged/training-platform`.

- [x] Extract the v2 archive into an isolated directory, excluding macOS and IDE metadata. Preserve the archive.
- [x] Reuse installed dependencies by directory junction; verify v2 baseline (66 engine, 23 PHP).
- [x] Inspect old interview controller, modules, assets and PHP changes. Identify additive changes to shared files before editing.
- [x] Write integration tests first. On v2 they must fail because the merged controller/voice modules/task do not exist. Include assertions that questions total five, CV questions come from the v2 task, industry replaces the fifth question, and reported scenario ID remains `interview_general_v1`.
- [x] Run the failing tests using workspace TEMP/TMP and record expected failures.
- [x] Port independent voice/demo/capture modules, avatar assets and existing tests using apply_patch. Port source scenarios and schema fields before the site build.
- [x] Merge the robust controller with v2 question selection, policy source display and strength tip. Preserve at-most-one follow-up, generation guards, retry, transcript commit, correct recording extension and microphone cleanup.
- [x] Extend v2 Tasks with contextual interview task; preserve plan_draft and privacy logic. Merge server speech adapter, configuration, CA validation and demo evaluation behavior without replacing v2 optional rubric filtering.
- [x] Extend app API with optional pinned language argument, while retaining v2 strengths filtering. Extend reports metrics without removing average score, plan linkage or policy cards. Extend layout translations/assets without removing v2 islands.
- [x] Copy local .env and CA bundle without printing credentials; merge only missing public configuration defaults.
- [x] Run regression tests, typecheck, build:site, PHP test suites and syntax checks. Run real browser tests with simulated provider boundaries and actual browser media recording.
- [x] Address failures with a reproducing test before implementation.

## Task 2: Independent reviews

- [x] Specification reviewer checks every design requirement against actual code, with particular attention to five-question composition, plan scenario IDs and strengths consent.
- [x] Resolve findings, rerun tests, and repeat specification review.
- [x] Quality reviewer checks lifecycle races, rendering safety, API errors, secrets handling and maintainability.
- [x] Resolve findings, rerun tests, and repeat quality review.

## Task 3: Handoff

- [x] Add an English merge note with exact local startup instructions and verification evidence; state real MiniMax/Hong Kong speech-network checks are outstanding.
- [x] Supply a local launcher using the installed portable PHP runtime where available, leaving old launchers unchanged.
- [x] Verify original archive hash and old project files unchanged. Share only the merged directory and startup instructions; do not distribute .env.

## Commands

Run inside target engine, using the installed Node executable and workspace TEMP/TMP:

```powershell
$env:TEMP = 'C:\Users\Makka Pakka\Desktop\Hackthon\tmp\v2-vitest'
$env:TMP = $env:TEMP
& 'D:\claude code\node.exe' '.\node_modules\vitest\vitest.mjs' run
& 'D:\claude code\node.exe' '.\node_modules\typescript\bin\tsc' -p .
& 'D:\claude code\node.exe' 'scripts/build-site.mjs'
```

Run PHP suites inside the target root:

```powershell
& 'C:\Users\Makka Pakka\Desktop\Hackthon\training-platform\tools\php\php.exe' site/tests/run.php
& 'C:\Users\Makka Pakka\Desktop\Hackthon\training-platform\tools\php\php.exe' site/tests/conversation.php
& 'C:\Users\Makka Pakka\Desktop\Hackthon\training-platform\tools\php\php.exe' site/tests/speech.php
```

No Git repository is present. Do not initialize a repository or commit credentials merely to satisfy workflow boilerplate.
