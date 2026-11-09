import { Injectable, signal } from '@angular/core';
import type { TelegramSafeAreaInset, TelegramWebApp } from './telegram-webapp';

const ZERO_INSET: TelegramSafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Wraps window.Telegram.WebApp. Every member degrades to a harmless no-op (or a
 * sane browser default) when the app isn't running inside Telegram, so local
 * dev and plain-browser testing work unmodified.
 */
@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly webApp: TelegramWebApp | null = window.Telegram?.WebApp ?? null;

  readonly colorScheme = signal<'light' | 'dark'>(
    this.webApp?.colorScheme ?? (matchesDarkMode() ? 'dark' : 'light')
  );
  readonly safeAreaInset = signal<TelegramSafeAreaInset>(this.webApp?.safeAreaInset ?? ZERO_INSET);
  readonly contentSafeAreaInset = signal<TelegramSafeAreaInset>(
    this.webApp?.contentSafeAreaInset ?? ZERO_INSET
  );

  get isInsideTelegram(): boolean {
    return this.webApp !== null;
  }

  constructor() {
    this.webApp?.ready();
    this.webApp?.onEvent('themeChanged', () => {
      this.colorScheme.set(this.webApp!.colorScheme);
    });
    this.webApp?.onEvent('safeAreaChanged', () => {
      this.safeAreaInset.set(this.webApp!.safeAreaInset);
    });
    this.webApp?.onEvent('contentSafeAreaChanged', () => {
      this.contentSafeAreaInset.set(this.webApp!.contentSafeAreaInset);
    });
  }

  setHeaderColor(color: string): void {
    this.webApp?.setHeaderColor(color);
  }

  setBackgroundColor(color: string): void {
    this.webApp?.setBackgroundColor(color);
  }

  showBackButton(onClick: () => void): void {
    this.webApp?.BackButton.onClick(onClick);
    this.webApp?.BackButton.show();
  }

  hideBackButton(onClick: () => void): void {
    this.webApp?.BackButton.offClick(onClick);
    this.webApp?.BackButton.hide();
  }

  disableVerticalSwipes(): void {
    this.webApp?.disableVerticalSwipes();
  }

  enableVerticalSwipes(): void {
    this.webApp?.enableVerticalSwipes();
  }

  notificationHaptic(type: 'error' | 'success' | 'warning'): void {
    this.webApp?.HapticFeedback.notificationOccurred(type);
  }
}

function matchesDarkMode(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
