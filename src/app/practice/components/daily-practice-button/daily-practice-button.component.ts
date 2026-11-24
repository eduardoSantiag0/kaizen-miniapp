import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PracticeService } from '../../../data/practice.service';
import type { DailyPracticeSession } from '../../../data/practice.model';
import { SessionTrackComponent } from '../../../shared/session-track/session-track.component';

type Screen = 'loading' | 'ready' | 'error';

/**
 * Games' "Daily practice" row (handoff v4-kaizen-daily-practice section 3):
 * sits between the description and the server filters, reads as an action
 * rather than another game row. Starts today's session eagerly so it always
 * has a real exercise count to show — PracticeService.startTodaySession()
 * is idempotent, so this is a no-op if GamesPage already triggered it.
 */
@Component({
  selector: 'kz-daily-practice-button',
  imports: [RouterLink, SessionTrackComponent],
  templateUrl: './daily-practice-button.component.html',
  styleUrl: './daily-practice-button.component.scss',
})
export class DailyPracticeButtonComponent {
  private readonly practice = inject(PracticeService);

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);

  readonly totalCount = computed(() => this.session()?.exercises.length ?? 0);
  readonly completedCount = computed(() => this.session()?.exercises.filter((e) => e.completed).length ?? 0);
  readonly isComplete = computed(() => this.session()?.completed === true);
  /** Hidden entirely when no game has a mistake to practise — section 3 "When it's hidden". */
  readonly isEmpty = computed(() => this.totalCount() === 0);

  readonly subtitle = computed(() => {
    if (this.isComplete()) return 'Done for today';
    const total = this.totalCount();
    const completed = this.completedCount();
    if (completed > 0) return `${completed} of ${total} done`;
    return `${total} exercise${total === 1 ? '' : 's'} today`;
  });

  readonly ariaLabel = computed(() => `Daily practice: ${this.subtitle()}`);

  /** 1-indexed position fed to SessionTrack: the next unsolved exercise, or past the end once the session is complete (every node filled). */
  readonly trackCurrent = computed(() => (this.isComplete() ? this.totalCount() + 1 : this.completedCount() + 1));

  constructor() {
    this.practice.startTodaySession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.screen.set('ready');
      },
      error: () => this.screen.set('error'),
    });
  }
}
