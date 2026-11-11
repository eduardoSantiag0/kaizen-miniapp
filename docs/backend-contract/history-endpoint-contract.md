# GET /history endpoint — prototype contract (DRAFT, NOT YET FUNCTIONAL)

Status: documents the user's in-progress prototype on the backend repo's
`feature/miniapp-api` branch. **This endpoint still does not work
end-to-end** — auth validation (issue #1 below) is an intentional stub that
the user is implementing themselves; everything else found during review has
been fixed directly in this repo (issues #2-#6). Frontend should not wire up
a real HTTP call against it until issue #1 lands and this doc's DRAFT marker
is dropped.

Backend repo root: `kaizan-companion/`, branch `feature/miniapp-api`.
Commit `aa93e001e5bcea2db09a357097f553e0ca92413a` ("wip: miniapp controller")
is HEAD and contains the prototype as the user committed it. Fixes #2-#6
below have been applied on top of that commit, in the working tree, by the
Integration Manager with explicit authorization — not yet committed, so they
remain visible as uncommitted changes via `git status`/`git diff` in that
repo. Issue #1 (`TelegramInitDataService.validateAndGetUserId`) has been left
untouched, as instructed — it is the user's own work in progress.

## 1. Route

```
GET /kaizan/api/v1/katago/history
```

Defined in `miniapp/MiniAppController.java` (lines 14-16, 29-55). Note the
path currently lives under the `/katago` prefix, reused from the unrelated
`KatagoController` (the RunPod callback). That's almost certainly a copy/paste
base rather than an intentional choice — see "Proposed adjustments" below.

## 2. Auth

Header: `Authorization: tma <initData>` (lines 30-44), matching the
[Telegram Mini Apps `tma` auth scheme](https://docs.telegram-mini-apps.com/platform/init-data)
convention. Missing header or wrong prefix → `401 Unauthorized`.

`initData` (the raw query string Telegram's client SDK provides) is expected
to be validated and turned into a Telegram user id by
`TelegramInitDataService.validateAndGetUserId(initData)`
(`miniapp/TelegramInitDataService.java`), which is then passed to
`MiniAppService.findAllByTelegramUserId(telegramUserId)`
(`miniapp/MiniAppService.java`, lines 20-26) — this looks up the caller's
`TelegramChatEntity` by that id and scopes the games query to it via
`GameAnalysisRepository.findHistoryByChat`. This is the right shape: the
server derives identity from a cryptographically verified `initData`, not a
client-supplied id, and games are scoped to that identity — no IDOR by
construction, **once validation actually happens** (today it doesn't; see
below).

## 3. Response shape

`200 OK` with a JSON array of **`GameHistoryItemDto`**
(`miniapp/GameHistoryItemDto.java`) — **the controller's return type changed
again since the last pass of this document.** `GameHistoryDto`
(`miniapp/GameHistoryDto.java`) still exists and is still what
`GameAnalysisRepository.findHistoryByChat` returns internally, but it is no
longer what the HTTP response serializes — `MiniAppController.getAllGames`
now returns `List<GameHistoryItemDto>`, assembled by `MiniAppService` from
two sources (see `history-endpoint-job-status-proposal.md` in this directory
for the full design rationale; this section documents the shape as landed):

```json
[
  {
    "id": "uuid",
    "correlationId": "uuid",
    "status": "DONE | RUNNING | WAITING",
    "openingAnalysed": "string | null  — opening-phase SGF text, null unless status is DONE",
    "middlegameAnalysed": "string | null  — middlegame-phase SGF text, null unless status is DONE",
    "endgameAnalysed": "string | null  — endgame-phase SGF text, null unless status is DONE",
    "blackPlayer": "string | null  — black player's name from PB[], null unless status is DONE",
    "whitePlayer": "string | null  — white player's name from PW[], null unless status is DONE",
    "gameRank": "string | null  — rank string, see below, null unless status is DONE"
  }
]
```

**`status` is new and is the main point of this shape change.** It's a
translated, frontend-facing string — never the backend's raw 7-value
`JobStatus` enum:

- `"DONE"` — a finished `GameAnalysisEntity` row exists; all the SGF/player
  fields above are populated exactly as the old 8-field `GameHistoryDto`
  shape always was.
- `"RUNNING"` — the underlying `AnalysisJobEntity.jobStatus` is `IN_QUEUE`.
- `"WAITING"` — `jobStatus` is `ANALYSIS_REQUESTED` or `SUBMITTING`.
- Jobs with `jobStatus` `FAILED`, `TIMED_OUT`, or `CANCELLED` are **excluded
  from the array entirely** — there is no row, status string, or id for
  them. (`TIMED_OUT`/`CANCELLED` are never actually written to a job's
  status in the current codebase anyway; `FAILED` is the one of the three
  that's real, and it's still excluded.)

For a `RUNNING`/`WAITING` row, `id` and `correlationId` come from the
`AnalysisJobEntity` itself (there is no `GameAnalysisEntity` row yet), and
every other field is `null` — the per-phase SGF text and player/rank fields
are only ever populated once a row reaches `DONE`.

`gameRank` is **not** simply "the game's rank" when `status` is `DONE` —
read `AnalysisAggregator.setPlayersInfo`
(`features/analysis/AnalysisAggregator.java`) carefully before assuming a
format: it's `"{blackRank}/{whiteRank}"` when both `BR[]` and `WR[]` are
present on the original SGF, just `blackRank` alone if only `BR[]` is present,
just `whiteRank` alone if only `WR[]` is present, or `null` if neither is.
Frontend should not assume a fixed `"X/Y"` shape — a bare rank with no slash
is a valid value, not a parsing error.

**Ordering changed too.** The array is ordered by job-creation time
descending (newest first) — **not** `g.id` as earlier passes of this
document said. This is a change to `GameAnalysisRepository.findHistoryByChat`'s
`ORDER BY` clause itself, so it also changes the file-delivery order of the
existing Telegram `/history` command (`HistoryCommandHandler`), which shares
that same query — this is a real, if minor, behavior change to pre-existing
Telegram bot output, not something scoped only to the Mini App.

There is still no "get one game" endpoint (the controller has a `// Get one
game` comment with nothing under it) and still no data distinguishing "the
user's mistake" from "KataGo's line" within a phase's SGF — the gap described
in `mock-sgf-fixture-gap.md` is unchanged by this round too. The
`black_player`/`white_player`/`game_rank` columns give Frontend real player
names/ranks for `DONE` rows, likely useful for `GamesPage`'s row text or the
Exercise screen's `vs {opponent} · {server}` meta line (HANDOFF.md section
5). They still don't touch the mistake/KataGo's-line tagging gap, which is a
different problem.

**Known frontend-side gap:** `kaizen-miniapp`'s own `GameHistoryDto` model
(`src/app/data/game-history.model.ts`) does not yet have a `status` field
and doesn't know about this shape at all — see
`game-history-item-contract-drift.md` in this directory for the full
comparison. Not fixed here; that's Frontend's call.

## 4. Issues found and their status

1. **OPEN — left for the user. Auth validation is a stub that always
   returns `null`.** `TelegramInitDataService.validateAndGetUserId` never
   parses `initData`, never builds the data-check-string, and never calls
   `HmacService` — it just falls through to `return null`. `HmacService`
   itself (`isValidTelegramWebAppData`, `calculateHmac`, `verifyHmac`) is a
   correct implementation of Telegram's documented algorithm
   (`secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)`, then
   `HMAC_SHA256(key=secret_key, data=data_check_string)` compared to the
   `hash` field) but is never invoked by anything.
   - **Effect today:** every request with a `tma `-prefixed header reaches
     `MiniAppService.findAllByTelegramUserId(null)`, which calls
     `telegramChatRepository.findById(null)` directly (not via the
     now-fixed `.orElseThrow()` path — Spring Data throws
     `IllegalArgumentException` for a null id before an `Optional` is even
     produced), so the endpoint still 500s on every call. It does not leak
     data to a forged request; it simply doesn't work yet. This is the one
     thing standing between this prototype and being usable end-to-end —
     by the user's explicit request, left entirely untouched here.

2. **FIXED. `HmacService` comparisons weren't constant-time.**
   `isValidTelegramWebAppData` and `verifyHmac` used `String.equalsIgnoreCase`
   to compare computed vs. expected hash, inconsistent with
   `KatagoController.constantTimeEquals`/`TelegramController.constantTimeEquals`
   elsewhere in the codebase. Both methods now compare via a new private
   `constantTimeEquals` helper using `MessageDigest.isEqual` on
   lowercased UTF-8 bytes (lowercasing first preserves the original
   case-insensitive semantics while keeping the comparison itself
   constant-time).

3. **FIXED. Stale fully-qualified class name in `GameAnalysisRepository`'s
   JPQL.** `GameHistoryDto` was moved from `domain.models` to `miniapp`
   (tracked rename in the user's commit). The Java import was updated, but
   the `@Query` JPQL string still constructed
   `new io.github.eduardosantiag0.kaizan_companion.domain.models.GameHistoryDto(...)`
   — the old, nonexistent fully-qualified name, which Hibernate resolves
   independently of the Java import. Updated the FQCN inside the JPQL
   string to `io.github.eduardosantiag0.kaizan_companion.miniapp.GameHistoryDto`.

4. **FIXED. Stray/invalid derived-query method in the same repository.**
   `GameAnalysisRepository` declared
   `TelegramChatEntity chat(TelegramChatEntity chat);`, which didn't follow
   Spring Data's derived-query-method naming grammar and wasn't called from
   anywhere. Removed.

5. **FIXED. Migration `V12___add_column_game-info.sql` was invalid SQL.**
   Three `ADD COLUMN` clauses with no commas and no data types. Now:
   ```sql
   ALTER TABLE game_analysis_results_db
       ADD COLUMN black_player VARCHAR(255),
       ADD COLUMN white_player VARCHAR(255),
       ADD COLUMN game_rank VARCHAR(255)
   ;
   ```
   `VARCHAR(255)` matches Hibernate's default mapping for an unannotated
   `String` column on `GameAnalysisEntity` (no `columnDefinition` was given
   for these three fields), so the migration now agrees with what Hibernate
   expects the schema to look like.

6. **FIXED. Error handling for "chat not found."**
   `MiniAppService.findAllByTelegramUserId` now maps a missing
   `TelegramChatEntity` to `ResponseStatusException(HttpStatus.NOT_FOUND, "Telegram chat not found")`
   instead of an unmapped `NoSuchElementException` (which would otherwise
   surface as a generic `500`). Note this path still can't be reached until
   issue #1 is fixed, since today `telegramUserId` is always `null` and
   `findById` throws before this ever returns an empty `Optional` — this fix
   is ready for when #1 lands.

## 5. What the user changed since the last pass (read-only review, nothing fixed here)

On top of commit `aa93e001e5bcea2db09a357097f553e0ca92413a` and the #2-#6
fixes in section 6 below, the user has (uncommitted, in the working tree):

- **`miniapp/GameHistoryDto.java`** — added the three fields described in
  section 3: `blackPlayer`, `whitePlayer`, `gameRank` (all `String`).
- **`domain/repositories/GameAnalysisRepository.java`** — the `@Query` JPQL
  constructor expression now also projects `g.blackPlayer, g.whitePlayer,
  g.gameRank`, matching the new DTO constructor. Still uses the correct
  (`miniapp.GameHistoryDto`) FQCN from fix #3 — consistent, no new FQCN bug.
- **`domain/entities/GameAnalysisEntity.java`** — `blackPlayer`/`whitePlayer`/
  `gameRank` (added in the prototype this doc already covered) now each have
  `@Setter`, needed for the next item.
- **`features/analysis/AnalysisAggregator.java`** — new private
  `setPlayersInfo(GameAnalysisEntity, String originalGame)`, called right
  after `new GameAnalysisEntity(jobEntity, chatEntity)` inside
  `handleResponse`. It parses `originalGame` with
  `io.github.eduardosantiag0.sgf.parser.SgfParser`, reads the root node's
  `PB`/`PW`/`BR`/`WR` tags, and sets `blackPlayer`/`whitePlayer`/`gameRank`
  accordingly (see the `gameRank` format note in section 3).

**#1 is unchanged — confirmed by re-reading the file, not by assuming.**
`TelegramInitDataService.validateAndGetUserId` still falls straight through
to `return null`, with the same leftover comment/URL lines as before.
`MiniAppController.java` is also byte-for-byte unchanged. The endpoint is
**still not usable end-to-end**, for the same reason as the last pass: a
`tma`-prefixed `Authorization` header reaches
`MiniAppService.findAllByTelegramUserId(null)`, which throws before even
producing an empty `Optional`. Still a `500`, not yet anything resembling a
real response.

**Regression found this pass, now FIXED.** `./mvnw -o test` had started
failing `AnalysisAggregatorTest.handleResponse_mustNotCrash_whenKataGoReportsNoCriticalPoints_andTheChatHasEmailLinked`
with `java.lang.NullPointerException: sgf`, because the new `setPlayersInfo`
called `new SgfParser().parse(originalGame)` unconditionally, with no null
check, and that test's `AnalysisJobEntity` is built via the 3-arg constructor
that leaves `originalGame` null (that constructor is also used in production,
in `JobSubmissionService.saveJob`, so a job without an original SGF stored is
not purely a test artifact). With explicit user authorization, scoped to
exactly this null-safety gap and nothing else in `AnalysisAggregator`/the job
pipeline: `setPlayersInfo` (`features/analysis/AnalysisAggregator.java`) now
returns immediately if `originalGame == null`, before constructing the
`SgfParser`. `./mvnw -o test` now reports 65 run, 0 failures, 1 error (the
same pre-existing, unrelated `contextLoads` datasource error from section 6)
— back to the same test health as before this regression appeared.

## 6. What was fixed here, previously

Applied directly to `kaizan-companion` (uncommitted on top of commit
`aa93e001e5bcea2db09a357097f553e0ca92413a`), with the user's explicit
authorization for this specific scope:

- `miniapp/HmacService.java` — constant-time comparison (#2).
- `domain/repositories/GameAnalysisRepository.java` — fixed JPQL FQCN (#3),
  removed the stray `chat()` method (#4).
- `src/main/resources/db/migration/V12___add_column_game-info.sql` — valid
  SQL syntax (#5).
- `miniapp/MiniAppService.java` — `404` on missing chat instead of a bare
  `.orElseThrow()` (#6).

**Not touched:** `miniapp/TelegramInitDataService.java` — issue #1 remains
exactly as the user left it, per their explicit instruction to implement
that themselves.

**Verification at the time:** `./mvnw -o compile` succeeded with no errors.
`./mvnw -o test` ran all 65 existing tests: 64 passed, 0 failures. The one
error (`KaizanCompanionApplicationTests.contextLoads`) failed upstream of any
code touched here — at HikariCP/datasource URL resolution, before Flyway or
Hibernate even run — because no live Postgres connection is configured in
this environment; a pre-existing environment limitation, not a regression
from these changes. **Re-running the suite in this pass surfaces one more
failure, introduced by the user's own changes in section 5 above (not by
anything fixed in this section) — see section 5's "New regression" note.**

Also left as-is, by design choice rather than because it's broken: the route
still lives under `/kaizan/api/v1/katago/history` (reused from
`KatagoController`'s prefix). Renaming it to something like
`/kaizan/api/v1/miniapp/history` is cosmetic/cleanup, not a bug fix, and was
left for the user's judgment per this round's scope.

## 7. For Frontend

Still do not point `GameHistoryService` at a real HTTP call. Issues #2-#6
are fixed, but issue #1 (auth validation) means every request still fails —
now as a `500` from `findById(null)` rather than anything resembling a real
response. Keep using the mock until issue #1 is implemented and this
document's DRAFT marker is removed.

Once that lands, the route and the `Authorization: tma <initData>` header
stay as documented above, but the response shape has changed since the last
pass of this section: it is now `List<GameHistoryItemDto>` (section 3), not
the old 8-field `GameHistoryDto`. Concretely, when wiring the real call:

- Add a `status: "DONE" | "RUNNING" | "WAITING"` field to whatever frontend
  type backs this response — it isn't optional decoration, it's what
  `GamesPage`'s three-state row design (HANDOFF.md section 4) is meant to
  read.
- A `RUNNING`/`WAITING` row has `null` for every SGF/player field — this was
  already true of the old shape's nullability, so no frontend-side type
  change is needed there, just awareness that `null` now also means "no
  analysis yet" and not only "this phase wasn't analysed for a finished
  game."
- The array is newest-first by job-creation time, not by `g.id`.
- `gameRank` is still not always `"X/Y"` — same caveat as before, see
  section 3.

This gap (frontend's current model not having `status` yet) is tracked as
its own item in `game-history-item-contract-drift.md` in this directory, not
fixed here.
