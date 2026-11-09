import { Routes } from '@angular/router';
import { ExercisePageComponent } from './exercise/exercise-page.component';

// GamesPage comes later; the app opens straight on the Exercise screen for now.
export const routes: Routes = [{ path: '', component: ExercisePageComponent }];
