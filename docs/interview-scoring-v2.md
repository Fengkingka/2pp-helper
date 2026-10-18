# Interview scoring v2

## Scope

The personalised interview supports graduate and experienced practice standards. A CV-based recommendation is advisory: the user must confirm or override the standard before starting. Ambiguous experience is labelled unknown, not silently assigned. Experience alone does not imply a managerial role.

The fixed English demo, legacy reports and other exercises retain their existing scoring. This upgrade does not change speech providers or credentials.

## What is assessed

Both standards use five equally weighted core dimensions, each with explicit 1–5 anchors: relevance, ownership, judgement, outcomes and clarity. Optional industry-awareness feedback is separate from the core mean.

Graduate examples can come from coursework, placements, volunteering or other transferable experience. Experienced examples are judged against independent responsibility, trade-offs and impact appropriate to the target role. Qualitative outcomes and learning from unsuccessful work are valid evidence. Situational answers are assessed on proposed actions, reasoning and validation, not on invented completed results. STAR is a helpful structure, not a mandatory formula.

Only interview-answer text is scoring evidence. CV details select context and the recommended standard; they cannot establish interview scores. Text transcripts cannot establish pronunciation, accent, intonation, personality or confidence. Longer answers and the mere presence of numbers do not automatically earn higher scores.

Insufficient assessment opportunity is distinct from weak demonstrated performance. Unrated dimensions are excluded from the core mean. Reports with no rated core dimensions have no overall score and do not complete scored plan milestones. Other reports retain their previous averaging behaviour.

## Sources and limits

This is a team-authored coaching rubric informed by the following principles, not an official assessment from these organisations:

- [OPM: structured interviews](https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/) — predefined competency questions and anchored ratings.
- [OPM: scoring and weighting](https://www.opm.gov/frequently-asked-questions/assessment-policy-faq/structured-interviews/how-do-i-score-a-structured-interview-how-do-i-assign-points-to-the-content-areas-and-rating-scale/) — equal weighting unless there is a documented reason to do otherwise.
- [UK Civil Service: behaviours](https://www.gov.uk/government/publications/success-profiles/success-profiles-civil-service-behaviours) — role-level expectations and evidence from non-work activities.
- [CIPD: selection methods](https://www.cipd.org/en/knowledge/factsheets/selection-factsheet/) — predefined evidence criteria and consistent assessment.

Personalised questions and adaptive follow-ups do not provide a standardised basis for ranking applicants. The two standards are not interchangeable hiring thresholds. AI ratings are practice feedback requiring human review, not a validated recruitment decision.

## Pending human calibration

Automated checks establish software behaviour, not rating validity. The team should independently rate the same consented or fictional answers, compare disagreements and refine anchors before making claims about scoring reliability. This calibration has not yet been performed.

Suggested review cases (these are not prevalidated model answers):

| Case | What reviewers should check |
| --- | --- |
| Graduate coursework with clear individual actions and qualitative peer feedback | Coursework is accepted; a missing numeric result is not an automatic penalty. |
| Experienced individual contributor explaining a trade-off and its consequences | Independent judgement is recognised without demanding management responsibilities. |
| A project that failed, with a clear diagnosis and a subsequent change | Failure alone does not determine the score; reasoning and learning matter. |
| A hypothetical first-week problem with proposed steps and success checks | No fabricated past achievement is required. |
| A fluent but vague answer about what “we” did | Fluency cannot substitute for evidence of personal contribution. |
| No question or follow-up elicited a particular competency | Insufficient opportunity is distinguished from a demonstrated poor answer. |
| Ambiguous CV dates or a career change | The recommendation remains uncertain or is overridden by the user. |
| The same answer expressed in English and Traditional Chinese | Content standards stay consistent; accent is not inferred from text. |

Use fake providers for automated regression tests. Real DeepSeek scoring, physical microphone behaviour and human calibration require a separate, explicitly authorised pilot.

## Integration contract

Shared `UserProfile`, `SessionLog` and `EvaluationReport` schemas are unchanged. The new context is sent beside `log` to `/api/evaluate.php`, not inside the answer transcript:

```json
{
  "interviewContext": {
    "version": 2,
    "track": "graduate",
    "confirmed": true,
    "role": "Marketing Analyst",
    "categories": ["cv", "behavioral", "situational"],
    "answeredCategories": ["cv", "behavioral"]
  }
}
```

The server selects the rubric and resolves role descriptions from existing role cards. Client-provided rubric IDs, weights and scoring instructions are not accepted as authority. The controller pins context before starting and retains it for report retries. Raw CV data is not included in saved reports.

Numeric report metrics include `rubricVersion: 2`, `interviewTrack: 1` (graduate) or `2` (experienced), `coreRated` (0–5), and `assessed_<dimension>` (0 or 1). `coreAverage` exists only when at least one core dimension is rated. Server-calculated `roleContextMatched` is 1 for an existing role-card match and 0 otherwise; unmatched roles explicitly have limited title/answer context, not verified job duties. The storage score for an unrated dimension is a compatibility placeholder; the report must display insufficient evidence, not that number. Rationale and next steps use the existing `suggestion` field. Evidence quotes retain the exact original wording and language, including across interface-language changes.

Source rubrics live in `engine/rubrics/interview_graduate_v2.json` and `engine/rubrics/interview_experienced_v2.json`; the existing build pipeline copies them into the website data directory. Never update only the generated copies.

## Verified delivery — 8 October 2026

- 108 engine tests passed; the 49 opt-in browser cases were run separately and all passed in local Chrome with simulated speech/model events and fake microphone input.
- 78 PHP checks passed: 23 existing checks, 5 conversation checks, 29 scoring checks and 21 speech checks.
- TypeScript checking, all 36 PHP syntax checks and the website build passed. Both generated scoring rubrics match their source files.
- 15 existing local pages returned HTTP 200. The default interview page includes track selection and explicit confirmation.
- Independent specification and code-quality reviews passed after focused fixes. Regression tests cover malformed scores remaining unassessed, original quotes surviving interface-language switches and stale recommendations being ignored.
- Private configuration, shared schemas and existing speech helper/API files are unchanged. No paid provider calls were made for this delivery.

Open the running local site at `http://127.0.0.1:8002/grad/interview.php`, refresh, choose a target role, review or override the recommendation, and confirm the track before starting. A recommendation is not permission to treat the result as a hiring decision. Real model calibration and physical microphone/network validation remain separate pilot work.
