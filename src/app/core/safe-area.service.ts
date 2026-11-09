import { effect, inject, Injectable } from '@angular/core';
import { TelegramService } from './telegram.service';
import type { TelegramSafeAreaInset } from './telegram-webapp';

const VAR_PREFIX = '--kz-content-safe-';

/**
 * Exposes TelegramService.contentSafeAreaInset as CSS custom properties on
 * <html> (--kz-content-safe-top/bottom/left/right). contentSafeAreaInset is
 * Telegram's own chrome overlapping the WebView (e.g. its header in iOS
 * expanded mode) — distinct from the device-level safeAreaInset already
 * handled via CSS env(safe-area-inset-*) in seigaiha-fill.
 */
@Injectable({ providedIn: 'root' })
export class SafeAreaService {
  private readonly telegram = inject(TelegramService);

  constructor() {
    effect(() => this.apply(this.telegram.contentSafeAreaInset()));
  }

  apply(inset: TelegramSafeAreaInset): void {
    const root = document.documentElement;
    root.style.setProperty(`${VAR_PREFIX}top`, `${inset.top}px`);
    root.style.setProperty(`${VAR_PREFIX}bottom`, `${inset.bottom}px`);
    root.style.setProperty(`${VAR_PREFIX}left`, `${inset.left}px`);
    root.style.setProperty(`${VAR_PREFIX}right`, `${inset.right}px`);
  }
}
