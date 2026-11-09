import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { SafeAreaService } from './core/safe-area.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Injected for their side effects: apply the Telegram colour scheme and content safe-area insets as soon as the app boots.
  private readonly theme = inject(ThemeService);
  private readonly safeArea = inject(SafeAreaService);
}
