import { Injectable } from '@angular/core';
import { parse } from '@sabaki/sgf';
import GameTree from '@sabaki/immutable-gametree';
import type { SgfNode } from './sgf-node';

export class UnreadableSgfError extends Error {
  constructor(cause?: unknown) {
    super('SGF could not be parsed');
    this.cause = cause;
  }
}

/**
 * Parses SGF text into a @sabaki/immutable-gametree, so the rest of the app
 * never touches @sabaki/sgf or raw node objects directly.
 */
@Injectable({ providedIn: 'root' })
export class SgfParserService {
  parse(sgfText: string): GameTree {
    let rootNodes: SgfNode[];

    try {
      rootNodes = parse(sgfText);
    } catch (error) {
      throw new UnreadableSgfError(error);
    }

    if (!rootNodes.length) {
      throw new UnreadableSgfError();
    }

    return new GameTree({ root: rootNodes[0] });
  }
}
