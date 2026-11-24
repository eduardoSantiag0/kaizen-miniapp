import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StreakStripComponent } from './streak-strip.component';

describe('StreakStripComponent', () => {
  function create(days: boolean[]): ComponentFixture<StreakStripComponent> {
    TestBed.configureTestingModule({ imports: [StreakStripComponent] });
    const fixture = TestBed.createComponent(StreakStripComponent);
    fixture.componentRef.setInput('days', days);
    return fixture;
  }

  it('renders a stone for every practiced day, and marks the last one as today', () => {
    const fixture = create([false, false, false, false, true, true, true]);
    fixture.detectChanges();

    const stones = fixture.nativeElement.querySelectorAll('.kz-streak-strip-stone');
    expect(stones.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.kz-streak-strip-stone--today').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.kz-streak-strip-dot')).not.toBeNull();
  });

  it('labels the last column "Today"', () => {
    const fixture = create([false, false, false, false, false, false, true]);
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.kz-streak-strip-label')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(labels[6]).toBe('Today');
  });

  it('builds an aria-label naming every day', () => {
    const fixture = create([false, false, false, false, false, false, true]);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('[role="img"]').getAttribute('aria-label');
    expect(label).toContain('today practised');
    expect(label).toMatch(/^Last 7 days: /);
  });
});
