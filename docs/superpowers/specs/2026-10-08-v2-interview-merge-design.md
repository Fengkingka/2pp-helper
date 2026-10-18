# V2 interview merge design

The user approved using the uploaded v2 platform as the base and merging the previously implemented interview features. The archive and the previous working directory remain unchanged. This independent directory is the deliverable; there is no Git repository to commit or create a worktree in.

## Scope

- Preserve v2 policy cards, qualifications, strengths consent, plans, opportunities, founder modules and translations.
- Use the previous robust interview controller, browser voice, automatic answer submission, original four-state avatar, microphone recording, English/Cantonese metrics, report retry and optional MiniMax adapter.
- The default interview uses v2's general scenario: two CV-based questions, two behavioural questions, and one situational OR industry-awareness question. Industry awareness replaces question five, never creates question six.
- Retain the fixed English demo as an explicit secondary route. Preserve legacy general route compatibility.
- Pin interview and report language at start: English UI means English, Chinese UI means Cantonese. No Mandarin voice fallback. When no Cantonese voice is available, offer text.
- Generate CV questions using the existing v2 task; use v2 bank if unavailable. Carry role and conversation history into the previous contextual follow-up task; at most one follow-up per main question.
- Preserve policy source display and local strengths tip. Strengths are not sent to AI without explicit consent.
- The default report uses the general scenario ID so v2 plan progress continues to work. Set numeric industryQuestions only when that question has an actual submitted or end-committed answer; preserve v2 applicableRubric.
- Keep DeepSeek server-only configuration and existing certificate validation support. Copy local credentials without displaying them. Never include private .env in a shared archive.
- MiniMax remains optional and configuration-driven; absent credentials use browser speech. Do not claim streaming, full duplex, or tested real MiniMax access.
- Microphone audio is local unless the user selects the configured cloud transcription path. Coach speech is not mixed into downloads. Playback state drives the coach avatar; microphone level drives the user meter.

## Verification

Baseline: 66 engine tests and 23 PHP tests pass on the unmodified v2 base. Vitest TEMP/TMP must point to workspace tmp/v2-vitest because sandbox temporary module files otherwise disappear.

Merge acceptance: both v2 and previous interview tests pass, additional tests cover CV question generation, optional industry substitution/scoring, policy rendering, plan linkage, pinned language and consent preservation. Run TypeScript checking, site build, PHP syntax and browser flow tests. No actual paid provider call is required for merge verification. Document manual Hong Kong network and MiniMax voice checks still required.
