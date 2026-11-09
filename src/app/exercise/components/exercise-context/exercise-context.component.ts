import { Component, computed, input } from '@angular/core';
import { StoneDotComponent } from '../../../shared/stone-dot/stone-dot.component';

export type ProgressNodeState = 'done' | 'current' | 'ahead';

@Component({
  selector: 'kz-exercise-context',
  imports: [StoneDotComponent],
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

  readonly nodes = computed<ProgressNodeState[]>(() => {
    const total = this.totalSteps();
    const current = this.step();
    return Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      if (n < current) return 'done';
      if (n === current) return 'current';
      return 'ahead';
    });
  });

  readonly stepLabel = computed(() => `Step ${Math.min(this.step(), this.totalSteps())}/${this.totalSteps()}`);
}
