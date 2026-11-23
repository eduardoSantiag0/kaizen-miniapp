# Handoff update — Cancel/Delete per game, new wrong-move mark

Only what changed on 23 Nov 2026. Everything else stays as in `HANDOFF.md`.

Canvas: https://claude.ai/artifact/NqF2MnBQxh3WLSMzcJfxZR (private until shared). The artboards to look at:

- **Main** and **GamesLight:** the action on every row.
- **GamesConfirm** (new): the confirmation popup.
- **Review:** the Incorrect state with the new mark.

Files in `assets/`: `icon-cancel.svg`, `icon-delete.svg`, `wrong-mark.svg`.

---

## 1. Cancel / Delete on every game (Games screen)

Each game has its own action. It resigns that game's job on the backend.

| Game | Action | Icon | `aria-label` |
|---|---|---|---|
| Analyzing or queued | **Cancel** | `icon-cancel.svg` (stop) | "Cancel the analysis of your game vs {opponent}" |
| Analyzed | **Delete** | `icon-delete.svg` (trash) | "Delete your game vs {opponent}" |

### Where it sits

The row's right column now has one cell per text line, right-aligned:

1. "Won" or "Lost", 15 / 22, weight 600. Beside the name.
2. The result, e.g. "B+R", 12 / 18. Beside the meta line.
3. **The action**, beside the status line. This cell is new.

The chevron on analyzed rows stays where it was. Rows that aren't links keep a 6 px spacer, so the right columns line up.

### The button

- A text button in `hint` (`#A7B3C4` dark, `#5C5244` light), 13 / 18 at weight 500.
- A 14 px stroke icon, 5 px before the label, using `currentColor`.
- The tap area is 44 px tall. It uses `margin: -13px -8px -13px 0` and `padding: 0 8px`, so it takes only the 18 px status line in the layout and its text lines up with the column's right edge.

### Analyzed rows are still links

A button can't sit inside a link, so:

- The `<a>` is stretched over the whole row: `position: absolute; inset: 0; z-index: 1`.
- The action button sits above it: `position: relative; z-index: 2`.
- Tapping anywhere else on the row still opens the exercise.

### Confirmation: Telegram's popup

```js
Telegram.WebApp.showPopup({
  title: 'Cancel this analysis?',
  message: 'KataGo stops analyzing your game vs ishi_daichi, and the game leaves your list.',
  buttons: [
    { id: 'confirm', type: 'destructive', text: 'Cancel analysis' },
    { id: 'keep', type: 'default', text: 'Keep' }
  ]
}, (id) => { if (id === 'confirm') resignJob(game.id); });
```

| Game | Title | Message | Destructive button |
|---|---|---|---|
| Analyzing | Cancel this analysis? | KataGo stops analyzing your game vs {opponent}, and the game leaves your list. | Cancel analysis |
| Queued | Cancel this analysis? | Your game vs {opponent} leaves the analysis queue and your list. | Cancel analysis |
| Analyzed | Delete this game? | Your game vs {opponent} and its analysis will be removed from Kaizen. | Delete game |

- **"Keep" must be a `default` button, not a `cancel` one.** Telegram labels `cancel` buttons with its own localized "Cancel", which would read "Cancel analysis / Cancel".
- Telegram draws the popup in its own colours. GamesConfirm only shows where it appears and what it says.

### After the user confirms

1. While the request runs:
   - The row drops to 50 % opacity.
   - The status reads "Cancelling…" (job) or "Deleting…" (analyzed game), in `hint`.
   - The action is hidden and the row stops being a link.
2. When the server confirms, the row leaves the list and the All · OGS · DGS counts update.
3. If the request fails, put the row back as it was.

### What the backend needs

The game's id, and an endpoint to resign that game's job:

- for a running or queued analysis, it cancels the job;
- for an analyzed game, it deletes the game.

### Angular

- `GameRow` renders the stretched link (analyzed games only), plus a new `GameAction`.
- `GameAction` opens the popup through `TelegramService.showPopup`, so it still works outside Telegram, in a browser or in tests.

---

## 2. Wrong-move mark (Incorrect state)

| | Before | Now |
|---|---|---|
| Shape | Two straight 2 px lines | Two filled brush strokes, red-ink *batsu* |
| Ends | Round caps | Round, no sharp points |
| Width | Even | A little fuller in the middle, slightly curved |
| Size | 60 % of the stone | **68 %** of the stone, centred on it |
| Colour | `#D9472B` | `#D9472B` (unchanged) |
| Ring around the stone | 2 px `#B8361F` | Unchanged |

- Use `assets/wrong-mark.svg` (24 × 24 viewBox, filled paths). It's the same artwork as on the canvas.
- Shudan's built-in `cross` marker won't match this shape. Draw the SVG over the vertex yourself, positioned from the vertex's coordinates.
