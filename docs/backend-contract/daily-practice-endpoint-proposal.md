# Daily Practice endpoints — proposal (NOT IMPLEMENTED)

Status: **frontend-only, built against this proposed contract — the backend
is being implemented separately by hand, not by Claude.** This mirrors how
`resign-endpoint-proposal.md` was written before its backend existed: every
route/shape below is a target for the real `kaizan-companion` implementation
to match, not something already live. The frontend's
`PracticeService` abstract class, `MockPracticeService` (session-local, no
network — used today) and `HttpPracticeService` (calls the routes below,
currently unused in `app.config.ts` until the real backend exists and
`environment.useRealBackend` is flipped, same switch `GameHistoryService`
already uses) are built so flipping that switch is the only step left once
the backend matches this doc.

Comes from the RF03 "Kaizen Daily Practice" requirements doc: up to 5
exercises/day pulled from the user's own analysed games, reusing
`ExerciseTree` (see `exercise-tree.ts` and this repo's other backend-contract
docs for why real backend SGF data has no "mistake" branch — only KataGo's
own ranked candidates).

## 0. Auth (identical to every other Mini-App-facing route)

Every route below uses the exact pattern `MiniAppController` already uses
for `GET/DELETE /kaizan/api/v1/katago/history`: header
`Authorization: tma <initData>`, validated via
`TelegramInitDataService.validateAndGetUserId(initData)`, then the resulting
Telegram user id is looked up directly as `TelegramChatEntity`'s id (valid
for private 1-on-1 bot chats, same assumption `MiniAppService` already
makes).

## 1. Routes

All under a new `/kaizan/api/v1/practice` base — a new `practice` module/
package, kept separate from the analysis pipeline per RF03's own technical
constraints ("Implementar um módulo `practice` separado da análise de
partidas").

### `GET /practice/today`

Returns today's session if one already exists for the requesting chat, or
`204 No Content` (no body) if the chat hasn't started one yet — the frontend
treats that as "no session" and offers Start Practice instead of Continue.

```json
{
  "date": "2026-11-24",
  "completed": false,
  "exercises": [
    {
      "id": "ex-1",
      "gameId": "<uuid>",
      "phase": "opening",
      "completed": true,
      "opponentName": "kitsune77",
      "opponentRank": "4k",
      "boardSize": 19,
      "userSign": 1,
      "moveNumber": 75
    },
    {
      "id": "ex-2",
      "gameId": "<uuid>",
      "phase": "middlegame",
      "completed": false,
      "opponentName": "someone",
      "opponentRank": "2d",
      "boardSize": 19,
      "userSign": -1,
      "moveNumber": 118
    }
  ]
}
```

- `phase` is `"opening" | "middlegame" | "endgame"` — `GameHistoryDto` itself
  has no `phase` field (just three separate nullable per-phase SGF strings);
  this reuses the frontend's own `GamePhase` type (`game-history.model.ts`),
  which already names the three phases this way, so the backend should match
  that lowercase convention rather than inventing a new one.
- `gameId` is whatever id the Mini App already uses to fetch that game's SGF
  via the existing `GET /history` (so `GameHistoryService.getGameHistory(gameId)`
  — already implemented — works unmodified for loading each exercise's SGF;
  this endpoint does not need to return SGF text itself).
- `opponentName`/`opponentRank`/`boardSize`/`userSign`/`moveNumber` are
  display fields for Daily Practice Home's exercise rows (handoff section
  4 — "vs kitsune77 4k" / "Black to play · 19×19 · move 75"). The frontend's
  mock backend (`MockPracticeService`) currently derives these from the
  game's own SGF the same way `GameListEntry` does; a real backend can do
  the same, or project them straight from the already-analysed game record.

### `POST /practice/today/start`

Creates today's session if none exists yet; **idempotent** — if one already
exists for today, returns it unchanged rather than creating a second one or
erroring (RF03.6: "A seleção de exercícios não muda após o início da
sessão."). Same response body as `GET /practice/today`.

Selection algorithm (server-side, no KataGo/GPU call — RF03.1 is explicit
about this): pick up to 5 positions across the chat's analysed games'
opening/middlegame/endgame SGFs (same universe `GET /history` already
exposes), preferring ones never used in a prior session for this chat,
never repeating the same position twice within the new session, falling
back to reuse if fewer than 5 unused positions exist.

### `POST /practice/today/exercises/{exerciseId}/result`

No body. Marks one exercise in **today's** session `completed: true` (404 if
`exerciseId` doesn't belong to the requesting chat's current session — same
IDOR-by-ownership pattern as `DELETE /history/{id}`); once every exercise in
the session is completed, the session itself becomes `completed: true`
(returned on the next `GET /practice/today`). No per-exercise
correct/incorrect outcome is tracked — the route only records that the
exercise was finished.

Response: `204 No Content`.

### `GET /practice/preferences` / `PUT /practice/preferences`

```json
{ "topVariants": 3, "continuationDepth": 4 }
```

- `topVariants`: integer, 1–5, default 3 (RF02.2).
- `continuationDepth`: integer, 2–10, default **4**.
- `GET` with no preferences saved yet for the chat returns the defaults
  above rather than 404 (simpler for the frontend: always a value to apply).
- `PUT` body is the same shape; validates both fields' ranges server-side
  (frontend already clamps its own UI inputs, but the backend is the real
  guard since `HttpPracticeService` is just a thin HTTP wrapper).

**Resolved**: RF02.2 originally said "Continuation Length (M)" defaults to
6; RF03.4 restates the same preference as "Continuation Depth (M)" with
default 4. The design handoff (`docs/design-handoff/v4-kaizen-daily-practice/HANDOFF-daily-practice.md`,
sections 5 and 7) does the exact ply arithmetic against default 4
("M = 4 gives 5 plies: you·reply·you·reply·you — 3 moves for the user") and
is the more authoritative, recently-confirmed source — **4 is correct**, not 6.

## 1.5. KataGo must always analyse at maximum resolution — preferences are a pure display-time slice

**Critical for the `practice` module's design**: `topVariants`/`continuationDepth`
are **user-facing display preferences only**. They must never influence what
KataGo actually computes or what gets persisted. The backend should always
generate and store the **maximum** supported breadth/depth —
`BEST_CANDIDATES_LIMIT = 5` candidates, each with **enough plies for the
worst case of RF03.5's "Go deeper"** (`M` maxes out at 10 per the design
handoff's `M ← min(10, M + 2)` ceiling, and the first move doesn't count
toward `M` — so a variant needs **1 + 10 = 11 plies** stored, not the current
6) — regardless of what any chat's saved preferences currently say.

Why this matters: if a variant were ever persisted at a *preference-sized*
resolution (e.g. only 3 variants, or only 5 plies, because that's what the
chat's preferences said *at analysis time*), then a chat raising
`topVariants`/`continuationDepth` later — or just tapping **Go deeper** —
would have nothing further to reveal, since the extra breadth/depth was
never computed. KataGo analysis is comparatively expensive and happens once,
asynchronously, at game-analysis time (see `AnalysisAggregator`); preference
changes must take effect **instantly**, by re-slicing already-stored data,
with **no reprocessing, no new RunPod call**.

Concretely, in `kaizan-companion`'s `KatagoAssembler`
(`features/analysis/katago/KatagoAssembler.java`):

- `BEST_CANDIDATES_LIMIT = 5` — already correct, matches `topVariants`'s max (5). No change needed.
- `VARIATION_MOVES_LIMIT = 6` — **too low**. Must become **11** (1 initial ply + the max `continuationDepth` of 10), so a chat that raises `continuationDepth` to 10 or exhausts every "Go deeper" tap still finds real analysed moves waiting, instead of the line silently running out early.

Everything that reads `topVariants`/`continuationDepth` — slicing to the
first N variants, capping shown plies to `min(1 + M, variant.plies.length)` —
happens **only** in the Mini App (`kaizen-miniapp`'s `ExercisePageComponent`/
`exercise-state.ts`), never in `kaizan-companion`. The backend's only job
regarding these two preferences is to store and serve their current value
(`GET`/`PUT /practice/preferences` above) — it never reads them to decide
how much to analyse.

## 2. Persistence (RF03.6 — not detailed here, backend's own design)

Needs, per RF03.6's own requirements: one session per chat per day, resumable,
exercise selection frozen after creation, prior sessions queryable, saved to
PostgreSQL. This proposal only commits to the HTTP shape above — table/entity
design (new JPA entities for session + per-exercise result, a Flyway
migration) is the backend implementation's own decision, not dictated here.

## 3. Protected-functionality note

Everything here is new, additive surface: a new `practice` module/package, a
new controller, new entities/migration, none of it touching
`JobClaimService`, `LeaseReleaserScheduler`, `AnalysisAggregator`, RabbitMQ
consumers/producers, Debezium, or RunPod's own submission path. Exercise
selection reads already-persisted `GameAnalysisEntity` SGFs (same data
`GET /history` already exposes) — no KataGo/GPU call, per RF03.1 and RF03.3's
explicit constraints.
