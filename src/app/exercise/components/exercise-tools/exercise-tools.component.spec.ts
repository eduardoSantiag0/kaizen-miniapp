import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ExerciseToolsComponent } from './exercise-tools.component';

describe('ExerciseToolsComponent', () => {
  let fixture: ComponentFixture<ExerciseToolsComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ExerciseToolsComponent);
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  function findByLabel(label: string): HTMLButtonElement {
    return buttons().find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  }

  it('orders the buttons as Hint, Undo, Zoom, Reset — Reset not adjacent to Undo (Mobile-UX fix)', () => {
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Hint', 'Undo', 'Full board', 'Reset']);
  });

  it('Reset requires two taps: first arms it ("Confirm?"), second actually resets', fakeAsync(() => {
    let resetCount = 0;
    fixture.componentInstance.reset.subscribe(() => resetCount++);

    findByLabel('Reset').click();
    fixture.detectChanges();

    expect(resetCount).toBe(0);
    const armed = findByLabel('Confirm?');
    expect(armed).toBeTruthy();
    expect(armed.classList.contains('kz-tool-btn--armed')).toBe(true);

    tick(400); // past the minimum confirm dwell time
    armed.click();
    fixture.detectChanges();

    expect(resetCount).toBe(1);
    expect(findByLabel('Reset')).toBeTruthy(); // back to the normal label
  }));

  it('ignores a confirm tap that lands too soon after arming (same-gesture double tap, Mobile-UX fix)', fakeAsync(() => {
    let resetCount = 0;
    fixture.componentInstance.reset.subscribe(() => resetCount++);

    findByLabel('Reset').click();
    fixture.detectChanges();

    const armed = findByLabel('Confirm?');
    armed.click(); // fires immediately, well under the dwell window
    fixture.detectChanges();

    expect(resetCount).toBe(0);
    expect(findByLabel('Confirm?')).toBeTruthy(); // still armed, untouched

    tick(400);
    findByLabel('Confirm?').click(); // now past the dwell window
    fixture.detectChanges();

    expect(resetCount).toBe(1);
  }));

  it('Reset auto-disarms back to the normal label if left alone', fakeAsync(() => {
    findByLabel('Reset').click();
    fixture.detectChanges();
    expect(findByLabel('Confirm?')).toBeTruthy();

    tick(2500);
    fixture.detectChanges();

    expect(findByLabel('Reset')).toBeTruthy();
    expect(findByLabel('Confirm?')).toBeFalsy();
  }));

  it('does not throw if the component is destroyed while Reset is armed (timer cleanup)', fakeAsync(() => {
    findByLabel('Reset').click();
    fixture.detectChanges();

    expect(() => {
      fixture.destroy();
      tick(2500);
    }).not.toThrow();
  }));

  it('Reset is visually muted relative to the other tools, not styled the same as Undo', () => {
    const resetBtn = findByLabel('Reset');
    const undoBtn = findByLabel('Undo');

    expect(resetBtn.classList.contains('kz-tool-btn--muted')).toBe(true);
    expect(undoBtn.classList.contains('kz-tool-btn--muted')).toBe(false);
  });

  it('Zoom shares the muted "utility" look with Reset, instead of a third variant (Designer closeout)', () => {
    const zoomBtn = findByLabel('Full board');
    expect(zoomBtn.classList.contains('kz-tool-btn--muted')).toBe(true);
  });

  it('Hint has a heavier idle border than the neutral Undo (Designer closeout)', () => {
    const hintBtn = findByLabel('Hint');
    const undoBtn = findByLabel('Undo');

    // Not asserting the exact computed px: browsers may round a 1.5px border
    // to the nearest device pixel (e.g. to "1px" or "2px" at devicePixelRatio
    // 1), so the class — the actual source of truth for the rule — is what matters.
    expect(hintBtn.classList.contains('kz-tool-btn--elevated')).toBe(true);
    expect(undoBtn.classList.contains('kz-tool-btn--elevated')).toBe(false);
  });

  it('Hint toggled on still gets the --on treatment on top of its elevated border', () => {
    fixture.componentRef.setInput('hintOn', true);
    fixture.detectChanges();

    const hintBtn = findByLabel('Hint');
    expect(hintBtn.classList.contains('kz-tool-btn--on')).toBe(true);
    expect(hintBtn.classList.contains('kz-tool-btn--elevated')).toBe(true);
  });

  it('guards tool button labels against wrapping to two lines (regression: 4 buttons narrowed the row)', () => {
    const style = getComputedStyle(findByLabel('Full board'));
    expect(style.whiteSpace).toBe('nowrap');
  });

  it('emits hintToggle, undo and zoomToggle on their respective buttons', () => {
    let hint = false;
    let undo = false;
    let zoom = false;
    fixture.componentInstance.hintToggle.subscribe(() => (hint = true));
    fixture.componentInstance.undo.subscribe(() => (undo = true));
    fixture.componentInstance.zoomToggle.subscribe(() => (zoom = true));

    findByLabel('Hint').click();
    findByLabel('Undo').click();
    findByLabel('Full board').click();

    expect(hint).toBe(true);
    expect(undo).toBe(true);
    expect(zoom).toBe(true);
  });
});
