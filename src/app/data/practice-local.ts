import type { ExerciseProgress } from '../exercise/exercise-state';

export type LocalResult = 'pending' | 'rejected';

function key(accountId: string, sessionId: string, exerciseId: string, field: 'position' | 'result'): string {
  return `kaizen:practice:${field}:${accountId}:${sessionId}:${exerciseId}`;
}

export function readPracticeLocal(
  accountId: string | null, sessionId: string, exerciseId: string, field: 'position' | 'result',
): unknown {
  if (accountId === null) return null;
  try {
    return JSON.parse(localStorage.getItem(key(accountId, sessionId, exerciseId, field)) ?? 'null');
  } catch {
    return null;
  }
}

export function writePracticeLocal(
  accountId: string | null, sessionId: string, exerciseId: string, field: 'position' | 'result',
  value: ExerciseProgress | LocalResult | null,
): void {
  if (accountId === null) return;
  try {
    const storageKey = key(accountId, sessionId, exerciseId, field);
    if (value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage may be unavailable. In-memory practice remains usable.
  }
}

export function readPracticePosition(accountId: string | null, sessionId: string, exerciseId: string): ExerciseProgress | null {
  const value = readPracticeLocal(accountId, sessionId, exerciseId, 'position') as ExerciseProgress | null;
  if (!value || (value.selectedVariant !== null && (!Number.isInteger(value.selectedVariant) || value.selectedVariant < 0)) ||
      !Number.isInteger(value.confirmedPlies) || value.confirmedPlies < 0 ||
      !Number.isInteger(value.currentDepth) || value.currentDepth < 2 || value.currentDepth > 10 ||
      typeof value.deepening !== 'boolean' ||
      !['playing', 'awaiting_reply', 'completed'].includes(value.progressPhase)) return null;
  return value;
}

export function isDeepening(progress: ExerciseProgress | null | undefined): boolean {
  return progress?.deepening === true && progress.progressPhase !== 'completed';
}
