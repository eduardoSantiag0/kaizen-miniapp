import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GameHistoryService } from './data/game-history.service';
import { HttpGameHistoryService } from './data/http-game-history.service';
import { MockGameHistoryService } from './data/mock-game-history.service';
import { PracticeService } from './data/practice.service';
import { MockPracticeService } from './data/mock-practice.service';

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
    // No real backend yet (docs/backend-contract/daily-practice-endpoint-proposal.md)
    // — stays on the mock regardless of environment.useRealBackend. Swap to
    // HttpPracticeService (http-practice.service.ts) once that backend exists.
    {
      provide: PracticeService,
      useClass: MockPracticeService,
    },
  ]
};
