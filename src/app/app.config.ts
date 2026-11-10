import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { GameHistoryService } from './data/game-history.service';
import { MockGameHistoryService } from './data/mock-game-history.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding: the :gameId route param binds straight to
    // ExercisePageComponent's `gameId` input, no resolver/wrapper needed.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // The real HTTP-backed GameHistoryService doesn't exist yet; swap this
    // provider for it later without touching anything that injects the
    // abstract GameHistoryService.
    { provide: GameHistoryService, useClass: MockGameHistoryService },
  ]
};
