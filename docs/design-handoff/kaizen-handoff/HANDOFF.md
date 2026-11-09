# Kaizen Companion Mini App — design handoff

This covers the games menu and the exercise screen, as drawn on the design canvas "Kaizen Companion — Practice Mini App" (private until shared): https://claude.ai/artifact/NqF2MnBQxh3WLSMzcJfxZR

Frontend: Angular, board via the Sabaki stack. See `AGENTS.md` for the board and SGF rules. Copy is English. All sizes are CSS px at a 390 px wide viewport.

## 1. Flow

```
Telegram chat ── "Open in Kaizen" (bot menu button)
      │
      ▼
Games (root) ── tap an analyzed game ──▶ Exercise ── Correct ──▶ Play again / Back to games
      ▲                                     │
      └──────── Telegram BackButton ────────┘
```

**Entry: "Open in Kaizen"**

- It is the bot's menu button in the chat, set with `setChatMenuButton` and a `MenuButtonWebApp` (`type: "web_app"`, `text: "Open in Kaizen"`).
- It is native Telegram UI, so there is nothing to build in the app.
- The Mini App opens on **Games**.

**Games**

- The list of games exported to Kaizen from OGS and DGS.
- Only analyzed games open an exercise.

**Exercise**

- Opens at the user's biggest mistake in that game.
- The user finds KataGo's move, then keeps KataGo's line for 5 of their own moves. The opponent's replies are played automatically.

**Later (drawn on the canvas, not in the app yet)**

- `/practice` sends a link that opens a session of 3 exercises directly.
- Section 6 lists what changes in that mode.

## 2. Canvas map

| Row | Artboards | What they show |
|---|---|---|
| 1 · Open in Kaizen → games → exercise | Main, GamesLight, Game19, Game13, Game9, GameDone | Menu in both themes, one exercise per board size, the Correct state |
| 2 · Exercise states | Light, Review, Board13, Loading, SgfError | Confirm move, Incorrect, illegal move, loading, unreadable SGF |
| 3 · Later: /practice session | Replay, Board9, SessionError | Session mode: exercise 1 of 3, Finish, expired link |

- The canvas is interactive: rows link to their exercise, Back returns to Games, and the board can be played.
- `Replay.dc.html` holds the whole exercise logic, including the rules engine, zoom and every copy string.

## 3. Foundations

### Colour

Choose the palette from `Telegram.WebApp.colorScheme`. Paint Telegram's chrome with `setHeaderColor` and `setBackgroundColor`, using `base`.

| Token | Yoru 夜 (dark) | Washi 和紙 (light) | Use |
|---|---|---|---|
| `base` | `#0F1B2D` | `#F1E6CC` | Page background, under the washi texture |
| `ink` | `#F1E6CC` | `#1C1A17` | Main text, outlined buttons |
| `hint` | `#A7B3C4` | `#5C5244` | Secondary text, meta, counts |
| `rule` | `rgba(241,230,204,.28)` | `rgba(28,26,23,.28)` | Button outlines, progress track |
| `rule-list` | `rgba(241,230,204,.18)` | `rgba(28,26,23,.20)` | Row dividers, filter baseline |
| `primary` | `#E0B45A` gold | `#1F3A5F` indigo | Primary button fill, pressed Hint outline |
| `on-primary` | `#1C1A17` | `#F1E6CC` | Primary button text |
| `pressed-bg` | `rgba(224,180,90,.16)` | `rgba(31,58,95,.10)` | Hint button while on |
| `disabled-bg` | `rgba(241,230,204,.08)` | `rgba(28,26,23,.06)` | Disabled "Loading…" button |
| `shu` (text) | `#EE7253` | `#A8301B` | Incorrect, Won |
| `pine` (text) | `#6CC09D` | `#2A604E` | Correct, Good move, "Biggest mistake · move N" |

Shared in both themes:

- `#D9472B` vermilion: the last-move dot, the active filter underline, and the ✕ on a wrong stone.
- `#B8361F`: the 2 px ring around a wrong stone.

Text colours hold 4.5:1 on their own base. Use only one accent per state.

### Board

| Board | Wood | Lines | Star points | Coordinates | Grain opacity | Hint ring / fill |
|---|---|---|---|---|---|---|
| Kaya (default) | `#DCAE5E` | `rgba(28,22,12,.85)` | `#1C160C` | `rgba(28,22,12,.82)` | .45 | `#1F3A5F` / `rgba(31,58,95,.25)` |
| Washi | `#EFE3C8` | `rgba(40,34,26,.72)` | `#28221A` | `rgba(40,34,26,.80)` | .30 | `#1F3A5F` / `rgba(31,58,95,.20)` |
| Ai 藍 | `#1F3A5F` | `rgba(241,230,204,.50)` | `rgba(241,230,204,.90)` | `rgba(241,230,204,.85)` | .12 | `#E0B45A` / `rgba(224,180,90,.28)` |

**Board geometry**

- The board is full width (390) with a 16 px coordinate band: numbers on the left, letters along the bottom, IBM Plex Mono 500 at 9–12 px.
- Star points are 20 % of the grid spacing, at least 4 px.
- The edge lines are 1.6 px; inner lines are 1 px.

**Stones**

- A stone's diameter is 94 % of the grid spacing.
- Black: `radial-gradient(circle at 32% 28%, #4A4A4E 0%, #1E1D1F 32%, #121113 100%)` with shadow `0 1.5px 0 rgba(0,0,0,.35)`.
- White: `radial-gradient(circle at 32% 28%, #FFFFFF 0%, #F4ECDA 45%, #E0D3B8 100%)` with shadow `inset 0 0 0 1.2px rgba(30,26,20,.85), 0 1.5px 0 rgba(0,0,0,.25)`.

**Grain**

- Lay `assets/board-grain.jpg` over the wood with `mix-blend-mode: multiply`, at the opacity from the table.
- Shudan draws the board. Apply these values through its stylesheet hooks; see the Styling section of the Shudan docs for the class and variable names. Don't fork its CSS.

### Type

- IBM Plex Sans 400/500/600/700 for UI.
- IBM Plex Mono 400/500 for coordinates, counts and step labels.

| Role | Size / line | Weight |
|---|---|---|
| Games title | 32 / 38, −0.02em | 600 |
| Intro · list section titles | 15 / 21 · 15 / 19 | 400 · 600 |
| Filter tab · its count (Mono) | 15 · 13 | 700 · 400 |
| Row name · rank | 17 / 22 · 13 | 700 · 400 |
| Row meta · status | 13 / 18 | 400 · 500 |
| Row outcome · result | 15 · 12 | 600 · 400 |
| Turn line (exercise) | 20 / 26, −0.015em | 600 |
| Exercise meta | 13 / 18 | 400 |
| Message title (Incorrect / Correct) | 18 (24) / 1.2 | 600 |
| Message body | 14 / 20 | 400 |
| Primary button | 17 (16 in the two-button Correct row) | 700 |
| Tool button | 15 | 500 |

### Shape and spacing

- Radius is 3 px on buttons and the banner, and 50 % on stones and the avatar. Nothing else is rounded.
- No shadows except on stones.
- Touch targets are at least 44 px. Primary buttons are 52 px tall.
- Page gutter is 16 px. The tools row uses 8 px gutters and an 8 px gap.

### Textures and assets (`assets/`)

| File | Size | Use |
|---|---|---|
| `washi-night.jpg` / `washi-light.jpg` | 780×1688 (2×) | Full-screen paper behind everything, `object-fit: cover` |
| `seigaiha-night.jpg` / `seigaiha-light.jpg` | 780×640 (2×) | Waves filling the free space under the actions (below) |
| `board-grain.jpg` | 748×748 | Wood grain on the board |
| `kaizen-banner.jpg` | 1200×400 | Banner on Games, 358×104, `object-position: 50% 45%` |
| `kaizen-avatar@2x.png` | 72×72 | Kaizen robot avatar in the message, 36 px circle |
| `kaizen-logo.jpg` | 256×256 | Source of the avatar crop |

The waves sit under the actions:

- They fill the remaining height, anchored to the bottom (`object-position: bottom`).
- They fade in from the top with the mask `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.55) 45%, #000 100%)`.
- They may extend 64 px into the bottom safe area.

## 4. Games (root)

The header is Telegram's own (Close · Kaizen Companion · ⋯). Don't draw it; set its colour. The BackButton is hidden here.

**Top of the screen, in order:**

1. Banner, 358×104.
2. Title "Games".
3. Intro: "Exported to Kaizen from OGS and DGS. Tap an analyzed game to practice your biggest mistake."
4. Filter tabs "All · OGS · DGS", each with a Mono count.
   - The active tab is `ink` with a 2 px `#D9472B` underline; the others are `hint`.
   - Tabs use `aria-pressed`.

**List**

- Newest first, grouped under "Today" and "Earlier" (`h2`).
- Rows are at least 78 px tall, with 12 px vertical padding and 1 px `rule-list` dividers (none above the first row of a group).

**Row anatomy:**

- **Thumbnail**, 44×44:
  - a Kaya square with that board size's grid, lines `rgba(28,22,12,.55)`
  - the user's colour as an 18 px stone at the bottom-right corner, offset −5 px, with a 2 px ring in `base`
- **Name + rank:** e.g. "kitsune77 4k".
- **Meta:** `{size}×{size} · {server} · {moves} moves · {date}`, e.g. "19×19 · OGS · 91 moves · Yesterday".
- **Status line:**

  | Analysis | Text | Colour | Row |
  |---|---|---|---|
  | done | "Biggest mistake · move {n}" | `pine` | A link to its exercise, with a chevron |
  | running | "KataGo is analyzing…" | `hint` | Not tappable, no chevron |
  | waiting | "Queued for analysis" | `hint` | Not tappable, no chevron |

- **Right side:** "Won" (`shu`) or "Lost" (`hint`) above the result ("B+R", "W+4.5").
- **Accessible name** of a tappable row: "{opponent}, won|lost {result}, {n} by {n}, {status}".

## 5. Exercise

### Layout, top to bottom

**1. Telegram header.** Show `BackButton`; its click returns to Games.

**2. Context block** (padding 12 16 14):

- Turn line: a 14 px stone in the user's colour, then "{Black|White} to move".
  - While the opponent replies, it shows their colour.
  - At the end it reads "Line complete", without the stone.
- Meta line: `vs {opponent} · {server} · move {n}`.
- Progress: 5 nodes joined by 1 px lines, followed by "Step k/5" in Mono 12 `hint`.

  | Node | Look |
  |---|---|
  | done | Filled `ink` |
  | current | 1.5 px `ink` ring with a 2.5 px centre dot |
  | ahead | 1.5 px `hint` ring |

  The connecting lines are `ink` up to the current step and `rule` after it.

**3. Board**, full width.

- 19×19 opens zoomed on the mistake. The window is computed like this:
  1. Take the mistake, KataGo's line and the previous move, plus 1 line of padding.
  2. Snap to an edge that is 3 lines away or closer.
  3. Make it at least 9 columns wide.
  4. Add rows until the board is about 470 px tall.
  5. If that covers all but one row, show the full board.
- Shudan: pass the window as `rangeX` and `rangeY`.
- 9×9 and 13×13 normally fit, so the zoom toggle is disabled.

**4. Tools**, three equal outlined buttons, 44 px tall:

- **Hint** toggles a ring on the next correct point.
  - While on, its outline is `primary`, its fill is `pressed-bg` and it has `aria-pressed`.
  - It turns off when the line is complete.
- **Reset** restarts the exercise.
- **Full board / Zoom in** toggles the zoomed window.
- Disabled tools are at 40 % opacity.

**5. Kaizen message** (margin 14 16 0):

- A 36 px avatar, then a title and a body.
- The title has `role="status"` so screen readers announce changes.

**6. Actions** (margin 12 16 0). They change with the state; see section 5's state table.

**7. Seigaiha waves**, then a 16 px bottom safe area. Use Telegram's `safeAreaInset` / `contentSafeAreaInset` where available.

### Placing a stone

1. Tapping an empty point runs the legality check (go-board `analyzeMove`).
2. If the point is illegal (suicide, ko), a dashed 2 px ring appears on it and the message explains why. It isn't a wrong try, and no preview is shown. Occupied points have no tap target.
3. If it is legal, a preview stone appears at 55 % opacity, and the actions become **Play {coord}** and **Cancel** (✕ icon, `aria-label="Cancel"`).
4. Tapping the same point again, or pressing Play, confirms the move.
5. If the move is not KataGo's, the state becomes **Incorrect**.
   - The user's stone stays, with a 2 px `#B8361F` ring and a `#D9472B` ✕ at 60 % of the stone's size.
   - The action becomes **Try again**, which returns to the same position.
6. If it is KataGo's, the message shows "Good move", and the opponent's reply from KataGo's line is played after about 900 ms.
7. After 5 correct moves the state becomes **Correct**.

Other behaviour:

- The last move is marked with a `#D9472B` dot, 34 % of the stone's diameter.
- Each tap target is labelled "Play {coord}".
- Haptics: `HapticFeedback.notificationOccurred('error')` on Incorrect and `'success'` on Correct.
- Call `disableVerticalSwipes()` so swiping on the board doesn't minimize the app.

### States and copy

Coordinates use letters A–T without I, and rows counted from the bottom, e.g. S16.

| State | Message title | Message body | Actions |
|---|---|---|---|
| Start | Your biggest mistake: {coord} | Find a better move for {Black\|White}, then keep going for 5 moves. | — |
| Preview | (unchanged) | (unchanged) | Play {coord} · Cancel |
| Opponent replying | Good move (`pine`) | {Black\|White} is answering… | — |
| Mid-line | Keep going | Follow KataGo's line — move {k} of 5. | — |
| Incorrect (the game move) | Incorrect (`shu`, 24) | That's the move you played in the game. Look again. | Try again |
| Incorrect (other move) | Incorrect (`shu`, 24) | That's not KataGo's move here. | Try again |
| Illegal: suicide | Not a legal move | {coord} would have no liberties — that's suicide. Try another point. | — |
| Illegal: ko | Ko | You can't retake at {coord} right away. Play elsewhere first. | — |
| Correct | Correct (`pine`, 24) | All 5 moves of KataGo's line. One step better than yesterday. | Play again (outlined) · Back to games (primary) |
| Loading | One moment | Fetching the game and KataGo's analysis… | Loading… (disabled) |
| Server error | Kaizen didn't answer | Go back and open the game again in a moment. | Back to games |
| Unreadable SGF | Couldn't read this game | Its game record is damaged. Pick another game from the list. | Back to games |

How the context block reads in each state:

- **Loading:** turn line "Loading game"; meta `vs {opponent} · {server}`.
- **Errors:** turn line "Game unavailable"; same meta.
- **Loading board:** the game's empty board at 45 % opacity. The size is known from the row.
- **Both loading and errors:** progress and tools are hidden.

### Suggested Angular components

- **`GamesPage`**
  - `ServerFilter` (tabs)
  - `GameSection`
  - `GameRow`: `<a>` when analyzed, plain element when not
- **`ExercisePage`** holds one state machine:
  - `screen`: `loading | ready | error | sgfError`
  - `phase`: `play | reply | wrong | done`
  - plus `preview`, `illegal` and `step`

  Its children:
  - `ExerciseContext`: turn line, meta, progress
  - `GobanView`: the Shudan adapter from `AGENTS.md`
    - preview → `ghostStoneMap`
    - last move, hint and illegal markers → `markerMap` / `selectedVertices`, with CSS for the dashed and ✕ looks
  - `ExerciseTools`
  - `KaizenMessage`
  - `ExerciseActions`
- **Shared**
  - `TelegramService`: theme, BackButton, haptics, swipes, safe areas; must work without Telegram
  - `PaperBackground`
  - `SeigaihaFill`
  - `StoneDot`

## 6. Later: /practice session mode

The same exercise screen, opened from a `/practice` link with 3 exercises. Only these things change:

| | From the menu (now) | Session (later) |
|---|---|---|
| Header | Telegram BackButton → Games | Close only (no BackButton) |
| Meta | vs {opponent} · {server} · move {n} | Exercise {i} of 3 · vs {opponent} · move {n} |
| Skip | Hidden | Shown, except on exercise 3 |
| Correct actions | Play again · Back to games | Play again · Next exercise (exercise 3: Finish → `Telegram.WebApp.close()`) |
| Correct body | …One step better than yesterday. | On exercise 3: …That's the session: 3 of 3 done. |
| Loading | Game's empty board · "Loading game" | Empty 19×19 · "Loading session" · "Fetching 3 positions from your last games…" |
| Errors | Back to games | Expired link: "This link no longer works" · Send /practice in the chat to get a new session. · Back to chat. Bad SGF: Next exercise / Finish |

## 7. Data the screens need

The backend contract isn't defined yet. These are the fields the design shows.

**Each game in the list:**

- id
- opponent name and rank
- board size
- server (OGS / DGS)
- move count
- date played
- the user's colour
- result (e.g. B+R)
- won/lost
- analysis status: done / running / waiting
- when done, the move number of the biggest mistake

**Each exercise:**

- the SGF up to the position before the mistake
- the mistake move
- KataGo's line: at least 9 plies, for 5 user moves and 4 replies
- the user's colour

The canvas sample data follows this exactly.

## 8. Open questions

1. **Scope conflict with `AGENTS.md`.** That file's MVP says "Do not evaluate move correctness" and "Do not implement /practice yet". It also limits taps to existing SGF continuations. The flow chosen here opens a judged exercise, with Incorrect/Correct and free point taps. One of the two needs to change before implementation.
2. **Empty and failed states for the list itself:** no exported games yet, or the list fails to load. Not drawn yet.
3. **The ⋯ menu in Telegram's header:** whether it should hold any app items. Not specified.
