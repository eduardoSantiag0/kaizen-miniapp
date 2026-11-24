import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeService } from '../data/practice.service';
import { DEFAULT_PRACTICE_PREFERENCES, type PracticePreferences } from '../data/practice.model';
import { TelegramService } from '../core/telegram.service';
import { PaperBackgroundComponent } from '../shared/paper-background/paper-background.component';
import { SeigaihaFillComponent } from '../shared/seigaiha-fill/seigaiha-fill.component';

/** The example strip's 5 candidate points (handoff v4-kaizen-daily-practice section 5) — lettered the way game records mark alternatives, not tied to any real position. */
const CANDIDATE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

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

  readonly topVariants = computed(() => this.preferences().topVariants);
  readonly continuationDepth = computed(() => this.preferences().continuationDepth);

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

  private updatePreferences(patch: Partial<PracticePreferences>): void {
    const next = { ...this.preferences(), ...patch };
    this.preferences.set(next);
    this.practice.setPreferences(next).subscribe();
  }

  readonly backToHome = (): void => {
    this.router.navigate(['/practice']);
  };
}
