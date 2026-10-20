# rummy-rounds
Rummy Club: a responsive single-player card lobby with a two-set challenge and free practice, using the existing 108-card Phase 10-style deck.

This build implements turn practice, saved rooms, natural-card grouping suggestions and a complete single-goal challenge loop. Full phase progression, special-card effects, tournament scoring, authenticated seats and multiplayer are not implemented.

## Single-player challenge

Choose **开始组牌挑战** in the lobby to start a saved challenge. Collect two disjoint groups of three equal-number cards (colors may differ); six of the same number can form both groups. Submit while holding ten cards, either from a lucky initial deal or after discarding. The server chooses and validates the six cards, saves the result, and then locks the room. The result reports completed draw/discard turns; the next-game button creates a separate challenge without changing the previous result.

Wild and skip cards can be discarded normally but do not substitute for numbers or activate special effects in this introductory challenge. Runs remain practice references and do not count toward the two-set goal.

Online and browser-side goal checks share the pure module in `backend/src/game/rules/challenge.ts`; Vite bundles it without any backend runtime dependencies. Existing snapshots without the optional `challenge` field continue as practice rooms. Completed proofs are validated against the actual saved hand on both server and client. Every action, including completion, requires the current revision; a failed or missing response requires an explicit resync.

The hand assistant suggests disjoint sets of at least three equal numbers and mixed-color runs of at least four consecutive numbers (1–12, without wrapping). It maximizes the number of covered cards, then prefers fewer groups; sorting the same hand keeps the suggestions stable. Clicking a suggestion highlights its cards without selecting a discard or changing the saved game. Wild/skip cards and phase objectives are excluded from these practice references.
## Getting Started
Make sure `npm` is installed.
```Shell
$ npm -v
```
### Backend
In the backend folder, install dependencies.
```Shell
$ cd backend
$ npm install
```

The backend listens on port 5000 by default. Optional variables in `backend/.env`:

```dotenv
PORT=5000
ROOM_DATA_DIR=/absolute/path/to/persistent/rummy-rooms
```

Without `ROOM_DATA_DIR`, rooms are stored in `backend/.data/rooms` when launched from `backend`. Use a writable persistent volume in deployment. A single backend process owns that directory; do not point multiple replicas at it. Atomic snapshot replacement protects interrupted writes. Storage failures stop the action and preserve the last acknowledged state.

Check that your setup worked by running the server.
```Shell
$ npm run dev
```

Vite proxies `/api` to port 5000 for development and preview. Set `API_PROXY_TARGET` when using another backend port. Production builds use same-origin `/api`; configure your reverse proxy accordingly, or supply `VITE_API_BASE_URL` at build time for a separate API host. A static host alone supports only the explicitly selected offline practice mode.

## GitHub build and visual checks

`.github/workflows/ci.yml` builds both applications, runs regression tests and validates real browser interactions on four viewport sizes. Browser tools are installed only on the GitHub runner; application dependency manifests and lockfiles are unchanged.

Download `rummy-frontend-build` for the static frontend and `rummy-visual-validation` for screenshots, state and test results. Browser checks exercise restart recovery, network failure, stale tabs, card reachability, sorting, offline practice and the complete challenge flow, including lost completion responses and next-room failures. Room saves are excluded from artifacts and Git.

### Frontend
In the frontend folder, install dependencies.
```Shell
$ cd frontend
$ npm install
```

Check that your setup worked by running the development server.
```Shell
$ npm run dev
```
