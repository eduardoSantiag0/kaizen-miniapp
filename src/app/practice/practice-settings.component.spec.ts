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
    stub.preferences = { topVariants: 3, continuationDepth: 4 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariants()).toBe(3);
    expect(fixture.componentInstance.continuationDepth()).toBe(4);
  });

  it('captions "Only A" when just the first move is accepted', () => {
    stub.preferences = { topVariants: 1, continuationDepth: 4 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariantsCaption()).toBe('Only A, KataGo’s first choice, counts as correct.');
  });

  it('captions the accepted letter range for N > 1', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4 };
    create().detectChanges();

    expect(fixture.componentInstance.topVariantsCaption()).toBe(
      "Example. A to C count as correct: KataGo's 3 best first moves.",
    );
  });

  it('captions the depth example with the exact handoff wording for an even M', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4 };
    create().detectChanges();

    expect(fixture.componentInstance.depthCaption()).toBe('Your first move, then 4 more: 2 yours and 2 replies.');
  });

  it('captions the depth example for an odd M, ending on a reply', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 5 };
    create().detectChanges();

    expect(fixture.componentInstance.depthCaption()).toBe('Your first move, then 5 more: 2 yours and 3 replies.');
  });

  it('saves immediately on a slider change, with no Save button', () => {
    stub.preferences = { topVariants: 3, continuationDepth: 4 };
    create().detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    fixture.componentInstance.onTopVariantsInput('5');
    fixture.detectChanges();

    expect(fixture.componentInstance.topVariants()).toBe(5);
    expect(stub.setPreferencesCalls).toEqual([{ topVariants: 5, continuationDepth: 4 }]);
  });

  it('backToHome navigates to /practice', () => {
    create().detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.backToHome();

    expect(router.navigate).toHaveBeenCalledWith(['/practice']);
  });
});
