import type { ExerciseTree } from './exercise-tree';
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
  | { kind: 'backToGames' }
  | { kind: 'retryLoad' };

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
        body: 'Check your connection and try again.',
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

export function messageFor(state: ExerciseState, tree: ExerciseTree, isFinalExercise: boolean): KaizenMessageCopy {
  const screenCopy = messageForScreen(state.screen);
  if (screenCopy) return screenCopy;

  if (state.illegal) {
    return state.illegal.reason === 'suicide'
      ? {
          title: 'Not a legal move',
          body: `${tree.setupBoard.stringifyVertex(state.illegal.vertex)} would have no liberties — that's suicide. Try another point.`,
          tone: 'neutral',
          emphasized: false,
        }
      : {
          title: 'Ko',
          body: `You can't retake at ${tree.setupBoard.stringifyVertex(state.illegal.vertex)} right away. Play elsewhere first.`,
          tone: 'neutral',
          emphasized: false,
        };
  }

  switch (state.phase) {
    case 'play':
      if (state.selectedVariant === null) {
        return {
          title: "Find KataGo's top move",
          body: `Play one of ${colorName(tree.userSign)}'s top recommended moves here.`,
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
        body: `${colorName(tree.opponentSign)} is answering…`,
        tone: 'pine',
        emphasized: false,
      };

    case 'wrong':
      return {
        title: 'Incorrect',
        body: "That's not one of KataGo's top moves here.",
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
      return { kind: 'retryLoad' };
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

export function turnLineText(state: ExerciseState, tree: ExerciseTree): string {
  if (state.screen === 'loading') return 'Loading game';
  if (state.screen === 'error' || state.screen === 'sgfError') return 'Game unavailable';
  if (state.phase === 'done') return 'Line complete';
  return `${colorName(state.turnSign)} to move`;
}
