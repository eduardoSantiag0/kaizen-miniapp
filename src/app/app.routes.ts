import { Routes } from '@angular/router';
import { ExercisePageComponent } from './exercise/exercise-page.component';
import { GamesPageComponent } from './games/games-page.component';

export const routes: Routes = [
  { path: '', component: GamesPageComponent },
  // gameId binds straight to ExercisePageComponent's `gameId` input (withComponentInputBinding, app.config.ts).
  { path: 'game/:gameId', component: ExercisePageComponent },
];
