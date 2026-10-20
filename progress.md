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
