import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MessageTone } from '../../exercise-copy';
import { KaizenMessageComponent } from './kaizen-message.component';

@Component({
  selector: 'kz-test-host',
  imports: [KaizenMessageComponent],
  template: `
    <kz-kaizen-message
      [title]="title()"
      [body]="body()"
      [tone]="tone()"
      [emphasized]="emphasized()"
      [celebrate]="celebrate()"
    />
  `,
})
class TestHostComponent {
  readonly title = signal('Correct');
  readonly body = signal("All 5 moves of KataGo's line.");
  readonly tone = signal<MessageTone>('pine');
  readonly emphasized = signal(false);
  readonly celebrate = signal(false);
}

describe('KaizenMessageComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
  });

  function el(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector) as HTMLElement;
  }

  it('groups the avatar and title in one row, centered against the title line (not the whole title+body block)', () => {
    fixture.detectChanges();

    const head = el('.kz-message-head');
    const avatarWrap = head.querySelector('.kz-message-avatar-wrap');
    const title = head.querySelector('.kz-message-title');

    expect(avatarWrap).toBeTruthy();
    expect(title).toBeTruthy();
    expect(getComputedStyle(head).alignItems).toBe('center');
  });

  it('places the body below the head row, indented to continue under the title rather than the avatar', () => {
    fixture.detectChanges();

    const body = el('.kz-message-body');
    expect(body.parentElement).toBe(el('.kz-message'));
    // Avatar (36px) + the head row's 12px gap.
    expect(getComputedStyle(body).marginLeft).toBe('48px');
  });

  it('shows the celebration badge and glow only when celebrate() is true', () => {
    fixture.detectChanges();
    expect(el('.kz-message-badge')).toBeFalsy();
    expect(el('.kz-message-glow')).toBeFalsy();

    fixture.componentInstance.celebrate.set(true);
    fixture.detectChanges();
    expect(el('.kz-message-badge')).toBeTruthy();
    expect(el('.kz-message-glow')).toBeTruthy();
  });

  it('renders the emphasized 24px title for the Correct/Incorrect states', () => {
    fixture.componentInstance.emphasized.set(true);
    fixture.detectChanges();

    expect(getComputedStyle(el('.kz-message-title')).fontSize).toBe('24px');
  });
});
