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
- GitHub fork authorized by the user: scarlettcool/rummy-rounds. Develop on a reviewable branch.

### Deployment boundary

Use one backend process with a writable persistent volume and same-origin API proxy (or configure VITE_API_BASE_URL). Offline practice is intentionally not saved. This is not a completed multiplayer Rummy game; auth, melds, special-card effects and scoring remain separate work.
