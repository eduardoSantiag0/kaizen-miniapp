# GET /history — proposal: surfacing in-progress jobs (IMPLEMENTED)

Status: **implemented and verified**, with the user's explicit sign-off on
all three open decisions below (status mapping, the breaking DTO swap, and
skipping player-name parsing for in-progress jobs). What follows is kept as
the original proposal/analysis for context; see `MiniAppService`,
`MiniAppController`, `GameHistoryItemDto`, and `GameAnalysisRepository`'s
`ORDER BY` change in `kaizan-companion` for the actual landed implementation,
and `MiniAppServiceTest` for its test coverage.

Backend repo root: `kaizan-companion/`, branch `feature/miniapp-api`, on top of
commit `aa93e001e5bcea2db09a357097f553e0ca92413a` plus the uncommitted
working-tree state already described in `history-endpoint-contract.md`
(issues #2-#6 fixed, issue #1 still an open stub, section 5's
`blackPlayer`/`whitePlayer`/`gameRank` additions).

## 0. The gap this addresses

`GET /history` (`MiniAppService.findAllByTelegramUserId` →
`GameAnalysisRepository.findHistoryByChat`) can only ever return games that
have **finished** analysis. A `GameAnalysisEntity` row is created exactly
once, unconditionally, at the very end of
`AnalysisAggregator.handleResponse`:

```java
// features/analysis/AnalysisAggregator.java, line 135
gameAnalysisRepository.save(gameAnalysisEntity);
jobEntity.setJobStatus(JobStatus.COMPLETED);
```

A job that is queued, being submitted, or sitting in RunPod's queue has no
`GameAnalysisEntity` row at all — it only exists as an `AnalysisJobEntity`
row. So today, a game the user requested analysis for a minute ago simply
doesn't appear in `/history` until it completes. This contradicts
`HANDOFF.md`'s `GamesPage` spec (section 4), which has three analysis states
per row — `done`, `running`, `waiting` — and expects all three to be visible
in the list at once.

## 1. Mapping `JobStatus` → `GamesPage`'s three states

The actual lifecycle, confirmed by reading every `setJobStatus` call site
(not assumed from the enum alone):

| Status | Set by | What it actually means |
|---|---|---|
| `ANALYSIS_REQUESTED` | `JobSubmissionService.saveJob` (job created); `LeaseReleaserScheduler` (lease expired, requeued) | Job recorded, not yet claimed for submission to RunPod. |
| `SUBMITTING` | `JobClaimService` (lease acquired) | Backend has claimed the job and is mid-handshake submitting it to RunPod. Transient, backend-internal. |
| `IN_QUEUE` | `AnalysisListener` (RunPod accepted the submission) | RunPod has accepted the job into **its own** queue. This is the last state the backend observes before either a success or error callback. |
| `COMPLETED` | `AnalysisAggregator.handleResponse` | `GameAnalysisEntity` row now exists — done. |
| `FAILED` | `AnalysisListener` (RunPod returned an error) | Terminal failure. |
| `TIMED_OUT` | *(no `setJobStatus(JobStatus.TIMED_OUT)` call site found anywhere in `src/main`)* | Defined in the enum, never actually persisted locally. |
| `CANCELLED` | *(no `setJobStatus(JobStatus.CANCELLED)` call site either — `ResignCommandHandler` (`/resign`) only posts to RunPod's own `/cancel` endpoint and reads `CANCELLED` off RunPod's `RunPodCancelledResponse`; it never writes `CANCELLED` onto the local `AnalysisJobEntity.jobStatus` column)* | Checked against RunPod's response, not a local job-lifecycle state. |

**Important finding:** there is no backend-tracked status that means "KataGo
is actively computing right now" as distinct from "waiting in a queue
somewhere." `IN_QUEUE` is RunPod's queue, not a "now running" signal — the
backend has zero visibility between submission acceptance and the final
callback. `HANDOFF.md`'s `running: "KataGo is analyzing…"` copy is aspirational
precision we can't actually back with a real signal.

**Recommended mapping** (lossy, but the best available signal, and it's a
one-way simplification done in the service layer — the frontend never sees
raw `JobStatus` values):

- `waiting` ← `ANALYSIS_REQUESTED`, `SUBMITTING` (nothing externally visible
  has happened yet)
- `running` ← `IN_QUEUE` (the job has left our backend's hands and is the
  closest thing to "being worked on" we can claim)
- `done` ← a `GameAnalysisEntity` row exists (current behavior, unchanged)
- `FAILED` ← `AnalysisListener`, the one terminal-failure status actually
  persisted locally today. `TIMED_OUT`/`CANCELLED` are defined in the enum
  but (per the finding above) never actually get written to
  `AnalysisJobEntity.jobStatus` anywhere in the current codebase, so in
  practice the query will never see them — but the status filter should
  still exclude all three defensively rather than assume that never changes.
  **No state in `HANDOFF.md`'s row spec covers a failure.** Recommend
  **excluding `FAILED`/`TIMED_OUT`/`CANCELLED` from the list entirely** for
  now (matches today's behavior, where they're already invisible). Surfacing
  a failed row is a new row-copy design decision (what text, what color,
  retry affordance?) outside `HANDOFF.md`'s current spec — flagging for
  Designer/Supervisor rather than inventing copy here.

## 2. Merging in-progress jobs into the response

**Recommendation: two separate queries, merged in the service layer
(`MiniAppService`), into one flat response list.**

Why not the alternatives:

- **Single UNION query** (native SQL): `GameAnalysisEntity` and
  `AnalysisJobEntity` don't share a column shape (per-phase SGF text and
  player/rank fields live only on the former), so a UNION would need heavy
  casting/nulling on one side and loses JPQL's constructor-expression type
  safety that `findHistoryByChat` already relies on. Also risks touching a
  query path shared with `HistoryCommandHandler` (Telegram `/history`),
  which is explicitly out of scope.
- **Different response shape** (e.g. two separate arrays, or a Jackson
  polymorphic union type): `HANDOFF.md`'s suggested Angular components
  (`GameSection` / `GameRow`, section "Suggested Angular components") expect
  one flat, orderable list to render as grouped rows — a single list is the
  natural fit, not a reason to split the wire format.

The merge itself needs **no new repository query** for the in-progress side:
`AnalysisJobRepository.findByChatAndJobStatusIn(chat, statuses)` already
exists (written for `QueueCommandHandler`'s `/queue` command) and is exactly
"jobs for this chat in these statuses." Reusing it:

```java
// MiniAppService, illustrative only — not implemented
List<GameHistoryDto> completed = gameAnalysisRepository.findHistoryByChat(chat);
List<AnalysisJobEntity> inProgress = analysisJobRepository.findByChatAndJobStatusIn(
        chat, Set.of(JobStatus.ANALYSIS_REQUESTED, JobStatus.SUBMITTING, JobStatus.IN_QUEUE));
```

then mapped into a common DTO (section 3) and merged. `findHistoryByChat`
currently orders `ORDER BY g.id` (not by date) — `HANDOFF.md` wants
newest-first grouped under "Today"/"Earlier". Merging two lists needs a
common order key; `AnalysisJobEntity.createdAt` is the natural one for the
in-progress side, and `GameAnalysisEntity` has no timestamp of its own today
(only reachable via `g.jobEntity.createdAt`). Recommend ordering the merged
list by job-creation time descending. This is a small, separate change to
`findHistoryByChat`'s `ORDER BY` — flagging it here since it's adjacent, not
proposing to silently bundle it in.

## 3. Resulting DTO shape

Recommend **adding a new DTO**, not widening `GameHistoryDto`'s JPQL
constructor-expression (which is tightly coupled to `GameAnalysisEntity`'s
columns and shouldn't grow nullable fields it can't actually produce).

```java
public record GameHistoryItemDto(
        UUID id,                 // GameAnalysisEntity.id when done, else AnalysisJobEntity.id
        UUID correlationId,
        String status,           // "DONE" | "RUNNING" | "WAITING" — already-translated, not raw JobStatus
        String openingAnalysed,  // null unless status == "DONE"
        String middlegameAnalysed,
        String endgameAnalysed,
        String blackPlayer,      // null unless status == "DONE" (see note below)
        String whitePlayer,
        String gameRank
) {}
```

`status` is a **frontend-facing simplified string**, translated server-side —
the frontend never needs to learn the backend's 7-value `JobStatus` enum or
its internal transitions (`SUBMITTING` vs `IN_QUEUE` is meaningless to a Mini
App user). `GameHistoryDto` and `findHistoryByChat` stay exactly as they are
today; `GameHistoryItemDto` is assembled in `MiniAppService` from both
sources. The controller's return type changes from `List<GameHistoryDto>` to
`List<GameHistoryItemDto>` — this is a **breaking change to the still-unused,
not-yet-functional prototype endpoint** (issue #1 means nothing has ever
consumed a real response yet), so the usual "breaking changes to existing
APIs" approval gate applies, but there's no real caller to break today.

**Optional nice-to-have, not required for this change:** `AnalysisJobEntity`
already stores `originalGame` (the raw SGF) at submission time, before
analysis completes. The same parsing `AnalysisAggregator.setPlayersInfo` does
for `PB`/`PW`/`BR`/`WR` could run against an in-progress job's `originalGame`
too, so a `waiting`/`running` row could show the real opponent name/rank
instead of nulls. This is a genuinely separate, optional addition (new
parsing call in the read path, not the pipeline) — flagging it as an option,
not folding it into this proposal's required scope.

## 4. Protected-functionality check

Everything above is **read-only querying of existing state**, not a
pipeline change:

- `AnalysisJobRepository.findByChatAndJobStatusIn` already exists — zero new
  repository methods needed on the job side.
- No change to `JobStatus`, no change to any `setJobStatus` call site, no
  change to `JobClaimService`, `LeaseReleaserScheduler`, `AnalysisListener`,
  `JobSubmissionService`, or `AnalysisAggregator`. None of the protected
  items (job claim/idempotency, lease mechanics, circuit breaker, RunPod
  integration, RabbitMQ consumers/producers) are touched.
- `GameAnalysisRepository.findHistoryByChat` is unchanged except the
  optional `ORDER BY` tweak in section 2, which only reorders existing
  output, no logic change.
- New code is confined to: one new DTO (`miniapp` package), a small
  status-translation mapping, and a merge in `MiniAppService`. All within
  "Create request and response DTOs" / "Reuse existing repositories and
  services" in `integration-manager.md`'s allowed scope.

**One security-adjacent note, not a pipeline one:** this is new external
visibility into `AnalysisJobEntity` rows (even translated/filtered) over a
Mini-App-facing endpoint. Recommend the mapping only ever expose `id`,
`correlationId`, the three translated statuses, and (if the optional
player-name parsing is added) the parsed player/rank strings — never
`leaseUntil`, `linkToSource`, or raw `originalGame` SGF text for in-progress
jobs. Scoping stays identical to today: `MiniAppService` already resolves
`chat` from the validated Telegram user id and queries both repositories
against that single `chat`, so no new IDOR surface.

## 5. Summary of recommendation

1. Map `ANALYSIS_REQUESTED`/`SUBMITTING` → `waiting`, `IN_QUEUE` → `running`,
   completed row exists → `done`; exclude `FAILED`/`TIMED_OUT`/`CANCELLED`
   jobs from the list pending a Designer/Supervisor decision on how to show
   them.
2. Two queries (existing `findHistoryByChat` + existing
   `findByChatAndJobStatusIn`), merged in `MiniAppService`. No UNION query,
   no pipeline changes.
3. New `GameHistoryItemDto` (translated `status` string, nullable
   per-phase/player fields) replacing `List<GameHistoryDto>` as the
   controller's return type. Breaking change on paper, but to an endpoint
   with no real caller yet (issue #1 still blocks end-to-end use).
4. No protected functionality needs modification — this is a read-only
   extension. One optional nice-to-have (parsing player names from
   in-progress jobs' stored SGF) is flagged separately, not required.

Awaiting explicit approval (via `kaizen-supervisor`/user) before any of this
is implemented, per the standing approval gate for new/breaking endpoint
changes.
