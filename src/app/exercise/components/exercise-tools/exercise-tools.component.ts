import { Component, input, output } from '@angular/core';

@Component({
  selector: 'kz-exercise-tools',
  templateUrl: './exercise-tools.component.html',
  styleUrl: './exercise-tools.component.scss',
})
export class ExerciseToolsComponent {
  readonly hintOn = input(false);
  readonly zoomedIn = input(true);
  readonly zoomDisabled = input(false);

  readonly hintToggle = output<void>();
  readonly reset = output<void>();
  readonly zoomToggle = output<void>();
}
