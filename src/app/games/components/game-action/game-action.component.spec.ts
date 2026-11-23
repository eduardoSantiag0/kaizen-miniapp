import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameActionComponent } from './game-action.component';
import { TelegramService } from '../../../core/telegram.service';
import type { GameStatus } from '../../game-list-entry';
import type { TelegramPopupParams } from '../../../core/telegram-webapp';

@Component({
  selector: 'kz-test-host',
  imports: [GameActionComponent],
  template: `<kz-game-action [status]="status()" [opponentName]="opponentName()" (confirmed)="log()" />`,
})
class TestHostComponent {
  readonly status = signal<GameStatus>('running');
  readonly opponentName = signal('kitsune77');
  readonly events: string[] = [];
  log(): void {
    this.events.push('confirmed');
  }
}

describe('GameActionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let telegram: TelegramService;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.kz-game-action') as HTMLButtonElement;
  }

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    telegram = TestBed.inject(TelegramService);
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('shows "Cancel" for a running game, with the cancel aria-label', () => {
    fixture.detectChanges();
    expect(button().textContent?.trim()).toBe('Cancel');
    expect(button().getAttribute('aria-label')).toBe('Cancel the analysis of your game vs kitsune77');
  });

  it('shows "Cancel" for a waiting game too, same aria-label as running', () => {
    fixture.componentInstance.status.set('waiting');
    fixture.detectChanges();
    expect(button().textContent?.trim()).toBe('Cancel');
    expect(button().getAttribute('aria-label')).toBe('Cancel the analysis of your game vs kitsune77');
  });

  it('shows "Delete" for a done game, with the delete aria-label', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    expect(button().textContent?.trim()).toBe('Delete');
    expect(button().getAttribute('aria-label')).toBe('Delete your game vs kitsune77');
  });

  it('opens a destructive "Cancel analysis" popup for a running game, with "Keep" as the default button', () => {
    fixture.detectChanges();
    spyOn(telegram, 'showPopup');

    button().click();

    expect(telegram.showPopup).toHaveBeenCalledTimes(1);
    const params = (telegram.showPopup as jasmine.Spy).calls.mostRecent().args[0] as TelegramPopupParams;
    expect(params.title).toBe('Cancel this analysis?');
    expect(params.message).toContain('kitsune77');
    expect(params.buttons).toEqual([
      { id: 'confirm', type: 'destructive', text: 'Cancel analysis' },
      { id: 'keep', type: 'default', text: 'Keep' },
    ]);
  });

  it('gives waiting and running games different popup copy', () => {
    fixture.componentInstance.status.set('waiting');
    fixture.detectChanges();
    spyOn(telegram, 'showPopup');

    button().click();

    const params = (telegram.showPopup as jasmine.Spy).calls.mostRecent().args[0] as TelegramPopupParams;
    expect(params.message).toBe('Your game vs kitsune77 leaves the analysis queue and your list.');
  });

  it('opens a destructive "Delete game" popup for a done game', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    spyOn(telegram, 'showPopup');

    button().click();

    const params = (telegram.showPopup as jasmine.Spy).calls.mostRecent().args[0] as TelegramPopupParams;
    expect(params.title).toBe('Delete this game?');
    expect(params.buttons[0]).toEqual({ id: 'confirm', type: 'destructive', text: 'Delete game' });
  });

  it('emits confirmed only when the destructive button was tapped, not "Keep"', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    spyOn(telegram, 'showPopup').and.callFake((_params, callback) => callback('keep'));

    button().click();
    expect(fixture.componentInstance.events).toEqual([]);

    (telegram.showPopup as jasmine.Spy).and.callFake((_params, callback) => callback('confirm'));
    button().click();
    expect(fixture.componentInstance.events).toEqual(['confirmed']);
  });
});
