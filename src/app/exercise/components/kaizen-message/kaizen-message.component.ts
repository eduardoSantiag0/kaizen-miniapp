import { Component, input } from '@angular/core';
import type { MessageTone } from '../../exercise-copy';

@Component({
  selector: 'kz-kaizen-message',
  templateUrl: './kaizen-message.component.html',
  styleUrl: './kaizen-message.component.scss',
})
export class KaizenMessageComponent {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly tone = input<MessageTone>('neutral');
  readonly emphasized = input(false);
}
