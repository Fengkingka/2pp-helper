# Interview scoring v2 — approved design

Approved by the user on 8 October 2026. This is coaching feedback, not a validated hiring selection instrument.

## Scope and sources

Upgrade the default/general personalized interview, preserving the fixed English demonstration, legacy reports, speech configuration and all other exercises. Use OPM's competency-based rating and equal-weight principles, CIPD's question-specific evidence and calibration principles, and the UK Civil Service's role-level expectations and acceptance of non-work experience.

- https://www.opm.gov/frequently-asked-questions/assessment-policy-faq/structured-interviews/how-do-i-score-a-structured-interview-how-do-i-assign-points-to-the-content-areas-and-rating-scale/
- https://www.cipd.org/en/knowledge/factsheets/selection-factsheet/
- https://www.gov.uk/government/publications/success-profiles/success-profiles-civil-service-behaviours

Our adapted rubric is not endorsed by these organisations. Personalised questions and dynamic follow-ups are not a standardised recruitment assessment.

## Matching

Offer an AI-assisted recommendation using existing CV experience titles, responsibility bullets and dates, plus the target role. Exclude name, contact details, school/organisation prestige, strengths questionnaire and other irrelevant personal data. Do not infer age, work duration, managerial seniority, or full-time status from graduation year or an ambiguous date string.

Return `track` (`graduate`, `experienced`, or `unknown`), `reason`, verifiable experience evidence, and the existing `source` (`ai` or `fallback`). No evidence, ambiguous internships versus employment, and career transitions must not be forcibly classified. The fallback can recommend a track only on explicit experience clues; otherwise ask for confirmation. The user confirms or overrides the track before starting; late recommendation responses cannot change a manual selection or active interview. Existing CV dates are read directly from the browser's CV store without modifying UserProfile.

## Rubrics

Create two versioned engine source rubrics with complete 1–5 anchors for: `relevance` (question/role relevance), `ownership` (specific personal actions), `judgement` (analysis and decision-making), `outcomes` (outcome/validation/reflection), and `clarity` (text clarity). Include optional `industry` when answered, but do not include it in the core mean.

Graduate expectations accept coursework, placements, volunteering and transferable skills. Experienced expectations focus on independent responsibility, trade-offs and impact appropriate to the target role, never automatic management expectations. Qualitative outcomes count. A failed project is not automatically a poor answer. Situational answers require proposed steps, reasoning and how success would be checked, not fabricated past results. STAR is a helpful structure, not a mandatory verbal formula.

## Evaluation and compatibility

Keep SessionLog and EvaluationReport schemas unchanged. Send validated scoring context as an optional sibling of `log` in `/api/evaluate.php`; pin selected track, target role, version, and answered question categories when starting and keep them for retries. Look up role descriptions from existing role cards where possible; do not trust client-supplied rubric IDs or weight instructions. Unknown role titles remain explicitly limited context.

For v2 scoring only, request each dimension's 1–5 score, verbatim user-answer evidence, rating rationale, actionable suggestion and an explicit distinction between rated performance and insufficient assessment opportunity. Preserve existing legacy evaluator behaviour outside v2. CV information is classification context, never interview-answer evidence. Any unsupported quotation is removed and flagged, and must not establish a high score without verifiable support.

Use numeric metrics for version, track, rated/unrated dimension flags and program-calculated core mean. Keep rating rationale in existing suggestion text or local report metadata; do not introduce shared schema fields. Unrated dimensions retain a numeric compatibility placeholder but display as 'insufficient evidence', not 1/5; exclude them and industry from the mean. If no core dimensions are rated, show no average and do not count that report as a scored plan milestone. Legacy report averaging remains unchanged.

## Reporting and privacy

Show selected track, rubric version, role context, core mean (1–5), rated coverage, optional industry feedback, source quotes and concrete next steps in English or Traditional Chinese. Explain that only text content is assessed; no pronunciation, accent, personality, confidence or demographic inference. All same-track and cross-track reports are practice feedback, not a candidate ranking. Raw CV is not stored with the report; only bounded non-sensitive matching reason may be kept locally.

## Acceptance

Test AI and fallback recommendations, unsupported classification evidence, malformed replies, ambiguous resumes, manual override, cancellation and start/retry pinning. Test both full rubrics, situational and qualitative-result rules, CV-versus-answer evidence boundaries, optional industry exclusion, unrated averages/plan behaviour, legacy compatibility, bilingual report labels and unchanged microphone lifecycle. Use fake providers for automated tests; do not make paid API calls. Finish with all engine, Chrome and PHP suites, type checks, syntax checks and build-source synchronisation. Document calibration examples as pending team review, not proof of scoring validity.
