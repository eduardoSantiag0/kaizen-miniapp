import { Component, computed, input } from '@angular/core';
import { StoneDotComponent } from '../../../shared/stone-dot/stone-dot.component';
import { SessionTrackComponent } from '../../../shared/session-track/session-track.component';

@Component({
  selector: 'kz-exercise-context',
  imports: [StoneDotComponent, SessionTrackComponent],
  templateUrl: './exercise-context.component.html',
  styleUrl: './exercise-context.component.scss',
})
export class ExerciseContextComponent {
  readonly turnText = input.required<string>();
  readonly turnSign = input<1 | -1 | null>(null);
  readonly metaText = input.required<string>();
  readonly step = input.required<number>();
  readonly totalSteps = input.required<number>();
  readonly showProgress = input(true);

  readonly stepLabel = computed(() => `Step ${Math.min(this.step(), this.totalSteps())}/${this.totalSteps()}`);
}
