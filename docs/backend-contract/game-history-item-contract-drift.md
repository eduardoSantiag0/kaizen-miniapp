# Confirmed gap: frontend's `GameHistoryDto` no longer matches the backend's response shape

Status: **confirmed integration gap, documentation only.** No frontend or
backend code was changed to produce this document — read-only comparison of
what's on disk in both repos right now. Nothing is urgent today because
nothing calls the real endpoint yet (see "Why this isn't breaking anything
right now" below), but it is now a real, concrete drift, not a hypothetical
one, so it's being tracked here rather than left as a verbal note.

Compared:

- `kaizen-miniapp/src/app/data/game-history.model.ts` /
  `game-history.service.ts` (frontend, current state on disk)
- `kaizan-companion/src/main/java/.../miniapp/GameHistoryItemDto.java` and
  `MiniAppController.java` (backend, current state on disk, after the
  job-status merge described in
  `history-endpoint-job-status-proposal.md`)

## The drift

| | Frontend `GameHistoryDto` (`game-history.model.ts`) | Backend `GameHistoryItemDto` (now the controller's actual return type) |
|---|---|---|
| `id` | `string` | `UUID` — compatible (serializes as a string over JSON) |
| `correlationId` | `string` | `UUID` — compatible |
| `status` | **does not exist on this type at all** | `String` — `"DONE"` \| `"RUNNING"` \| `"WAITING"` |
| `openingAnalysed` | `string \| null` | `String` (null for in-progress rows) — compatible |
| `middlegameAnalysed` | `string \| null` | `String` (null for in-progress rows) — compatible |
| `endgameAnalysed` | `string \| null` | `String` (null for in-progress rows) — compatible |
| `blackPlayer` | `string \| null` | `String` (null for in-progress rows) — compatible |
| `whitePlayer` | `string \| null` | `String` (null for in-progress rows) — compatible |
| `gameRank` | `string \| null` | `String` (null for in-progress rows) — compatible |

**The one real field-level gap is `status`.** It doesn't exist anywhere on
the frontend's `GameHistoryDto` interface. Every other field lines up
one-to-one, including nullability — the frontend model already marks the
per-phase and player fields as `string | null`, so it was already
structurally ready for a row that has some fields analysed and others not;
it just has no way today to represent "this row is a job in progress, not a
finished game at all," which is exactly what `status` now exists to carry.

There's a second, non-type-level mismatch worth naming:
`GameHistoryService.listGames()` returns `Observable<GameHistoryDto[]>` —
the backend controller's method name (`getAllGames`) and return type
(`List<GameHistoryItemDto>`) are a different Java type by design (see the
job-status proposal's section 3: `GameHistoryDto`/`findHistoryByChat` were
deliberately left unchanged; `GameHistoryItemDto` is the new wire type). A
future real HTTP implementation of `GameHistoryService` would need to speak
`GameHistoryItemDto`'s shape, not the existing frontend `GameHistoryDto`
interface's.

## Why this isn't breaking anything right now

Per `CLAUDE.md`'s MVP scope and `history-endpoint-contract.md`'s section 7
("Still do not point `GameHistoryService` at a real HTTP call"):
`GameHistoryService` is an abstract class with a mock implementation backing
it today — nothing in the frontend currently deserializes a real HTTP
response into `GameHistoryDto`. And separately, `GET /history` itself is
still not reachable end-to-end regardless of shape: Telegram auth validation
(`TelegramInitDataService.validateAndGetUserId`) is still an unconditional
`return null` — re-confirmed today, see the auth status note below. So there
is no live code path anywhere that would hit this mismatch today.

## Severity

**P1 — confirmed, will cause a real break once the real endpoint is wired,
not urgent today.** Not P0, because nothing live depends on it yet (both the
frontend mock seam and the backend's non-functional auth independently block
any real traffic from ever exercising this). Not P2, because it's no longer
speculative — the backend's shape has concretely moved since the frontend
types were last written, and whoever wires up the real HTTP call next (after
issue #1 lands) needs to know to update the frontend model first, not
discover it as a runtime deserialization surprise.

## What would need to change (for Frontend's future call, not implemented here)

- Add a `status: 'DONE' | 'RUNNING' | 'WAITING'` field to the model (or a
  parallel type) that will back `GameHistoryService`'s real implementation.
- Decide whether to keep `GameHistoryDto` as the model name or rename it to
  track the backend's `GameHistoryItemDto`, and whether `listGames()`'s
  return type changes accordingly.
- `GamesPage`'s row rendering (`HANDOFF.md` section 4's done/running/waiting
  status-line table) is the actual consumer this field exists for — today it
  presumably has no real data to drive that three-state row at all, since
  the mock fixtures predate this backend change.

None of the above is this document's call to make or implement — per the
standing split, Frontend owns the Angular types and decides if/when to touch
them; this is the tracked record that the gap is now confirmed and
field-exact, for whenever the user decides to wire the real endpoint up.

## Auth status (re-confirmed, unchanged, read-only)

`TelegramInitDataService.validateAndGetUserId`
(`kaizan-companion/src/main/java/.../miniapp/TelegramInitDataService.java`)
still unconditionally `return null;` (line 25). Line 20 is a bare,
non-`//`-prefixed URL
(`https://core.telegram.org/bots/webapps?utm_source=chatgpt.com#validating-data-received-via-the-mini-app`)
— it compiles only because `https:` parses as a Java label and the `//` that
immediately follows it starts a line comment consuming the rest of the line;
it is leftover scratch content, not functioning code, and not something
flagged as broken — just confirming it is exactly as inert as it looks.
**This remains the user's own reserved work and was not touched.**

**P0, unresolved:** every `MiniAppController` route sits behind this stub.
Any request today resolves to a `null` Telegram user id, meaning these
routes are not actually authorization-protected yet — they 500 before
reaching any data (`findById(null)`), rather than leaking data, but there is
currently no real identity check in front of `GET /history` at all. This was
already known and is restated here only because this audit was asked to
re-confirm it, not because anything changed.
