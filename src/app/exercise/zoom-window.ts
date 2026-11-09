import type { Vertex } from '../sgf/sgf-node';

export interface ZoomWindow {
  rangeX: [number, number];
  rangeY: [number, number];
}

const PADDING = 1;
const EDGE_SNAP_DISTANCE = 3;
const MIN_COLUMNS = 9;

/** Viewport width and the board's height budget, both in CSS px at the 390px-wide viewport (HANDOFF.md section 5). */
const VIEWPORT_WIDTH = 390;
const HEIGHT_BUDGET = 476;
/** Border/coordinate-band allowance subtracted from both budgets, and the extra per-vertex spacing factor — from the design canvas's Replay.dc.html, the canonical source for this geometry. */
const EDGE_ALLOWANCE = 16;
const SPACING_FACTOR = 1.1;

/**
 * HANDOFF.md section 5, "Board":
 * 1. Take the mistake, KataGo's line and the previous move, plus 1 line of padding.
 * 2. Snap to an edge that is 3 lines away or closer.
 * 3. Make it at least 9 columns wide.
 * 4. Add rows until the board is about 470px tall.
 * 5. If that covers all but one row, show the full board.
 *
 * The board is always full width (step 4 only ever adds rows, never shrinks
 * columns), so rows are derived from the *resolved* column count — not a
 * fixed number — using the same vertex size the real board will render at:
 *   zs = (390 - 16) / (cols - 1 + 1.1)
 *   rows = floor((476 - 16 - zs * 1.1) / zs) + 1
 */
export function computeZoomWindow(boardSize: number, pointsOfInterest: Vertex[]): ZoomWindow {
  const valid = pointsOfInterest.filter(([x, y]) => x >= 0 && y >= 0);
  if (!valid.length) {
    return { rangeX: [0, boardSize - 1], rangeY: [0, boardSize - 1] };
  }

  const xs = valid.map(([x]) => x);
  const ys = valid.map(([, y]) => y);

  let rangeX = snapAndPad(Math.min(...xs), Math.max(...xs), boardSize);
  let rangeY = snapAndPad(Math.min(...ys), Math.max(...ys), boardSize);

  rangeX = ensureMinSpan(rangeX, MIN_COLUMNS, boardSize);

  const columns = rangeX[1] - rangeX[0] + 1;
  rangeY = ensureMinSpan(rangeY, rowsForColumns(columns), boardSize);

  if (coversAllButOneRow(rangeX, boardSize) && coversAllButOneRow(rangeY, boardSize)) {
    return { rangeX: [0, boardSize - 1], rangeY: [0, boardSize - 1] };
  }

  return { rangeX, rangeY };
}

function rowsForColumns(columns: number): number {
  // Replay.dc.html: zs = (W - band) / (cols - 1 + 1.1) — i.e. columns - 1 + SPACING_FACTOR,
  // not columns + SPACING_FACTOR (that extra +1 shrank zs and overcounted rows by one).
  const vertexSize = (VIEWPORT_WIDTH - EDGE_ALLOWANCE) / (columns - 1 + SPACING_FACTOR);
  return Math.floor((HEIGHT_BUDGET - EDGE_ALLOWANCE - vertexSize * SPACING_FACTOR) / vertexSize) + 1;
}

function snapAndPad(min: number, max: number, boardSize: number): [number, number] {
  let start = min - PADDING;
  let stop = max + PADDING;

  if (start <= EDGE_SNAP_DISTANCE) start = 0;
  if (boardSize - 1 - stop <= EDGE_SNAP_DISTANCE) stop = boardSize - 1;

  return [Math.max(0, start), Math.min(boardSize - 1, stop)];
}

function ensureMinSpan([start, stop]: [number, number], minSpan: number, boardSize: number): [number, number] {
  let span = stop - start + 1;
  if (span >= minSpan) return [start, stop];

  const deficit = minSpan - span;
  const growStart = Math.floor(deficit / 2);
  const growStop = deficit - growStart;

  start = Math.max(0, start - growStart);
  stop = Math.min(boardSize - 1, stop + growStop);

  span = stop - start + 1;
  if (span < minSpan) {
    if (start === 0) stop = Math.min(boardSize - 1, start + minSpan - 1);
    else if (stop === boardSize - 1) start = Math.max(0, stop - minSpan + 1);
  }

  return [start, stop];
}

function coversAllButOneRow([start, stop]: [number, number], boardSize: number): boolean {
  const uncovered = start + (boardSize - 1 - stop);
  return uncovered <= 1;
}
