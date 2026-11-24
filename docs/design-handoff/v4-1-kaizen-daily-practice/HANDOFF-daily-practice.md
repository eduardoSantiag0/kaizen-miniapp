# Handoff — Daily Practice

New: Daily Practice Home, Practice Settings and Practice Complete, plus a Daily practice button on Games. The exercise screen is the existing one with a new **daily** mode. Everything else stays as in the earlier handoffs.

Canvas: https://claude.ai/artifact/NqF2MnBQxh3WLSMzcJfxZR (private until shared). The new rows:

- **"Daily practice — home & settings":**
  - DailyHome (new session)
  - DailyContinue (in progress, light)
  - DailyDone
  - DailySettings
  - DailyLoading
  - DailyEmpty (light)
  - DailyError
- **"Daily practice — exercises":**
  - DailyEx
  - DailyReply
  - DailyLine (Exercise Complete)
  - DailyEx2 (light)
  - DailyLast (nothing deeper → Finish)
  - DailyFinished

Every artboard is interactive and they link to each other. You can play a whole exercise, including Go deeper.

**Files in `assets/`**

- **Icons**, all `currentColor`:
  - `icon-chevron.svg`
  - `icon-settings.svg`: Practice settings row
  - `icon-another-line.svg`: Try another line
  - `icon-go-deeper.svg`: Go deeper
  - `icon-check.svg`: Solved
- **Textures, the same as the rest of the app:**
  - `ink-rule-night.png` / `ink-rule-light.png`: row separators
  - `board-grain.jpg`: thumbnails and the settings example
  - `washi-night.jpg` / `washi-light.jpg`: page background
  - `seigaiha-night.jpg` / `seigaiha-light.jpg`: bottom waves

---

## 1. What is reused and what is new

This is based on the current design on the canvas. I didn't have access to the `kaizen-miniapp` code.

| Part | Reused as is | Adapted | New |
|---|---|---|---|
| Palettes, type, washi, seigaiha, printed ink rules | ✓ | | |
| Board (Shudan adapter, zoom on the mistake, coordinates) | ✓ | | |
| Move entry: tap to preview, tap again or Play to confirm; illegal points refused | ✓ | | |
| Incorrect state (brush ✕, Try again), opponent reply ("Good move", last-move dot) | ✓ | | |
| Context block (turn line, "Exercise k of n", ● ◉ ○ progress) | ✓ | Step count follows the depth setting | |
| Exercise header | | Back (saves) instead of Close | |
| Tools row | | Hint removed, so 2 columns: Reset · Full board | |
| Line complete actions | | Next exercise / Try another line / Go deeper | |
| Game thumbnails (9×9 window, real position) | ✓ on Home rows | | |
| Games screen | | One button added above the filters | |
| Daily Practice Home, Practice Settings, Practice Complete | | | ✓ |

---

## 2. Flow

```
Games ── [Daily practice ›] ──▶ Daily Practice Home ──▶ Practice Settings
                                     │  Start / Continue
                                     ▼
                               Exercise k of n ──(wrong)──▶ Incorrect ─▶ Try again
                                     │ line complete
                                     ▼
                       Exercise Complete ── Try another line ─▶ same exercise, from the start
                         │        └──────── Go deeper (+2) ───▶ same line, continued
                         │ Next exercise (Finish practice on the last one)
                         ▼
                     … up to n ≤ 5 …  ──▶ Practice Complete ── Done ─▶ Home (complete)
                                                         └── Review exercises ─▶ Exercise 1
```

- **Back:** the Telegram BackButton always goes one level up: Exercise → Home → Games. Progress is saved first (section 8).
- **Exploring doesn't count toward the session.** Try another line and Go deeper never add to n, so the session is done after n exercises.

---

## 3. Games: the Daily practice button

It sits between the description and the All · OGS · DGS filters. It is part of the screen, not of the filtered list.

**Layout**

- An `<a>` 56 px tall (minimum), with `padding: 8px 10px 8px 14px` and `border-radius: 3px`.
- Background `bar-bg` with a 1 px inset `bar-edge`: the same look as Try again.
- Contents, left to right:
  1. **Session glyphs**, in a 44 px box: one 10 px node per exercise, joined by 1 px lines. ● done · ◉ next · ○ ahead.
  2. **Text:** "Daily practice" (15 / 20, 600), and under it "3 exercises today" (13 / 18, `hint`).
  3. **Chevron**, 18 px, `hint`.
- The subtitle and the glyphs follow the session:
  - "3 exercises today" before starting
  - "1 of 3 done" in progress
  - "Done for today" when complete
- `aria-label`: "Daily practice: 3 exercises today".

**When it's hidden:** while the list loads, fails or is empty, and when no game has mistakes to practise.

**Why:** the practice is the main reason to open Kaizen daily, but Games stays the home. The button reads as an action, not as another game row.

---

## 4. Daily Practice Home (DailyHome)

The header is Telegram's: the BackButton returns to Games.

**Content, top to bottom** (16 px gutters):

1. **Date** (13 / 18, `hint`), e.g. "Monday, 23 November".
2. **Title** "Daily practice" (26 / 32, 600).
3. **Description:** "Positions from your own games, where KataGo found a better move." (14 / 20, `hint`)
4. **Session track**, 18 px below:
   - one 14 px node per exercise, with 1 px lines between them
   - the label on the right in Mono 12, `hint`: "3 exercises" / "1 of 3 done" / "3 of 3 done"
5. **Exercise list:** one row per exercise, in session order, separated by printed ink rules.
   - The thumbnail is 56 px: the real position, with the user's colour stone at the corner.
   - Text: "vs **kitsune77** 4k", then "Black to play · 19×19 · move 75".
   - Status on the right, 13 / 18, 600:
     - **Solved:** ✓ and "Solved" in `ink`; the row drops to 60 % opacity.
     - **Next:** "Up next" in `accent` (gold dark / indigo light).
     - **Ahead:** nothing.
   - Rows are **not links**. One main button drives the session, so there is a single obvious action.
6. **Main button**, 52 px, `primary`, 14 px below the list:
   - **Start practice**, with the note "3 exercises today · your progress is saved as you go"
   - **Continue practice**, with the note "Exercise 2 of 3 · picks up where you left"
   - The note is 13 / 18 `hint`, centred under the button.
7. **Practice settings row**, 56 px tall, with an ink rule above:
   - a sliders icon
   - "Practice settings" (15 / 20, 600)
   - the current values: "Top 3 moves accepted · 4 moves deep"
   - a chevron
   - It opens Practice Settings.

**States**

| State | Artboard | What changes |
|---|---|---|
| New session | DailyHome | Track ○○○ · "Up next" on row 1 · **Start practice** |
| In progress / interrupted | DailyContinue | Track ●◉○ · row 1 Solved · **Continue practice** opens the next unsolved exercise at the saved position |
| Complete | DailyDone | Track ●●● · all Solved · no main button. Instead: "Practice complete" (18 / 24) and "All 3 exercises done. Your next practice comes from your next analyzed games." with **Review exercises** (44 px, `bar-bg`) |
| Fewer than 5 | all | Show the real count everywhere: track, label, button note. Never pad to 5 |
| No exercises | DailyEmpty | "No exercises yet" / "Kaizen builds your practice from games KataGo has analyzed. Export a game, and once it's analyzed your exercises appear here." and **Go to games** |
| Loading | DailyLoading | Placeholders for the track, three rows and a disabled "Loading…" button. `role="status"` |
| Connection error | DailyError | "Couldn't load today's practice" / "Check your connection and try again. Your progress is saved." and **Try again** |

---

## 5. Practice Settings (DailySettings)

The BackButton returns to Home.

- **No Save button.** Values are saved as they change, and they apply from the next exercise. The screen says so under the title.
- Each setting has:
  - a title, with its value in Mono 20 on the right
  - one sentence of plain language
  - a small example that follows the slider
  - the slider
- **Wording:** neither setting says "variant", "node" or "tree".

### Accepted first moves (Top Variants, N)

- **Slider** 1–5, default **3**. It is a native `input[type=range]`, 44 px tall, `accent-color: primary`, with Mono 12 min/max labels.
- **Sentence:** "How many of KataGo's best first moves count as correct. Each one opens its own line to explore."
- **Example:** a 358 × 104 strip of Kaya board, 10 × 3 lines at 36 px, with a few stones. Five candidate points are lettered **A–E**, the way game records mark alternatives.
  - **Accepted** (the first N): 28 px circle, 2 px `#1C1A17` ring, a paper-tinted fill and the letter in ink.
  - **Not accepted:** 1 px dashed ring at 55 % opacity.
- **Caption:** "Example. A to C count as correct: KataGo's 3 best first moves." When N = 1: "Only A, KataGo's first choice, counts as correct."

### Moves after the first (Continuation Depth, M)

- **Slider** 2–10, default **4**.
- **Sentence:** "How far each line goes after your first move, counting your moves and your opponent's replies."
- **Example:** the line as **numbered stones**, 28 px with a 4 px gap, the way game records number moves.
  - Stone 1 is the user's first move, with a 2 px gap and a 4 px ring in `primary`.
  - Then M more stones, alternating colours.
- **Caption:** "Your first move, then 4 more: 2 yours and 2 replies." For odd M the line ends on a reply: "then 5 more: 2 yours and 3 replies".
- **Note:** "After a line, Go deeper adds 2 more moves at a time, up to 10, wherever KataGo analyzed further."
- **Accessibility:** the sliders use `aria-labelledby` on the title and `aria-valuetext`, e.g. "3 first moves accepted".

---

## 6. Exercise in daily mode (DailyEx, DailyReply, DailyLine, DailyEx2, DailyLast)

This is the existing exercise screen. Only these things change in daily mode:

| | Daily mode |
|---|---|
| Header | Telegram BackButton → Home. Progress is saved first |
| Context | "Exercise k of n · vs {opponent} · move {n}"; no Skip (not in scope) |
| Progress | ● ◉ ○ "Step k/s", where s = number of user moves in the line (section 7) |
| Tools | **Reset · Full board**. Hint is removed: it would show the line before it is solved |
| Opening message | "Your biggest mistake: S16" / "Find a better move for Black, then keep going for 3 moves." |

**Move feedback**

These are the existing patterns, and none of them is a modal:

| Event | Board | Message (under the board) | Can't be read by colour alone because… |
|---|---|---|---|
| Tap a legal point | Preview stone at 55 % opacity | Play {coord} / Cancel | — |
| Tap an illegal point | Dashed ring | "Not a legal move — … suicide" / "Ko — …" | Text explains |
| Correct move | Stone placed, last-move dot | **Good move** (`pine`) · "White is answering…" | The word |
| Opponent reply | Stone appears after ~900 ms; the dot moves to it; the turn line shows the opponent's colour while waiting | | Turn line text |
| Incorrect move | The user's stone with the brush ✕ and a 2 px ring | **Incorrect** (`shu`, 24) · "That's not KataGo's move here." + **Try again** | ✕ shape + word |
| Line complete | | **Correct** (`pine`, 24) + Exercise Complete actions | The word |

- An incorrect move never advances the line. Try again keeps the position.
- **Why keep tap-to-preview plus confirm:** on 19 × 19, the zoom gives about 26 px per line, which is still tight for a thumb. Two taps prevent misplays and cost little; illegal points are refused before the preview.
- **Reduced motion:** when `prefers-reduced-motion` is set, don't animate stone placement. The reply pause stays, because it isn't animation; it lets the user see whose turn it is.

### Exercise Complete (DailyLine, DailyLast)

When the line is complete, the tools row is hidden. Its space goes to the actions:

```
[ ⑂ Try another line ]  [ ⌄⌄ Go deeper +2 ]     44 px, outlined, secondary
[            Next exercise              ]       52 px, primary, nearest the thumb
```

- **Next exercise** is the main action, and the bottom one, nearest the thumb.
  - On the last exercise it becomes **Finish practice**, which opens Practice Complete.
- **Try another line** goes back to the starting position with the depth reset to the setting.
  - The user then plays any other accepted first move.
  - The board still accepts all N; the user picks a different one.
- **Go deeper** adds 2 plies to the same line.
  - If the next ply is the opponent's, it is played automatically first.
  - When KataGo has nothing further, the button stays visible, **disabled at 40 % opacity**. The message explains: "Line complete — that's as far as KataGo analyzed it." Its `aria-label` is "Go deeper: no further analysis on this line".
  - **Why disabled and not hidden:** users learn the action exists, and the message says why it's off.
- **Message while more is available:** "Line complete. Go deeper to keep playing it, or try another first move." Both explore actions are named, so they are easy to find, but nothing forces them.

---

## 7. Line length and Go deeper

These come from the setting and the SGF:

- **Plies in the line:** `plies = min(1 + M, plies available in the SGF branch)`.
- **User moves:** `ceil(plies / 2)`. That is the "Step k/s" total.
  - M = 4 gives 5 plies: you · reply · you · reply · you. That is 3 moves for the user.
  - With odd M the line ends on the opponent's reply.
- **Go deeper:** `M ← min(10, M + 2)`. Enabled only if that gives more plies than now.
  - The sample lines have 9 plies, so M goes 4 → 6 → 8. After that, Go deeper is disabled.
- **Accepted moves:** only moves on an accepted branch count.
  - At the first move, KataGo's top N candidates.
  - After that, the move the branch holds at that node.
  - Anything else, including legal but unknown moves, is incorrect.

---

## 8. Practice Complete (DailyFinished)

The BackButton returns to Home (complete).

1. **Track** with every node filled, and "3 of 3 done".
2. **"Practice complete"** (26 / 32), then "One step better than yesterday." (15 / 21, `hint`). This is Kaizen's own line, already used when a line is completed.
3. **Three plain facts**, separated by ink rules: the value in Mono 30 / 34 in a 44 px column, the label in 16 / 22 `hint`.
   - **3** exercises completed
   - **2** solved on the first try
   - **1** incorrect move
4. **Buttons:**
   - **Done** (52 px, primary) → Home, complete
   - **Review exercises** (44 px, `bar-bg`) → exercise 1. Reviewing doesn't change the session result.

**No points, streaks or ranks.** The track and the plain counts are the feedback.

---

## 9. Progress and persistence

- **Save after every** confirmed move, Try again, Try another line and Go deeper. Save on BackButton too. The Mini App can be closed at any time.
- **What to save:** session id, exercise index, plies played, current depth, incorrect moves per exercise, and whether each exercise was solved on the first try.
- **Continue practice** reopens the first unsolved exercise at the saved position.

---

## 10. Data the screens need

**Session**

- id and date
- n ≤ 5 exercises, in order. For each:
  - opponent and rank
  - board size
  - the user's colour
  - the move number of the mistake
  - the 9 × 9 thumbnail window
  - the SGF: the position plus KataGo's tree, with the top N first moves as branches, each as deep as it was analyzed

**Settings, per user, persistent**

- `topVariants` (1–5, default 3)
- `continuationDepth` (2–10, default 4)

**Progress:** as in section 9.

---

## 11. Suggested Angular components

**New**

- `DailyPracticeHome`: SessionTrack, ExerciseRow (reuses the thumbnail from GameRow), the primary action, SettingsSummaryRow
- `PracticeSettings`: SettingSlider, CandidateExample, SequenceExample
- `PracticeComplete`: SessionTrack, FactList

**Extended**

- `ExercisePage` gets a `mode: 'menu' | 'daily'` input. Daily mode:
  - uses `depth`
  - hides Hint and Skip
  - swaps the done actions for `LineCompleteActions`
- `ExerciseEngine` needs a few changes:
  - **Accepted moves:** compare against the branch's accepted children, instead of a single expected move.
  - **Line end:** use `plies = min(1 + M, branch length)`.
  - **New methods:** `goDeeper()`, which adds 2 to M and plays the opponent's ply when it is next, and `restartLine()`.

**Shared**

- `SessionTrack`, the ● ◉ ○ glyphs. It is used on Games, Home, the exercise and Complete.

---

## 12. Open questions

1. **Try another line when only one move is accepted** (N = 1, or KataGo found one good move). Keep it enabled, which simply restarts as in the prototype? Or disable it, saying "Only one line here"?
2. **Show which line was found?** For example, "Line 2 of 3" on Exercise Complete. It would help exploring, but it hints at how many solutions remain. It is left out for now.
3. **"Incorrect moves" on the summary:** count only the moves made before the exercise was solved, or also the ones made while exploring? The design assumes **before solved**.
4. **Settings changed mid-session:** apply from the next exercise, as designed, or from the next session?

**Prototype limit:** the sample analysis has one accepted line per exercise. In the prototype, Try another line therefore replays the same line.
