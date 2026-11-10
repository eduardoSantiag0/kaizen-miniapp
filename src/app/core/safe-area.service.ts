import { effect, inject, Injectable } from '@angular/core';
import { TelegramService } from './telegram.service';
import type { TelegramSafeAreaInset } from './telegram-webapp';

const VAR_PREFIX = '--kz-content-safe-';
const VIEWPORT_HEIGHT_VAR = '--kz-viewport-height';

/**
 * Exposes TelegramService.contentSafeAreaInset as CSS custom properties on
 * <html> (--kz-content-safe-top/bottom/left/right). contentSafeAreaInset is
 * Telegram's own chrome overlapping the WebView (e.g. its header in iOS
 * expanded mode) — distinct from the device-level safeAreaInset already
 * handled via CSS env(safe-area-inset-*) in seigaiha-fill.
 *
 * Also exposes TelegramService.viewportStableHeight as --kz-viewport-height,
 * Telegram's own authoritative "safe to size against" height — more reliable
 * than CSS 100dvh inside Telegram's WebView (see TelegramService). Outside
 * Telegram, this var is left at its :root fallback of 100dvh.
 */
@Injectable({ providedIn: 'root' })
export class SafeAreaService {
  private readonly telegram = inject(TelegramService);

  constructor() {
    effect(() => this.apply(this.telegram.contentSafeAreaInset()));
    effect(() => this.applyViewportHeight(this.telegram.viewportStableHeight()));
  }

  apply(inset: TelegramSafeAreaInset): void {
    const root = document.documentElement;
    root.style.setProperty(`${VAR_PREFIX}top`, `${inset.top}px`);
    root.style.setProperty(`${VAR_PREFIX}bottom`, `${inset.bottom}px`);
    root.style.setProperty(`${VAR_PREFIX}left`, `${inset.left}px`);
    root.style.setProperty(`${VAR_PREFIX}right`, `${inset.right}px`);
  }

  applyViewportHeight(height: number | null): void {
    if (height === null) return; // keep the :root fallback (100dvh) outside Telegram
    document.documentElement.style.setProperty(VIEWPORT_HEIGHT_VAR, `${height}px`);
  }
}
