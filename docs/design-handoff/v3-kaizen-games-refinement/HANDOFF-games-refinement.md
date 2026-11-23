# Handoff update — Games screen refinement

Only what changed on the Games screen. Everything else stays as in `HANDOFF.md`.

This update **replaces** the inline Cancel/Delete button from the 23 Nov update. Those actions now live in a ⋮ menu. The Telegram popup, its copy and the pending state stay the same.

Canvas: https://claude.ai/artifact/NqF2MnBQxh3WLSMzcJfxZR (private until shared).

- **Row 1:** Main (dark) and GamesLight.
- **Row 2, "Games — actions & states":**
  - GamesMenu: ⋮ open
  - GamesConfirm: delete popup
  - GamesDeleting
  - GamesLoading
  - GamesEmpty
  - GamesError

Icons are in `assets/`: more, waiting, chevron, delete and cancel. All use `currentColor`.

---

## 1. Tokens

Two tokens are new (`bar-bg`, `bar-edge`). The rest are existing tokens used in new places.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bar-bg` (new) | `rgba(241,230,204,.06)` | `rgba(28,26,23,.05)` | Try again button. Translucent, so the washi and the waves show through |
| `bar-edge` (new) | `rgba(241,230,204,.16)` | `rgba(28,26,23,.18)` | 1 px inset edge of the Try again button |
| `won` | `#A3C2A0` soft sage | `#3E6346` | "Won · …" |
| `lost` / `alert` | `#E8907C` soft coral | `#A4442F` | "Lost · …", and the destructive menu item |
| `menu-bg` | `#192538` | `#FBF5E8` | ⋮ popover |
| `skeleton` | `rgba(241,230,204,.07)` | `rgba(28,26,23,.07)` | Loading placeholders |

**Kept as they were:**

- `base` `#0F1B2D`, `ink` `#F1E6CC` and `hint` `#A7B3C4`.
- The brief's reference colours (`#101B2D`, `#E9DCC4`, `#AAB2C3`) are within a step of these, so no new values were added for them.
- The brief's "Practice mistakes" bar (`#192538` fill, `#D7AE85` copper icon) was tried and removed. It didn't fit the rest of the screen, so the row plus an arrow does the job instead (section 5).

**Contrast:** every text colour above holds at least 4.5:1 on its background.

**Not used here any more:**

- Pine green (it was on "Biggest mistake").
- Vermilion for "Won".

---

## 2. Header (compacted)

| | Before | Now |
|---|---|---|
| Banner | 358 × 104 | Full width × **80**, `object-position: 50% 42%` |
| Title | 32 / 38 | **26 / 32**, 600 |
| Description | 15 / 21, two lines | **14 / 20**: "Review your games and practice your biggest mistakes." |
| Gaps (banner · title · filters) | 18 px | **12 px**. The title and description are 2 px apart. |

**Filters:** unchanged. All · OGS · DGS with Mono counts, the printed ink rule and the brush mark under the active tab.

- The gap between tabs is now 24 px.
- Each tab is at least 44 px wide.

The list starts about 60 px higher than before.

---

## 3. Grouping

Groups are **Today / Yesterday / Earlier**. Only groups that have games are shown, so a short list doesn't get empty headings.

The time column in the metadata depends on the group:

- **Today and Yesterday** show the time (`21:40`).
- **Earlier** shows the date (`Nov 6`).

Group titles are 14 / 19, 600, `hint`.

---

## 4. Row

```
┌──────┐  vs kitsune77 4k                          ⋮
│ 9×9  │  Won · B+R   OGS · 19×19 · 21:40          ›
└──────●
```

Padding is 12 px on top and 14 px at the bottom. The thumbnail column is 56 px wide, with a 12 px gap. Rows are separated by the printed ink rule, as before.

The order follows the brief's hierarchy:

1. **Opponent**
   - "vs" in 14 `hint`, then the name in 17 / 22, 700, `ink`, then the rank in 13 `hint`.
   - When the rank is missing, it is simply omitted.
   - Long names **wrap** (`flex-wrap`, `overflow-wrap: anywhere`) and are never cut.
2. **Result:** "Won · B+R" / "Lost · W+12.5", 14 / 20, 600, in `won` / `lost`.
   - The word carries the meaning, so it still reads without colour.
   - Always show the full margin or reason.
3. **The arrow**: the row opens the exercise (section 5).
4. **Metadata:** `{server} · {size}×{size} · {time or date}`, 13 / 20, `hint`.
   - It sits on the same line as the result.
   - It wraps to its own line when space runs out. Both parts are `nowrap`, so it never shows an ellipsis.

**Removed from the metadata:** the move count. If the number in the current app ("6 moves") means moves analyzed or selected, bring it back with an explicit label, e.g. "6 moves reviewed".

**Thumbnail (56 × 56)**

For analyzed games, it shows the real position KataGo picked. That is a 9 × 9 window around the biggest mistake, with lines stopping at the board's real edges.

- Stones are 90 % of the spacing:
  - black `#1E1D1F`
  - white `#F4ECDA` with a 0.75 px inset edge
- With no position yet (analysis running) or no mistake: an empty board corner. No invented stones.
  - If the backend has the SGF, the final position is a fair fallback.
- The 16 px stone at the bottom-right corner is the user's colour, with a 2 px ring in `base`.

---

## 5. Opening the exercise: the row and its arrow

The brief's "Practice mistakes" bar was tried and then removed. As before, the **whole row** is the link that opens the exercise flow for that game.

- It is an `<a>` stretched over the row: `position: absolute; inset: 0; z-index: 1`.
- The ⋮ button sits above it (`position: relative; z-index: 2`), so tapping ⋮ opens the menu, not the exercise.
- The only visible cue is `icon-chevron.svg`, 18 px, in `hint`.
  - It sits in the row's right column, under ⋮.
  - It is centred on the result line.
- The number of mistakes isn't shown. It drives whether the row is a link, and it is part of the link's name: `aria-label="Practice 3 mistakes from your game vs kitsune77, won B+R"`.

**When the row is not a link (no arrow):**

| Game | Status line (13 / 18, `hint`) |
|---|---|
| Analysis running | ⏱ KataGo is analyzing this game… |
| Queued | ⏱ Waiting for analysis |
| Analyzed, 0 mistakes | No mistakes to practice |
| Being deleted / cancelled | Deleting… / Cancelling… |

---

## 6. ⋮ menu (replaces the inline Cancel/Delete)

**The button**

- 44 × 40 at the top-right of the row, `icon-more.svg` 20 px in `hint`.
- It shares a 44 px column with the arrow: `margin: -13px -12px 0 0`, ⋮ on top, the arrow below it with `margin-top: -2px`.
- `aria-label="More actions for the game vs {opponent}"`, `aria-haspopup="menu"`, `aria-expanded`.
- While open, its background is `rgba(241,230,204,.08)` (dark) or `rgba(28,26,23,.07)` (light).

**The popover**

- Placement: `role="menu"`, 48 px below the button's top and right-aligned, `min-width: 200px`, `border-radius: 3px`, 4 px vertical padding.
- Background is `menu-bg`.
- Edge and shadow:
  - dark: `0 0 0 1px rgba(241,230,204,.12), 0 8px 24px rgba(0,0,0,.4)`
  - light: `0 0 0 1px rgba(28,26,23,.12), 0 8px 24px rgba(28,26,23,.18)`

**The item**

- One `menuitem`, 44 px tall: an icon and the label at 15 / 500, in `alert`. This is the only coral action on the screen.
  - Analyzed game: `icon-delete.svg` and **Delete game**.
  - Analysis running or queued: `icon-cancel.svg` and **Cancel analysis**.
- Tapping outside closes the menu, through a transparent full-screen button labelled "Close menu".

**After the item**

The flow is unchanged from the 23 Nov update:

1. `Telegram.WebApp.showPopup`, with the destructive button and Keep as a `default` button.
2. The row shows the pending state at 50 % opacity, with no ⋮ and no arrow, and it stops being a link.
3. The row leaves the list, and the counts update.

---

## 7. States

| State | Artboard | What shows |
|---|---|---|
| Loading the list | GamesLoading | Header and filters (no counts). Three placeholder rows: a 56 px square and two text bars. `role="status"`, `aria-label="Loading games"` |
| No games | GamesEmpty | Counts at 0. "No games yet" / "Games you export to Kaizen from OGS or DGS will appear here." |
| Nothing for a filter | — (reachable by tapping) | "No DGS games" / "Games you export from DGS will appear here." |
| Failed to load | GamesError | "Couldn't load your games" / "Check your connection and try again." and a **Try again** button (44 px, `bar-bg` with a `bar-edge` hairline, 3 px corners) |
| ⋮ open | GamesMenu | Popover on the kitsune77 row |
| Delete confirmation | GamesConfirm | Telegram popup "Delete this game?" |
| Deleting | GamesDeleting | The row at 50 %, "Deleting…" |
| No mistakes | Main (tengen_tom) | Not a link, no arrow; "No mistakes to practice" |
| Analysis running | Main (ishi_daichi, Ryuusei) | Not a link, no arrow; waiting line |

The message states are centred, with the title at 17 / 22, 600 and the body at 14 / 20 in `hint`.

---

## 8. Data the row needs

These are additions to `HANDOFF.md` §7:

- **`mistakes`:** the number of mistakes available to practise. It decides whether the row opens an exercise.
- **`position`:** the position for the thumbnail. A 9 × 9 window around the biggest mistake is enough: stones plus which edges are real board edges. It is absent while the analysis runs.
- **`playedAt`:** a timestamp, so the app can pick the group and show the time or the date in the user's timezone.
- **Opponent rank:** optional.

---

## 9. Open questions

1. **Several mistakes per game.** The row opens the exercise flow with N mistakes, but the exercise screen from the menu still shows one. It probably needs "Mistake k of N" and a Next button, like the session mode. Confirm before building.
2. **What "6 moves" means** in the current app (see section 4).
3. **Thumbnail fallback** for games without a KataGo position: an empty board corner as drawn, or the final position if the backend can provide it.
