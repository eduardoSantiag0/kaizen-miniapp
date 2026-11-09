import { computeZoomWindow } from './zoom-window';

describe('computeZoomWindow', () => {
  it('is at least 9 columns wide around a tight cluster of points', () => {
    const { rangeX, rangeY } = computeZoomWindow(19, [
      [9, 4],
      [8, 4],
      [8, 3],
    ]);

    expect(rangeX[1] - rangeX[0] + 1).toBeGreaterThanOrEqual(9);
    expect(rangeY[1] - rangeY[0] + 1).toBeGreaterThanOrEqual(9);
  });

  it('snaps to the edge when the points are within 3 lines of it', () => {
    const { rangeX, rangeY } = computeZoomWindow(19, [
      [1, 1],
      [2, 2],
    ]);

    expect(rangeX[0]).toBe(0);
    expect(rangeY[0]).toBe(0);
  });

  it('does not snap to an edge more than 3 lines away', () => {
    const { rangeX } = computeZoomWindow(19, [
      [10, 10],
      [11, 11],
    ]);

    expect(rangeX[0]).toBeGreaterThan(0);
  });

  it('falls back to the full board for a 9x9 (window would cover all but one row)', () => {
    const { rangeX, rangeY } = computeZoomWindow(9, [
      [4, 4],
      [5, 5],
    ]);

    expect(rangeX).toEqual([0, 8]);
    expect(rangeY).toEqual([0, 8]);
  });

  it('returns the full board when there are no valid points of interest', () => {
    const { rangeX, rangeY } = computeZoomWindow(19, []);
    expect(rangeX).toEqual([0, 18]);
    expect(rangeY).toEqual([0, 18]);
  });

  it('ignores invalid (-1,-1) vertices mixed in with real ones', () => {
    const { rangeX, rangeY } = computeZoomWindow(19, [
      [-1, -1],
      [9, 9],
    ]);

    expect(rangeX[0]).toBeLessThanOrEqual(9);
    expect(rangeX[1]).toBeGreaterThanOrEqual(9);
    expect(rangeY[0]).toBeLessThanOrEqual(9);
    expect(rangeY[1]).toBeGreaterThanOrEqual(9);
  });

  // Designer-flagged regression: rows must come from the canonical width-driven
  // formula (zs = (390-16)/(cols-1+1.1); rows = floor((476-16-zs*1.1)/zs)+1), not
  // a fixed constant — otherwise the board renders height-bound and short of
  // full width for the common 9-column case. (cols-1, not cols: an earlier fix
  // of this same bug used cols+1.1, which was itself off by one.)
  it('computes exactly 11 rows for the common 9-column window, not a fixed 13 or an off-by-one 12', () => {
    const { rangeX, rangeY } = computeZoomWindow(19, [[9, 9]]);

    expect(rangeX[1] - rangeX[0] + 1).toBe(9);
    expect(rangeY[1] - rangeY[0] + 1).toBe(11);
  });

  it('grows the row target as the resolved column count grows, instead of staying fixed', () => {
    const { rangeX, rangeY } = computeZoomWindow(25, [
      [0, 12],
      [14, 12],
    ]);

    expect(rangeX[1] - rangeX[0] + 1).toBe(16);
    expect(rangeY[1] - rangeY[0] + 1).toBe(19);
  });
});
