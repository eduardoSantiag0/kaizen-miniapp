import { Routes } from '@angular/router';
import { ExercisePageComponent } from './exercise/exercise-page.component';
import { GamesPageComponent } from './games/games-page.component';
import { DailyPracticeHomeComponent } from './practice/daily-practice-home.component';
import { PracticeSettingsComponent } from './practice/practice-settings.component';
import { PracticeSessionComponent } from './practice/practice-session.component';
import { PracticeCompleteComponent } from './practice/practice-complete.component';

export const routes: Routes = [
  { path: '', component: GamesPageComponent },
  // gameId binds straight to ExercisePageComponent's `gameId` input (withComponentInputBinding, app.config.ts).
  { path: 'game/:gameId', component: ExercisePageComponent },
  // Daily Practice (handoff v4-3-kaizen-daily-practice): Home is the
  // session's entry screen, session is the thin ExercisePageComponent
  // wrapper that walks its exercises, complete is the one-time streak
  // screen reached from Finish practice — Done there returns to Games.
  { path: 'practice', component: DailyPracticeHomeComponent },
  { path: 'practice/settings', component: PracticeSettingsComponent },
  // :id binds straight to PracticeSessionComponent's `id` input (withComponentInputBinding) — which session to open, the daily one or one of the chat's generated ("Random practice") rounds.
  { path: 'practice/session/:id', component: PracticeSessionComponent },
  { path: 'practice/complete', component: PracticeCompleteComponent },
];
