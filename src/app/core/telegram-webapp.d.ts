// Minimal surface of the Telegram Mini Apps JS SDK (window.Telegram.WebApp) that this app uses.
// https://core.telegram.org/bots/webapps
export interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramHapticFeedback {
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export interface TelegramWebApp {
  /**
   * Telegram's official script always creates window.Telegram.WebApp, even
   * outside real Telegram (standalone/browser load) — this is empty in that
   * case and only ever populated when actually launched from within Telegram,
   * making it the real "are we inside Telegram" signal (see TelegramService).
   */
  initData: string;
  colorScheme: 'light' | 'dark';
  safeAreaInset: TelegramSafeAreaInset;
  contentSafeAreaInset: TelegramSafeAreaInset;
  /** Updates continuously (e.g. during keyboard/drag transitions) — prefer viewportStableHeight for layout sizing. */
  viewportHeight: number;
  /** Ignores transitional states, so layout sized from this doesn't jump mid-gesture. */
  viewportStableHeight: number;
  HapticFeedback: TelegramHapticFeedback;
  BackButton: TelegramBackButton;
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes(): void;
  enableVerticalSwipes(): void;
  ready(): void;
  expand(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
