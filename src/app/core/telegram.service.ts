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
  /**
   * Telegram's official script always creates window.Telegram.WebApp, even
   * outside real Telegram (standalone/browser load) — so `webApp !== null`
   * is never a valid "are we inside real Telegram" check, it's true the
   * moment the script has loaded regardless of context. A real Telegram
   * launch is the only case with non-empty initData, so that's the actual
   * signal every "inside Telegram or not" decision below is gated on.
   */
  private readonly insideTelegram: boolean = !!this.webApp?.initData;

  /** Outside real Telegram, always defaults dark — light only ever comes from Telegram's own reported colorScheme. */
  readonly colorScheme = signal<'light' | 'dark'>(this.insideTelegram ? this.webApp!.colorScheme : 'dark');
  readonly safeAreaInset = signal<TelegramSafeAreaInset>(
    this.insideTelegram ? this.webApp!.safeAreaInset : ZERO_INSET
  );
  readonly contentSafeAreaInset = signal<TelegramSafeAreaInset>(
    this.insideTelegram ? this.webApp!.contentSafeAreaInset : ZERO_INSET
  );
  /**
   * Telegram's own authoritative "safe to size against" height in px, or null
   * outside Telegram (CSS dvh is the fallback there). Uses the *stable*
   * variant deliberately — viewportHeight updates continuously during
   * keyboard/drag transitions, which would make layout jump; stableHeight
   * ignores those, matching "avoid abrupt layout changes."
   */
  readonly viewportStableHeight = signal<number | null>(
    this.insideTelegram ? this.webApp!.viewportStableHeight : null
  );

  get isInsideTelegram(): boolean {
    return this.insideTelegram;
  }

  constructor() {
    this.webApp?.ready();
    // Mobile Telegram opens the Mini App minimized inside its BottomSheet by
    // default (https://docs.telegram-mini-apps.com/platform/viewport) — the
    // whole layout here (100dvh fallback, viewportStableHeight) assumes the
    // maximized height, so without this the board would open cut off.
    this.webApp?.expand();
    this.webApp?.onEvent('themeChanged', () => {
      this.colorScheme.set(this.webApp!.colorScheme);
    });
    this.webApp?.onEvent('safeAreaChanged', () => {
      this.safeAreaInset.set(this.webApp!.safeAreaInset);
    });
    this.webApp?.onEvent('contentSafeAreaChanged', () => {
      this.contentSafeAreaInset.set(this.webApp!.contentSafeAreaInset);
    });
    this.webApp?.onEvent('viewportChanged', () => {
      this.viewportStableHeight.set(this.webApp!.viewportStableHeight);
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
