Original prompt: 继续h5rummy的开发

## 2026-10-20

- Converted the Rummy table from a static hand into a local draw/select/discard turn loop.
- Fixed the game info controller so generated `room-*` ids are accepted.
- Verified frontend build, backend TypeScript build, and 11 backend unit tests.
- Added `window.render_game_to_text` and `window.advanceTime` hooks for browser validation.
- Added in-memory room state APIs for create, read, draw, and discard.
- Connected online room pages to those APIs with an offline fallback.
- Added controller coverage for a complete draw/discard turn.

### Next

- Persist rooms beyond a backend restart when a storage layer is introduced.
- Add multi-player turn ownership and websocket updates.

## UI and stability pass — 2026-10-20

- Stabilize: unique room ids; per-room atomic file snapshots; stale-revision checks; safe discard validation; exhausted-pile recycling. No action is acknowledged before storage completes.
- Modularize: extracted room persistence, typed/validated API requests, card vocabulary and reusable card/help/icon components.
- UI: conventional card-club lobby and centered felt table, colored 1–12 cards, stable card selection while sorting, mobile overlapping hand, honest single-player state, native keyboard-accessible help dialog, reduced-motion support.
- Automate: GitHub workflow now includes responsive screenshots and recovery smoke tests. Playwright stays in an isolated runner directory; no application dependency changes.
- Reuse: GameCard, GameHelp and API validation are local reusable modules. A larger framework or skill extraction is deferred until another game needs these patterns.
- Removed implicit online-to-offline action fallback. A failed request blocks actions until an explicit successful resync. Offline mode must be selected by the user.
- Local checks: 20 backend tests, 8 frontend tests. GitHub build and all browser flows passed: https://github.com/scarlettcool/rummy-rounds/actions/runs/39439297012
- Downloaded and visually inspected desktop, 390px mobile, 320px mobile, landscape, native help dialog, and the develop-web-game client screenshot; no page errors were recorded.
- Visual review follow-up: settle layout transitions before screenshots, keep later hand cards reachable while another is selected, replace the skip glyph with SVG, and fit landscape table/actions within a 390px-high viewport. The workflow reruns on the follow-up push.
- Final code revision `78b6f4b` passed GitHub build, all 28 unit tests and the complete four-viewport browser suite: https://github.com/scarlettcool/rummy-rounds/actions/runs/39442248930
- Visually inspected the final screenshots after the animation, selection and landscape fixes. The 844×390 table fits fully without scrolling; 320px and 390px hands remain reachable, including directly switching selection. Final screenshots/results are downloaded under `output/review/final-78b6f4b/` (ignored local QA artifacts).
- GitHub fork authorized by the user: scarlettcool/rummy-rounds. Develop on a reviewable branch.

### Deployment boundary

Use one backend process with a writable persistent volume and same-origin API proxy (or configure VITE_API_BASE_URL). Offline practice is intentionally not saved. This is not a completed multiplayer Rummy game; auth, melds, special-card effects and scoring remain separate work.

## Natural-card hand assistant — 2026-10-20

- Stabilize: add bounded, pure natural-card analysis for a maximum 11-card hand. Enumerate valid same-number sets (3+) and mixed-color consecutive runs (4+, no wrapping); choose disjoint groups with maximum coverage, then fewer groups. Wild/skip cards and phase objectives stay outside the reference rules.
- Modularize: keep the evaluator independent of Vue, API requests and saved-room state. Highlighting suggestions never selects a discard or submits an action; sorting preserves highlights, authoritative state updates clear them.
- UI: add compact emerald-outlined group highlights, keyboard-operable reference chips and a covered-card count. Preserve the cream cards and club table layout, including narrow phones and landscape.
- Automate: add boundary, greedy-counterexample, deterministic sample and interaction tests; extend GitHub browser QA with fixed hand fixtures on all four viewports, highlight/card reachability, keyboard use and action visibility.
- Framework/reuse: export typed analysis results for future objectives and scoring UI. Formal meld submission and any persistent schema changes remain separate increments; no dependency changes or broad refactor in this pass.
- Local validation: all 19 frontend unit tests, TypeScript checks and production build passed; browser-script syntax and Git whitespace checks passed. GitHub backend/full-browser verification and actual screenshot review pending.
- Final code `3dddf8a` passed GitHub frontend/backend builds, all 39 unit tests, four-viewport live-browser checks and the develop-web-game client: https://github.com/scarlettcool/rummy-rounds/actions/runs/39446281340
- Downloaded artifacts to `output/review/hand-assistant-3dddf8a/` (ignored). Visually inspected desktop, 390px, 320px and 844×390 suggestion screenshots, narrow-screen empty suggestions, mobile/landscape help and the action-client screenshot. Green group outlines remain distinct from the raised gold discard selection; all card hit targets and landscape controls remain reachable. Browser page errors: `[]`.
- Remaining boundaries: practice references do not implement a complete phase objective or win condition. Formal meld submission, wild/skip effects, scoring and multiplayer need separate designed/tested increments. Existing single-backend-process persistent-volume requirement still applies.

## Durable single-player challenge loop — 2026-10-20

- User delegated the implementation choice for a stable publishable lobby after the explicit optional-schema proposal. Chosen approach: preserve old/free-practice rooms and add an explicit saved challenge mode; do not infer completion only in the browser.
- Stabilize: optional `challenge` discriminated state, current-revision submission, server-derived proof, write-before-response, immutable completed rooms, fail-closed proof validation and unchanged 108-card conservation/10–11-card turn invariants. A next game creates a new room and preserves the previous result.
- Modularize: shared pure numeric-goal rules in `backend/src/game/rules/challenge.ts`, consumed by the browser through a narrow Vite/TypeScript alias; no new package or dependency change. Separate result component; existing persistence and API boundaries retained.
- Product loop: lobby challenge entry → two natural three-card sets → discard to ten cards → submit → saved result with completed turn count → next room. Six equal numbers may form both groups. Wild/skip effects, complete phase progression and competitive scoring stay explicitly outside this introductory mode.
- Automate: legacy snapshots, goal edge cases, failed saves, duplicate actions, corrupted proofs, response validation, lobby mode selection, completion/network recovery, route races and replay tests. Browser QA covers real backend completion, a saved-but-lost response, restart recovery and failed next-room creation on four viewports. Test fixture seeding stays in the script; no seeding endpoint is shipped.
- Framework/reuse: reuse the pure rule/result interfaces rather than rewrite the game engine. Larger progression, multiplayer and extraction remain separate stages.
- Local validation: both builds and frontend TypeScript checks passed; 30 backend + 31 frontend tests passed, including old-backend mode mismatch detection. Git whitespace and browser-script syntax checks passed. GitHub browser/screenshot review pending.
- Initial code `b134fbd` passed all GitHub stages and full four-viewport challenge flow: https://github.com/scarlettcool/rummy-rounds/actions/runs/39450877005 . Downloaded/reviewed lobby, challenge goal/result and action-client screenshots under `output/review/challenge-b134fbd-retry/`; no browser page errors. Visual follow-up: keep the longer help dialog's acknowledgment button visible with a sticky footer, and verify click-to-close plus Escape on all four viewports.
- Final code `74f01e6` passed both builds, all 61 unit tests, four-viewport browser flows, sticky-help visibility/click/Escape checks and the action client: https://github.com/scarlettcool/rummy-rounds/actions/runs/39452487530 . Final artifacts are downloaded under `output/review/challenge-final-74f01e6/`; visually reviewed mobile/narrow/landscape help and mobile/landscape result pages after the follow-up. Page errors remain `[]`.
- Verified on 2026-10-21: code and records are on the authorized fork branch; no deployment, merge or public release has been performed. Existing unused `frontend/public/assets/` remains untouched. Public deployment, persistent-volume backup/restore drills and real-device acceptance remain release work; this single-goal mode is not a full phase tournament or multiplayer game.

## Release and profitability review — 2026-10-21

- User explicitly set stable commercial release and profitability as the acceptance goal and requested repeated review.
- Added `RELEASE_READINESS.md` and linked it from README: distinguish internal demo, invited testing, public commercial launch and evidence of profitability. Current verdict: validated introductory single-player build, not ready for public commercial launch; no profitability evidence.
- Reconfirmed GitHub run `39452487530` is completed/success for code `74f01e6e19b6e2e2949cfef557debd03d8ae2412`. Existing 61-test/four-viewport evidence remains valid for that code; this pass changes documentation only, so code tests were not rerun.
- Recorded explicit gates for product/rule positioning, replay value, deployment/recovery/capacity, access boundaries, real devices, commercial asset rights, actual monetization and measurable unit economics. Unknown items are marked unverified rather than asserted safe or defective.
- Proposed free play/rewarded ads and later cosmetics for evaluation; no SDK, dependency, payment, auth, save-schema, production deployment or spending changes. Multiplayer and full phase progression are not assumed mandatory for a deliberately scoped single-player launch.
- Created active daily heartbeat `h5rummy` in this conversation. Review is targeted/read-only, quiet without meaningful change, and reports changed readiness, blockers, failed checks or decisions; it does not automatically deploy or spend.
- Next: define the first-release single-player content and channel, then a measurable, recoverable invitation test before selecting monetization integration or paid acquisition. Existing unused public assets remain untouched.
