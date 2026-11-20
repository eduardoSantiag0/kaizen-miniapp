import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GameHistoryService } from './data/game-history.service';
import { HttpGameHistoryService } from './data/http-game-history.service';
import { MockGameHistoryService } from './data/mock-game-history.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding: the :gameId route param binds straight to
    // ExercisePageComponent's `gameId` input, no resolver/wrapper needed.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // environment.useRealBackend (not environment.production) decides this,
    // so a production build can still be pointed at the mock if ever needed,
    // and local dev keeps working without a running backend either way.
    {
      provide: GameHistoryService,
      useClass: environment.useRealBackend ? HttpGameHistoryService : MockGameHistoryService,
    },
  ]
};
