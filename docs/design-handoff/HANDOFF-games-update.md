# Handoff update — Games screen, after review

These are the changes since the first version of `HANDOFF-games-refinement.md`, the one with the "Practice mistakes" bar. Nothing else changed.

The title block ("Games" plus its description) is **unchanged**. Two art treatments were tried there and reverted.

Canvas artboards to check: Main, GamesLight, GamesMenu, GamesLoading, GamesError.

---

## 1. The "Practice mistakes" bar is gone

| | Before | Now |
|---|---|---|
| How a game opens | A 44 px bar under the result: icon, "Practice mistakes", count, › | The **whole row** is the link |
| Visible cue | The bar | Only a chevron `›` |
| Mistake count | Shown in the bar | Not shown; it is part of the link's accessible name |
| Height of an analyzed row | 124 px | **82 px** |

### Build it like this

**The link**

- An `<a>` stretched over the whole row: `position: absolute; inset: 0; z-index: 1`.
- `aria-label`: "Practice {n} mistakes from your game vs {opponent}, won|lost {result}". Use "mistake" when there is only one.
- The row is a link only when the game is analyzed, has at least one mistake, and isn't being deleted.

**The right column**

- 44 px wide, `margin: -13px -12px 0 0`, stacked top to bottom:
  1. **⋮ button**, 44 × 40, `position: relative; z-index: 2`. It sits above the link, so tapping it opens the menu, not the exercise.
  2. **Chevron**: `icon-chevron.svg`, 18 px, `hint`, `margin-top: -2px`. That centres it on the result line. Show it only when the row is a link.

**Rows that aren't links** keep the status line exactly as before:

- KataGo is analyzing this game…
- Waiting for analysis
- No mistakes to practice
- Deleting… / Cancelling…

`icon-practice.svg` is no longer used.

---

## 2. Corners: 6 px → 3 px

This matches every other button in the app. It applies to:

- the ⋮ button's pressed background
- the ⋮ popover
- the Try again button
- the loading placeholders

---

## 3. Try again button

| | Before | Now |
|---|---|---|
| Fill | Solid `surface` (`#192538` dark / `#E6D8BA` light) | Translucent `bar-bg`: `rgba(241,230,204,.06)` / `rgba(28,26,23,.05)` |
| Edge | None | 1 px inset `bar-edge`: `rgba(241,230,204,.16)` / `rgba(28,26,23,.18)` |
| Corners | 6 px | 3 px |

Size and copy don't change: 44 px tall, "Try again".

---

## 4. Loading placeholders

Each placeholder row is now a 56 px square plus two text bars. The third, 44 px placeholder for the bar was removed along with the bar.

---

## 5. Tokens

| Token | Status |
|---|---|
| `surface` | Removed |
| `copper` | Removed |
| `bar-bg` | **New**, used only by Try again |
| `bar-edge` | **New**, used only by Try again |
| `menu-bg` | Unchanged (`#192538` / `#FBF5E8`), still the ⋮ popover |

---

`HANDOFF-games-refinement.md` already includes these changes, so it describes the screen's final state. Use this file if you need only what is new.
