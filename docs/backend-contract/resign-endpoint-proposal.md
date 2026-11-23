# Resign endpoint — proposal (IMPLEMENTED)

Status: **implemented and verified**. `DELETE /kaizan/api/v1/katago/history/{id}`
now exists in `kaizan-companion` (`MiniAppController.resignGame` →
`MiniAppService.resignGame`), matching the "Route/verb" guess below exactly.
It resolves `id` against the requesting chat on both repositories
(`AnalysisJobRepository.findByIdAndChat` / `GameAnalysisRepository.findByIdAndChat`)
before acting, so the IDOR concern in section 1 is covered the same way
`GET /history` already covers it. A running/queued job is cancelled via a
new shared `RunPodCancelClient` (also now used by `ResignCommandHandler`,
replacing its previously-duplicated RestTemplate call) and marked
`CANCELLED` locally; an already-analysed game is deleted outright. The
frontend's `HttpGameHistoryService.resignGame` calls this route. What
follows is kept as the original proposal/analysis for context.

## 0. What the frontend needs

`GamesPage`'s Cancel/Delete action (one button per row — see
`HANDOFF-update.md` section 1) needs a single endpoint that "resigns" one
game's job, given just its id:

- **Analyzing or queued** (`GameListEntry.status` `'running'`/`'waiting'`):
  cancel the job. The backend already has this behaviour today, just not as
  an HTTP route — `ResignCommandHandler` (`/resign`) in `kaizan-companion`
  posts to RunPod's own `/cancel` endpoint for the Telegram bot command (see
  `history-endpoint-job-status-proposal.md` section 1's `CANCELLED` row). The
  Mini App needs the same effect reachable over HTTP.
- **Analyzed** (`status` `'done'`): delete the game and its stored analysis.

The frontend seam is already in place either way: `GameHistoryService.resignGame(gameId): Observable<void>`
(`src/app/data/game-history.service.ts`), implemented in the mock
(`MockGameHistoryService`, session-local, no real network), and left
deliberately unimplemented in `HttpGameHistoryService` — it returns an error
observable with a comment pointing here, rather than guessing a URL.

## 1. Open questions for whoever picks this up

- **Route/verb.** A natural fit alongside the existing
  `POST /kaizan/api/v1/katago/history` area (see
  `history-endpoint-contract.md`) would be something like
  `DELETE /kaizan/api/v1/katago/history/{id}`, reusing one route for both
  cancel-a-job and delete-an-analysis (the backend already knows which one a
  given id is). This is a guess, not a decision — whoever implements this
  should follow `kaizan-companion`'s own routing conventions instead.
- **Auth/scoping.** Must resolve the owning chat from the validated Telegram
  `initData` the same way `MiniAppService` already does for `GET /history`
  (see `history-endpoint-job-status-proposal.md` section 4's IDOR note) — a
  resign/delete call must only ever act on a job/game belonging to the
  requesting chat, never an arbitrary id.
- **Idempotency/races.** What happens if the job completes (or is already
  gone) between the Mini App rendering the row and the resign call landing?
  The frontend's own contract (`GameHistoryService.resignGame`) only
  distinguishes success/failure; it has no opinion on whether a
  "already gone" response should count as success or a (swallowed) failure —
  that's a backend/product call.
- **Response shape.** `Observable<void>` is deliberately minimal (the
  frontend removes the row locally on success, see `GameRowComponent`); a 204
  or an empty 200 both satisfy it.

## 2. Protected-functionality note

None of this touches `JobClaimService`, `LeaseReleaserScheduler`,
`AnalysisAggregator`, RabbitMQ consumers/producers, or RunPod's own
submission path — it's a new, narrow entry point that reuses
`ResignCommandHandler`'s existing cancel behaviour (or the equivalent
delete-a-`GameAnalysisEntity` path) behind an HTTP route instead of the
Telegram bot command. Flagging for Integration Manager/Supervisor review
before any backend work starts, per the standing approval gate for new
endpoints.
