# rummy-rounds
Rummy Club: a responsive single-player draw/select/discard practice table using the existing 108-card Phase 10-style deck.

This build implements turn practice and saved rooms. Meld validation, special-card effects, scoring, authenticated seats and multiplayer are not implemented.
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

Download `rummy-frontend-build` for the static frontend and `rummy-visual-validation` for screenshots, state and test results. Browser checks exercise restart recovery, network failure, stale tabs, card reachability, sorting and offline practice. Room saves are excluded from artifacts and Git.

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
