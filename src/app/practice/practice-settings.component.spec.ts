import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PracticeSettingsComponent } from './practice-settings.component';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type PracticePreferences } from '../data/practice.model';

class StubPracticeService extends PracticeService {
  preferences: PracticePreferences = { ...DEFAULT_PRACTICE_PREFERENCES };
  setPreferencesCalls: PracticePreferences[] = [];

  override getTodaySession() {
    return of(null);
  }

  override startTodaySession() {
    return of({ date: '2026-01-01', exercises: [], completed: false });
  }

  override startNewRound() {
    return this.startTodaySession();
  }

  override startRandomPractice() {
    return this.startTodaySession();
  }

  override recordResult() {
    return of(undefined);
  }

  override getPreferences() {
    return of({ ...this.preferences });
  }

  override setPreferences(preferences: PracticePreferences) {
    this.setPreferencesCalls.push(preferences);
    this.preferences = { ...preferences };
    return of(undefined);
  }

  override saveProgress() {
    return of(undefined);
  }

  override getStreak() {
    return of({ currentStreak: 0, last7Days: [false, false, false, false, false, false, false] });
  }
}

describe('PracticeSettingsComponent', () => {
  let fixture: ComponentFixture<PracticeSettingsComponent>;
  let stub: StubPracticeService;

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({
      imports: [PracticeSettingsComponent],
      providers: [provideRouter([]), { provide: PracticeService, useClass: StubPracticeService }],
    });
    stub = TestBed.inject(PracticeService) as unknown as StubPracticeService;
  });

  function create(): ComponentFixture<PracticeSettingsComponent> {
    fixture = TestBed.createComponent(PracticeSettingsComponent);
    return fixture;
  }

  it('loads the current preferences and shows them as the slider values', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariants()).toBe(3);
    expect(fixture.componentInstance.continuationDepth()).toBe(4);
  });

  it('captions "Only A" when just the first move is accepted', () => {
    stub.preferences = { topVariants: 1, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariantsCaption()).toBe('Only A, KataGo’s first choice, counts as correct.');
  });

  it('captions the accepted letter range for N > 1', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariantsCaption()).toBe(
      "Example. A to C count as correct: KataGo's 3 best first moves.",
    );
  });

  it('captions the depth example with the exact handoff wording for an even M', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.depthCaption()).toBe('Your first move, then 4 more: 2 yours and 2 replies.');
  });

  it('captions the depth example for an odd M, ending on a reply', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 5, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.depthCaption()).toBe('Your first move, then 5 more: 2 yours and 3 replies.');
  });

  it('saves immediately on a slider change, with no explicit Save button', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    const buttonLabels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim());
    expect(buttonLabels).not.toContain('Save');

    fixture.componentInstance.onTopVariantsInput('5');
    fixture.detectChanges();

    expect(fixture.componentInstance.topVariants()).toBe(5);
    expect(stub.setPreferencesCalls).toEqual([{ topVariants: 5, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 }]);
  });

  it('shows "Your games" selected by default, and switches to "Mixed with community" on tap, saving immediately', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('.kz-source-option')) as HTMLButtonElement[];
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Your games', 'Mixed with community']);
    expect(options[0].getAttribute('aria-checked')).toBe('true');
    expect(options[1].getAttribute('aria-checked')).toBe('false');

    options[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.exerciseSource()).toBe('mixed');
    expect(stub.setPreferencesCalls).toEqual([{ topVariants: 3, continuationDepth: 4, exerciseSource: 'mixed', exerciseCount: 5 }]);
    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(options[0].getAttribute('aria-checked')).toBe('false');
  });

  it('loads and changes the exercises-per-session count, saving immediately', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4, exerciseSource: 'own' as const, exerciseCount: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.exerciseCount()).toBe(5);

    fixture.componentInstance.onExerciseCountInput('8');
    fixture.detectChanges();

    expect(fixture.componentInstance.exerciseCount()).toBe(8);
    expect(stub.setPreferencesCalls).toEqual([{ topVariants: 3, continuationDepth: 4, exerciseSource: 'own', exerciseCount: 8 }]);
  });

  it('backToHome navigates to /practice', () => {
    create().detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.backToHome();

    expect(router.navigate).toHaveBeenCalledWith(['/practice']);
  });
});
