import { Component, computed, input } from '@angular/core';

export type SessionTrackNodeState = 'done' | 'current' | 'ahead';

/**
 * The ●◉○ session-progress glyphs (handoff v4-kaizen-daily-practice section
 * 11): one node per exercise/step, joined by 1px lines, used on the Games
 * Daily practice button, Daily Practice Home, inside the exercise (via
 * ExerciseContextComponent) and on Practice Complete.
 */
@Component({
  selector: 'kz-session-track',
  templateUrl: './session-track.component.html',
  styleUrl: './session-track.component.scss',
})
export class SessionTrackComponent {
  readonly total = input.required<number>();
  /** 1-indexed position of the next/current node. Pass a value greater than total (e.g. total + 1) once every node is done — Practice Complete's fully-filled track. */
  readonly current = input.required<number>();
  readonly nodeSize = input(12);
  /** Optional trailing text (Home's "3 exercises" / "1 of 3 done" — section 4). Omitted where the surrounding screen shows its own text instead (the Games button, Practice Complete). */
  readonly label = input<string | null>(null);

  readonly nodes = computed<SessionTrackNodeState[]>(() => {
    const total = this.total();
    const current = this.current();
    return Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      if (n < current) return 'done';
      if (n === current) return 'current';
      return 'ahead';
    });
  });
}
