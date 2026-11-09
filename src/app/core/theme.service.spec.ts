import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { TelegramService } from './telegram.service';

describe('ThemeService', () => {
  afterEach(() => {
    delete window.Telegram;
  });

  it('writes the dark (Yoru) palette as CSS variables on <html> and paints Telegram chrome', () => {
    const service = TestBed.inject(ThemeService);
    service.apply('dark');

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--kz-base').trim()).toBe('#0F1B2D');
    expect(document.documentElement.style.getPropertyValue('--kz-primary').trim()).toBe('#E0B45A');
  });

  it('writes the light (Washi) palette', () => {
    const service = TestBed.inject(ThemeService);
    service.apply('light');

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--kz-base').trim()).toBe('#F1E6CC');
  });

  it('calls setHeaderColor/setBackgroundColor with the base token', () => {
    const telegram = TestBed.inject(TelegramService);
    spyOn(telegram, 'setHeaderColor');
    spyOn(telegram, 'setBackgroundColor');

    TestBed.inject(ThemeService).apply('dark');

    expect(telegram.setHeaderColor).toHaveBeenCalledWith('#0F1B2D');
    expect(telegram.setBackgroundColor).toHaveBeenCalledWith('#0F1B2D');
  });
});
