import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PracticeService } from '../../../data/practice.service';
import type { DailyPracticeSession } from '../../../data/practice.model';

type Screen = 'loading' | 'ready' | 'error';

/**
 * RF03.2 — Home's Daily Practice section. Starts today's session eagerly on
 * load (PracticeService.startTodaySession() is idempotent — a session that
 * already exists today comes back unchanged), so the card always has a real
 * exercise count/progress to show, never an "unknown" state before the
 * player has tapped anything. One tap (routerLink, no confirmation) takes
 * the player straight into the session, per RF03.2's "single tap, no
 * intermediate screens" requirement.
 */
@Component({
  selector: 'kz-daily-practice-card',
  imports: [RouterLink],
  templateUrl: './daily-practice-card.component.html',
  styleUrl: './daily-practice-card.component.scss',
})
export class DailyPracticeCardComponent {
  private readonly practice = inject(PracticeService);

  readonly screen = signal<Screen>('loading');
  private readonly session = signal<DailyPracticeSession | null>(null);

  readonly totalCount = computed(() => this.session()?.exercises.length ?? 0);
  readonly completedCount = computed(() => this.session()?.exercises.filter((e) => e.completed).length ?? 0);
  readonly isComplete = computed(() => this.session()?.completed === true);
  readonly hasStarted = computed(() => this.completedCount() > 0);
  /** Nothing to practice today — every analysed game already used, or none exist yet. */
  readonly isEmpty = computed(() => this.totalCount() === 0);

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
