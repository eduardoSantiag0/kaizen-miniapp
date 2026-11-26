import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { retry } from 'rxjs';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type ExerciseSource, type PracticePreferences } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';

/** The example strip's 5 candidate points (handoff v4-kaizen-daily-practice section 5) — lettered the way game records mark alternatives, not tied to any real position. */
const CANDIDATE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Grid coordinates (0-indexed, 10 cols × 3 rows) for each lettered point — clustered near one spot, the way a game record marks alternatives branching from a single move, not spread evenly across the whole strip. */
const CANDIDATE_POSITIONS: readonly { col: number; row: number }[] = [
  { col: 4, row: 0 },
  { col: 5, row: 1 },
  { col: 4, row: 2 },
  { col: 6, row: 0 },
  { col: 6, row: 2 },
];

/** A few context stones (handoff section 5: "a few stones") so the strip reads as a real board position, not just floating letters. */
const CONTEXT_STONES: readonly { col: number; row: number; sign: 1 | -1 }[] = [
  { col: 1, row: 1, sign: 1 },
  { col: 2, row: 0, sign: -1 },
  { col: 8, row: 2, sign: 1 },
  { col: 9, row: 0, sign: -1 },
];

/**
 * Daily Practice's settings screen (handoff v4-kaizen-daily-practice section
 * 5). No Save button: each change is pushed to PracticeService immediately
 * and applies from the next exercise, same as the handoff's own wording.
 * Neither slider's copy says "variant", "node" or "tree".
 */
@Component({
  selector: 'kz-practice-settings',
  imports: [PaperBackgroundComponent, SeigaihaFillComponent],
  templateUrl: './practice-settings.component.html',
  styleUrl: './practice-settings.component.scss',
})
export class PracticeSettingsComponent {
  private readonly practice = inject(PracticeService);
  private readonly telegram = inject(TelegramService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly preferences = signal<PracticePreferences>({ ...DEFAULT_PRACTICE_PREFERENCES });
  readonly loaded = signal(false);

  readonly candidateLetters = CANDIDATE_LETTERS;
  readonly candidatePositions = CANDIDATE_POSITIONS;
  readonly contextStones = CONTEXT_STONES;

  readonly topVariants = computed(() => this.preferences().topVariants);
  readonly continuationDepth = computed(() => this.preferences().continuationDepth);
  readonly exerciseSource = computed(() => this.preferences().exerciseSource);
  readonly exerciseCount = computed(() => this.preferences().exerciseCount);

  readonly exerciseCountValueText = computed(() => `${this.exerciseCount()} exercises per session`);

  readonly topVariantsCaption = computed(() => {
    const n = this.topVariants();
    if (n === 1) return `Only ${CANDIDATE_LETTERS[0]}, KataGo’s first choice, counts as correct.`;
    return `Example. ${CANDIDATE_LETTERS[0]} to ${CANDIDATE_LETTERS[n - 1]} count as correct: KataGo's ${n} best first moves.`;
  });

  readonly topVariantsValueText = computed(() => `${this.topVariants()} first moves accepted`);

  /** Accepted/not-accepted styling for each of the 5 lettered example points. */
  readonly candidateAccepted = computed(() => {
    const n = this.topVariants();
    return CANDIDATE_LETTERS.map((_, i) => i < n);
  });

  /** Stone sequence for the numbered-line example — index 0 is the user's first move, then M more, alternating starting with the opponent's reply. */
  readonly depthStones = computed(() => {
    const m = this.continuationDepth();
    return Array.from({ length: m + 1 }, (_, i) => (i % 2 === 0 ? 1 : -1) as 1 | -1);
  });

  readonly depthCaption = computed(() => {
    const m = this.continuationDepth();
    const yours = Math.floor(m / 2);
    const replies = Math.ceil(m / 2);
    return `Your first move, then ${m} more: ${yours} yours and ${replies} replies.`;
  });

  readonly depthValueText = computed(() => `${this.continuationDepth()} moves deep`);

  constructor() {
    this.telegram.showBackButton(this.backToHome);
    this.destroyRef.onDestroy(() => this.telegram.hideBackButton(this.backToHome));
    this.practice.getPreferences().subscribe((prefs) => {
      this.preferences.set(prefs);
      this.loaded.set(true);
    });
  }

  onTopVariantsInput(value: string): void {
    this.updatePreferences({ topVariants: Number(value) });
  }

  onDepthInput(value: string): void {
    this.updatePreferences({ continuationDepth: Number(value) });
  }

  onExerciseSourceChange(value: ExerciseSource): void {
    this.updatePreferences({ exerciseSource: value });
  }

  onExerciseCountInput(value: string): void {
    this.updatePreferences({ exerciseCount: Number(value) });
  }

  private updatePreferences(patch: Partial<PracticePreferences>): void {
    const next = { ...this.preferences(), ...patch };
    this.preferences.set(next);
    // Retries before giving up — this failing silently (the previous behaviour) meant the
    // screen kept showing the new value while the server, and the next generated exercise,
    // silently kept the old one.
    this.practice
      .setPreferences(next)
      .pipe(retry({ count: 2, delay: 500 }))
      .subscribe({ error: (err) => console.error('Failed to save practice preferences', err) });
  }

  readonly backToHome = (): void => {
    this.router.navigate(['/practice']);
  };
}
