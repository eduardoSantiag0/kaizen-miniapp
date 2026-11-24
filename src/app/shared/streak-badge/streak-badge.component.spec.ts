import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StreakBadgeComponent } from './streak-badge.component';

describe('StreakBadgeComponent', () => {
  function create(days: number): ComponentFixture<StreakBadgeComponent> {
    TestBed.configureTestingModule({ imports: [StreakBadgeComponent] });
    const fixture = TestBed.createComponent(StreakBadgeComponent);
    fixture.componentRef.setInput('days', days);
    return fixture;
  }

  it('shows the plain count, singular for 1 day', () => {
    const fixture = create(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('1 day in a row');
  });

  it('shows the plain count, plural otherwise', () => {
    const fixture = create(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('4 days in a row');
  });
});
