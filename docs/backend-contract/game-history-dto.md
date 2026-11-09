# GameHistoryDto — backend contract snapshot

Status: read-only inspection of the backend repo. No backend code was changed to
produce this document. Verified against backend repo commit:

```
e30062cbbc95e650d8795fd1ae5b965ffb5f0567  (2026-11-06 20:49:58 -0300)
```

This matches the last SHA previously recorded for this contract — still current
as of this check.

Backend repo root: `kaizan-companion/` (sibling of this repo).

## 1. Shape

`domain/models/GameHistoryDto.java` (lines 1-13):

```java
public record GameHistoryDto(
        UUID id,
        UUID correlationId,
        String openingAnalysed,
        String middlegameAnalysed,
        String endgameAnalysed
) {
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | `UUID` | `GameAnalysisEntity.id`, primary key of the stored analysis result |
| `correlationId` | `UUID` | `AnalysisJobEntity.correlationId` via the owning job, not the analysis row itself |
| `openingAnalysed` | `String` | Full SGF text (with KataGo annotations) covering the opening phase, or `null` |
| `middlegameAnalysed` | `String` | Full SGF text covering the middlegame phase, or `null` |
| `endgameAnalysed` | `String` | Full SGF text covering the endgame phase, or `null` |

## 2. Confirmed: the three "Analysed" fields are per-phase SGF text

Source of truth for the column types — `domain/entities/GameAnalysisEntity.java`
(lines 26-44):

```java
@Column(name = "opening_analysed", columnDefinition = "TEXT")
private String openingAnalysed;

@Column(name = "midgame_analysed", columnDefinition = "TEXT")
private String middlegameAnalysed;

@Column(name = "endgame_analysed", columnDefinition = "TEXT")
private String endgameAnalysed;

@Column(name = "full_analysed", columnDefinition = "TEXT")
private String fullAnalysedGame;
```

Note: the entity also carries a fourth field, `fullAnalysedGame` (`full_analysed`
column), which is **not** projected into `GameHistoryDto`. The DTO only ever
carries the three per-phase strings plus the two UUIDs.

Proof these are raw SGF text, not some other serialization, comes from how the
only current consumer treats them — `features/handlers/commands/HistoryCommandHandler.java`
(lines 57-81):

```java
List<GameHistoryDto> gamesSaved = gameAnalysisRepository.findHistoryByChat(chatEntity);
...
for (GameHistoryDto game : gamesSaved) {
    sendPhaseIfPresent(chatId, game.openingAnalysed(), GamePhase.opening);
    sendPhaseIfPresent(chatId, game.middlegameAnalysed(), GamePhase.middlegame);
    sendPhaseIfPresent(chatId, game.endgameAnalysed(), GamePhase.endgame);
}

private void sendPhaseIfPresent(Long chatId, String sgf, GamePhase phase) {
    if (sgf == null) return;
    byte[] data = sgf.getBytes(StandardCharsets.UTF_8);
    notificationService.sendMessageToChat(new ReplyWithFile(
            chatId, data, MessageFormatter.requestCompleted(data), phase, UUID.randomUUID()
    ));
}
```

Each phase string is `getBytes()`'d directly into a file attachment and sent to
Telegram as `ReplyWithFile` — this is exactly how the bot currently delivers the
`.sgf` files the user receives in Telegram. The three placeholder files in
`kaizen-miniapp/games_test/` (named `*_OPENING_*.sgf`, `*_MIDDLEGAME_*.sgf`,
`*_ENDGAME_*.sgf`) are standing in for `openingAnalysed`, `middlegameAnalysed`,
and `endgameAnalysed` respectively.

## 3. How the DTO is populated

`domain/repositories/GameAnalysisRepository.java` (lines 17-26), a JPQL
constructor-expression query:

```java
@Query("""
    SELECT new io.github.eduardosantiag0.kaizan_companion.domain.models.GameHistoryDto(
        g.id, g.jobEntity.correlationId, g.openingAnalysed, g.middlegameAnalysed, g.endgameAnalysed
    )
    FROM GameAnalysisEntity g
    WHERE g.chat = :chat
    ORDER BY g.id
""")
List<GameHistoryDto> findHistoryByChat(@Param("chat") TelegramChatEntity chat);
```

Note `correlationId` is pulled from the related `jobEntity`, not stored directly
on `GameAnalysisEntity` — it identifies the analysis job, not the analysis row.

The only caller of `findHistoryByChat` in the backend is `HistoryCommandHandler`
(above), triggered by the Telegram `/history` (`ECommands.HISTORY`) bot command.
There is currently no other code path that reads `GameHistoryDto`.

## 4. No browser-facing endpoint exists yet

The backend currently defines exactly four `@Controller`/`@RestController`
classes:

| Controller | Path | Purpose | Browser-facing? |
|---|---|---|---|
| `KatagoController` | `POST /kaizan/api/v1/katago` | RunPod → backend callback delivering KataGo analysis results. Guarded by a shared-secret header (`X-Kaizen-Secret`), not user auth. | No |
| `TelegramController` | `POST /kaizan/api/v1` | Telegram bot webhook. Guarded by Telegram's own secret header. | No |
| `OAuthController` | `GET /connect/google` | Server-side redirect leg of a Google OAuth flow; writes to the HTTP session, then 302-redirects to Google. No JSON response body. | Technically hit by a browser mid-redirect, but it returns no data and is unrelated to game/analysis data. |
| `MIniAppController` | *(none)* | `miniapp/MIniAppController.java` is an empty `@RestController` stub — annotated but has no `@RequestMapping` and no methods. It is not wired to any path. | N/A — not yet implemented |

**None of these expose `GameHistoryDto`, `GameAnalysisEntity`, or any per-phase
SGF data to a browser or Mini App client.** The only consumer of this data today
is the Telegram bot's `/history` command, which pushes `.sgf` files directly
into the chat.

`MIniAppController` is the obvious scaffold location for a future Mini-App-facing
endpoint, but as of this commit it is empty — it defines no routes, no DTO
mapping, and no auth. **The user is implementing this endpoint themselves,
separately. This document does not propose, sketch, or imply any specific
shape for that endpoint — that is explicitly out of scope for this round.**

## 5. Summary for frontend planning

- Per-phase SGF text exists in the backend and is structurally confirmed (DB
  columns + how the bot already ships it to users).
- There is currently zero REST surface for the Mini App to fetch this data.
- Until that endpoint exists, the frontend must work against local fixtures
  (see `mock-sgf-fixture-gap.md` in this same directory) rather than inventing
  a contract shape for an endpoint that doesn't exist.
