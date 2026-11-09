import { effect, Injectable, inject } from '@angular/core';
import { TelegramService } from './telegram.service';
import { tokensFor, toCssVariables } from './theme-tokens';

/**
 * Applies the palette from TelegramService.colorScheme as CSS custom properties
 * on <html>, and paints Telegram's own chrome with setHeaderColor/setBackgroundColor
 * using the `base` token (HANDOFF.md section 3).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly telegram = inject(TelegramService);

  constructor() {
    effect(() => this.apply(this.telegram.colorScheme()));
  }

  apply(colorScheme: 'light' | 'dark'): void {
    const tokens = tokensFor(colorScheme);
    const root = document.documentElement;

    root.dataset['theme'] = colorScheme;
    for (const [name, value] of Object.entries(toCssVariables(tokens))) {
      root.style.setProperty(name, value);
    }

    this.telegram.setHeaderColor(tokens.base);
    this.telegram.setBackgroundColor(tokens.base);
  }
}
