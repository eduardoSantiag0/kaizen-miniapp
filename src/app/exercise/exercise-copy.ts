import type { ExerciseLine } from './exercise-line';
import type { ExerciseState } from './exercise-state';

export type MessageTone = 'neutral' | 'pine' | 'shu';

export interface KaizenMessageCopy {
  title: string;
  body: string;
  tone: MessageTone;
  /** Incorrect/Correct render the title at 24px (section 3's type table); every other state is 18px. */
  emphasized: boolean;
}

export type ActionsCopy =
  | { kind: 'none' }
  | { kind: 'tryAgain' }
  | { kind: 'correct' }
  | { kind: 'loading' }
  | { kind: 'backToGames' };

const colorName = (sign: 1 | -1) => (sign === 1 ? 'Black' : 'White');

export function messageForScreen(screen: ExerciseState['screen']): KaizenMessageCopy | null {
  switch (screen) {
    case 'loading':
      return {
        title: 'One moment',
        body: 'Fetching the game and KataGo’s analysis…',
        tone: 'neutral',
        emphasized: false,
      };
    case 'error':
      return {
        title: 'Kaizen didn’t answer',
        body: 'Go back and open the game again in a moment.',
        tone: 'shu',
        emphasized: false,
      };
    case 'sgfError':
      return {
        title: "Couldn't read this game",
        body: 'Its game record is damaged. Pick another game from the list.',
        tone: 'shu',
        emphasized: false,
      };
    case 'ready':
      return null;
  }
}

export function messageFor(state: ExerciseState, line: ExerciseLine, isFinalExercise: boolean): KaizenMessageCopy {
  const screenCopy = messageForScreen(state.screen);
  if (screenCopy) return screenCopy;

  if (state.illegal) {
    return state.illegal.reason === 'suicide'
      ? {
          title: 'Not a legal move',
          body: `${line.setupBoard.stringifyVertex(state.illegal.vertex)} would have no liberties — that's suicide. Try another point.`,
          tone: 'neutral',
          emphasized: false,
        }
      : {
          title: 'Ko',
          body: `You can't retake at ${line.setupBoard.stringifyVertex(state.illegal.vertex)} right away. Play elsewhere first.`,
          tone: 'neutral',
          emphasized: false,
        };
  }

  switch (state.phase) {
    case 'play':
      if (state.step === 1) {
        return {
          title: `Your biggest mistake: ${mistakeCoord(line)}`,
          body: `Find a better move for ${colorName(line.userSign)}, then keep going for ${state.totalSteps} moves.`,
          tone: 'neutral',
          emphasized: false,
        };
      }
      return {
        title: 'Keep going',
        body: `Follow KataGo's line — move ${state.step} of ${state.totalSteps}.`,
        tone: 'neutral',
        emphasized: false,
      };

    case 'reply':
      return {
        title: 'Good move',
        body: `${colorName(line.opponentSign)} is answering…`,
        tone: 'pine',
        emphasized: false,
      };

    case 'wrong':
      return {
        title: 'Incorrect',
        body:
          state.wrongMove?.reason === 'mistakeMove'
            ? "That's the move you played in the game. Look again."
            : "That's not KataGo's move here.",
        tone: 'shu',
        emphasized: true,
      };

    case 'done':
      return {
        title: 'Correct',
        body: isFinalExercise
          ? `All ${state.totalSteps} moves of KataGo's line. That's this game done: opening, middlegame and endgame.`
          : `All ${state.totalSteps} moves of KataGo's line. One step better than yesterday.`,
        tone: 'pine',
        emphasized: true,
      };
  }
}

export function actionsForScreen(screen: ExerciseState['screen']): ActionsCopy | null {
  switch (screen) {
    case 'loading':
      return { kind: 'loading' };
    case 'error':
    case 'sgfError':
      return { kind: 'backToGames' };
    case 'ready':
      return null;
  }
}

export function actionsFor(state: ExerciseState): ActionsCopy {
  const screenActions = actionsForScreen(state.screen);
  if (screenActions) return screenActions;
  if (state.illegal) return { kind: 'none' };

  switch (state.phase) {
    case 'play':
    case 'reply':
      return { kind: 'none' };
    case 'wrong':
      return { kind: 'tryAgain' };
    case 'done':
      return { kind: 'correct' };
  }
}

export function mistakeCoord(line: ExerciseLine): string {
  return line.mistakeVertex ? line.setupBoard.stringifyVertex(line.mistakeVertex) : '';
}

export function turnLineText(state: ExerciseState, line: ExerciseLine): string {
  if (state.screen === 'loading') return 'Loading game';
  if (state.screen === 'error' || state.screen === 'sgfError') return 'Game unavailable';
  if (state.phase === 'done') return 'Line complete';
  return `${colorName(state.turnSign)} to move`;
}
