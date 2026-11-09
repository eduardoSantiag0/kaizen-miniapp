// @sabaki/sgf and @sabaki/immutable-gametree ship no type declarations.
declare module '@sabaki/sgf' {
  import type { SgfNode } from './sgf-node';

  export function parse(
    contents: string,
    options?: { getId?: () => number }
  ): SgfNode[];
}

declare module '@sabaki/immutable-gametree' {
  import type { SgfNode } from './sgf-node';

  export default class GameTree {
    constructor(options?: { getId?: () => number; root?: SgfNode });
    root: SgfNode;
    get(id: number): SgfNode | null;
    navigate(id: number, step: number, currents: Record<number, number>): SgfNode | null;
  }
}
