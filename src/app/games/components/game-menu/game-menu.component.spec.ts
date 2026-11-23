import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMenuComponent } from './game-menu.component';
import { TelegramService } from '../../../core/telegram.service';
import type { GameStatus } from '../../game-list-entry';
import type { TelegramPopupParams } from '../../../core/telegram-webapp';

@Component({
  selector: 'kz-test-host',
  imports: [GameMenuComponent],
  template: `<kz-game-menu [status]="status()" [opponentName]="opponentName()" (confirmed)="log()" />`,
})
class TestHostComponent {
  readonly status = signal<GameStatus>('running');
  readonly opponentName = signal('kitsune77');
  readonly events: string[] = [];
  log(): void {
    this.events.push('confirmed');
  }
}

describe('GameMenuComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let telegram: TelegramService;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.kz-game-menu-trigger') as HTMLButtonElement;
  }

  function item(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.kz-game-menu-item');
  }

  function openMenu(): void {
    trigger().click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    delete window.Telegram;
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    telegram = TestBed.inject(TelegramService);
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('is closed until the ⋮ trigger is tapped, with a per-opponent aria-label', () => {
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-label')).toBe('More actions for the game vs kitsune77');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(item()).toBeNull();

    openMenu();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(item()).toBeTruthy();
  });

  it('shows "Cancel analysis" for a running or waiting game', () => {
    fixture.detectChanges();
    openMenu();
    expect(item()!.textContent?.trim()).toBe('Cancel analysis');

    fixture.componentInstance.status.set('waiting');
    fixture.detectChanges();
    expect(item()!.textContent?.trim()).toBe('Cancel analysis');
  });

  it('shows "Delete game" for a done game', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    openMenu();
    expect(item()!.textContent?.trim()).toBe('Delete game');
  });

  it('closes via the overlay without confirming anything', () => {
    fixture.detectChanges();
    openMenu();

    (fixture.nativeElement.querySelector('.kz-game-menu-overlay') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(item()).toBeNull();
    expect(fixture.componentInstance.events).toEqual([]);
  });

  it('opens a destructive "Cancel analysis" popup for a running game, with "Keep" as the default button, and closes the menu', () => {
    fixture.detectChanges();
    openMenu();
    spyOn(telegram, 'showPopup');

    item()!.click();
    fixture.detectChanges();

    expect(item()).toBeNull();
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
    openMenu();
    spyOn(telegram, 'showPopup');

    item()!.click();

    const params = (telegram.showPopup as jasmine.Spy).calls.mostRecent().args[0] as TelegramPopupParams;
    expect(params.message).toBe('Your game vs kitsune77 leaves the analysis queue and your list.');
  });

  it('opens a destructive "Delete game" popup for a done game', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    openMenu();
    spyOn(telegram, 'showPopup');

    item()!.click();

    const params = (telegram.showPopup as jasmine.Spy).calls.mostRecent().args[0] as TelegramPopupParams;
    expect(params.title).toBe('Delete this game?');
    expect(params.buttons[0]).toEqual({ id: 'confirm', type: 'destructive', text: 'Delete game' });
  });

  it('emits confirmed only when the destructive button was tapped, not "Keep"', () => {
    fixture.componentInstance.status.set('done');
    fixture.detectChanges();
    spyOn(telegram, 'showPopup').and.callFake((_params, callback) => callback('keep'));

    openMenu();
    item()!.click();
    expect(fixture.componentInstance.events).toEqual([]);

    (telegram.showPopup as jasmine.Spy).and.callFake((_params, callback) => callback('confirm'));
    openMenu();
    item()!.click();
    expect(fixture.componentInstance.events).toEqual(['confirmed']);
  });
});
