# Gap: placeholder SGFs don't identify "the mistake" or "KataGo's line"

Status: documentation of an open gap only. Nothing here is resolved or
prescribed as a backend contract — see note at the end.

## Why this matters

Per `docs/design-handoff/kaizen-handoff/HANDOFF.md` section 5 ("Exercise"), the
Exercise screen needs, for a given game:

- **"The mistake"**: a specific board coordinate the user actually played in
  the game, which was *not* KataGo's recommended move at that point (HANDOFF.md
  line 258: "Your biggest mistake: {coord}").
- **"KataGo's line"**: a specific 5-move continuation from that point that the
  user must reproduce to pass the exercise (HANDOFF.md lines 206-207, 239-243,
  261-266).
- The zoom window is computed from "the mistake, KataGo's line and the previous
  move" (HANDOFF.md line 207) — so the frontend also needs to know which single
  node in the tree is "the previous move."

None of this is derivable from an SGF file's syntax alone. SGF variations
(`(...)(...)` siblings at a node) just mean "multiple branches exist here" —
nothing in the format itself marks one branch as "what was actually played" vs
"the engine's suggested alternative."

## What the placeholder fixtures actually contain

`kaizen-miniapp/games_test/` has three fixtures, one per phase, all from the
same source game (OGS game 14751624, `gakutakunoku` vs `mekriff`):

| File | Sibling variations at the branch node |
|---|---|
| `gakutakunokumekriff_OPENING_0fbd7836-fc76-43ec-98a0-5967cb78a5e7.sgf` | 5 (`B[bn]`, `B[ep]`, `B[eq]`, `B[bf]`, `B[ci]`) |
| `gakutakunokumekriff_MIDDLEGAME_93ab7ec8-1c4a-4617-8af6-9272674c5a83.sgf` | 5 (`W[je]`, `W[hf]`, `W[ro]`, `W[pi]`, `W[an]`) |
| `gakutakunokumekriff_ENDGAME_03cb365e-3c56-4462-8866-d46594d28142.sgf` | 5 (`B[ib]`, `B[kr]`, `B[lb]`, `B[pm]`, `B[lc]`) |

Checked every branch node in all three files for any distinguishing markup —
comments (`C[]`), node names (`N[]`), or NAGs (`TE`, `BM`, `DO`, `IT`, etc. —
the standard SGF move-quality annotations). **None is present on any variation
or any node past the root.** The only `C[]` in any file is the original game's
chat comment (`"mekriff: hello"`) on the root node, unrelated to analysis.

So, concretely: in the MIDDLEGAME file, there is no way — from the SGF alone —
to tell whether `W[je]`, `W[hf]`, `W[ro]`, `W[pi]`, or `W[an]` is:
- the move actually played in the real game (the "mistake" branch), or
- KataGo's suggested correct line, or
- some other engine variation with no particular significance.

The same ambiguity exists in the OPENING and ENDGAME files among their 5
sibling branches each.

## What this is not

This is not a bug in the fixtures and not something to "fix" by editing the
SGFs — they're standing in for whatever the real per-phase SGF text from
`GameHistoryDto` (see `game-history-dto.md` in this directory) will actually
contain once the user's new endpoint exists. Whether the *real* backend output
tags the mistake/KataGo's-line distinction, and how, is for the user's endpoint
work to define — out of scope for this team this round, and not something to
guess at here.

## Recommendation for the frontend (not a contract — a suggestion for mock-only use)

Until the real endpoint and its actual SGF annotation convention exist, the
frontend building/testing the Exercise screen against these fixtures should
pick its own **local, mock-only** convention — e.g. "first sibling at the
branch node is the mistake, second sibling is KataGo's line" — document it next
to the fixtures or in the component that consumes them, and treat it as
throwaway scaffolding. It must not be written into this `backend-contract/`
directory as if it were a real API guarantee, since the backend defines no
such guarantee today. When the user's endpoint ships, this mock convention
will need to be replaced with whatever that endpoint actually returns.
