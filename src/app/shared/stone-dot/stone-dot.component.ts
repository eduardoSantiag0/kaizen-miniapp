import { Component, input } from '@angular/core';

@Component({
  selector: 'kz-stone-dot',
  template: `<span class="kz-stone-dot" [class.kz-stone-dot--white]="sign() === -1"></span>`,
  styleUrl: './stone-dot.component.scss',
})
export class StoneDotComponent {
  readonly sign = input.required<1 | -1>();
}
