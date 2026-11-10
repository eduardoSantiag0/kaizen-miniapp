# Kaizen Mini App

Angular frontend for the Kaizen Companion Telegram Mini App. Users receive
KataGo-analyzed Go games through the Kaizen Companion Telegram bot and open
them here to drill their biggest mistake against KataGo's recommended line.

The backend (Java / Spring Boot / PostgreSQL / KataGo, in the sibling
`../kaizan-companion` repo) is immutable from this project's side — this app
only ever consumes documented backend contracts, never invents one.

## Current scope

The MVP is the judged **Exercise screen**: the user is dropped at their
biggest mistake, must find KataGo's move, and holds KataGo's line for 5 of
their own moves, with Correct/Incorrect feedback and haptics. It is built and
reviewed; the Games (root) list/menu is next in the build order and not
implemented yet.

Out of scope for now:
- `/practice` session mode (multiple exercises in one sitting).
- Live KataGo analysis — all analysis is precomputed and stored; the frontend
  never calls KataGo.
- Any new backend endpoint implemented by this team. The real HTTP endpoint
  exposing `GameHistoryDto`/SGFs is being built independently; this app
  develops against local fixtures until it exists (see **Mock data** below).

## Tech stack

- **Angular 20** (standalone components, signals, zoneless-friendly patterns).
- **Sabaki ecosystem** for the board: `@sabaki/shudan` (rendering, via Preact),
  `@sabaki/sgf` (parsing), `@sabaki/go-board` (rules/legality), isolated from
  Angular's change detection behind a dedicated adapter component.
- **Telegram Mini App SDK** (`telegram-web-app.js`), wrapped in
  `TelegramService` so the rest of the app degrades gracefully outside a real
  Telegram WebView.

## Project structure

```
src/app/
  board/      Shudan/Preact adapter + board theming (goban-theme.scss)
  core/       TelegramService, ThemeService, SafeAreaService
  data/       GameHistoryService (mock implementation today)
  exercise/   ExercisePage, its state machine, and child components
  sgf/        SGF parsing helpers
  shared/     Decorative/shared pieces (paper background, waves, stone dot)
games_test/   Placeholder SGF triplets (opening/middlegame/endgame) used as
              mock data until the real backend endpoint exists
docs/
  design-handoff/kaizen-handoff/HANDOFF.md   Design source of truth
  backend-contract/                           Backend contract notes (read-only
                                               audit of the existing backend;
                                               no new endpoints implemented here)
```

## Getting started

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

Outside a real Telegram WebView, `TelegramService` falls back to sane
defaults (dark theme, no BackButton, no haptics) so local development works
unmodified.

### Build & test

```bash
npm run build       # production build, output in dist/kaizen-app
npm test            # ng test, Karma + Chrome Headless
```

When testing manually, prefer a production build (`ng build` + serve
`dist/kaizen-app`, or `ng serve --configuration production`) over the raw dev
server — the unminified dev bundle is roughly 17x larger and will feel
slower for reasons that have nothing to do with the app's actual runtime
performance.

## Mock data

There is currently no backend endpoint exposing analyzed games to a browser
client. `GameHistoryService` is built against a mock backed by the fixture
SGFs in `games_test/`, shaped to match the real backend's `GameHistoryDto`
record (`id`, `correlationId`, `openingAnalysed`, `middlegameAnalysed`,
`endgameAnalysed` — each `*Analysed` field is raw SGF text for that phase).
Swapping in the real endpoint once it exists should be a one-provider change.

The fixture SGFs don't tag which move is "the mistake" or which continuation
is "KataGo's line" — that distinction is a mock-only convention documented in
`src/app/exercise/exercise-line.ts`, not a real contract guarantee.

## Deployment

Target host is Vercel (static SPA). `vercel.json` is already set up:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/kaizen-app/browser",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

No SSR is configured — this is a plain client-side Angular build (confirmed:
no `server.ts`/`main.server.ts`, no `server` architect target). The rewrite
exists for the Angular Router already wired in `app.routes.ts`, even though
today there's only one route.

This is setup only, not a live deployment. Going live still needs: the repo
pushed to a git remote Vercel can see (or a direct `vercel` CLI deploy from
local), and a Vercel project actually connected to it — neither has happened
yet, and shouldn't without explicit approval.

## Known quirks

- `@sabaki/sgf` unconditionally requires Node's `fs` (and optionally
  `iconv-lite`/`jschardet`) in a code path this app never exercises. `fs` is
  stubbed via a local `vendor/empty-fs` package referenced in
  `package.json`, and a `postinstall` script
  (`scripts/stub-sgf-node-deps.js`) patches the two nested optional
  dependencies after every `npm install`. All three stubs are trivial empty
  modules — see `vendor/`.
