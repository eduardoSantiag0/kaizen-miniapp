import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RandomPracticeDialogComponent } from './random-practice-dialog.component';

describe('RandomPracticeDialogComponent', () => {
  let fixture: ComponentFixture<RandomPracticeDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RandomPracticeDialogComponent] });
    fixture = TestBed.createComponent(RandomPracticeDialogComponent);
    fixture.detectChanges();
  });

  it('is hidden until show() is called', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('show() opens it with the default count', () => {
    fixture.componentInstance.show();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.componentInstance.count()).toBe(5);
  });

  it('Start emits the slider value and closes', () => {
    fixture.componentInstance.show();
    fixture.detectChanges();
    fixture.componentInstance.onCountInput('8');

    let confirmedWith: number | undefined;
    fixture.componentInstance.confirmed.subscribe((n) => (confirmedWith = n));

    (fixture.nativeElement.querySelector('.kz-rpd-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(confirmedWith).toBe(8);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Cancel and the overlay both close without emitting a count', () => {
    fixture.componentInstance.show();
    fixture.detectChanges();

    let cancelled = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled = true));

    (fixture.nativeElement.querySelector('.kz-rpd-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(cancelled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('the slider never exceeds 10', () => {
    fixture.componentInstance.show();
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('.kz-rpd-slider') as HTMLInputElement;
    expect(slider.max).toBe('10');
  });
});
