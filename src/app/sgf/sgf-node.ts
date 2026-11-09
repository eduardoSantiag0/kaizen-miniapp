/** Shape returned by @sabaki/sgf and consumed by @sabaki/immutable-gametree. No type declarations ship with either package. */
export interface SgfNode {
  id: number;
  data: Record<string, string[]>;
  parentId: number | null;
  children: SgfNode[];
}

export type Vertex = [number, number];

export const BLACK = 1 as const;
export const WHITE = -1 as const;
export type Sign = 0 | 1 | -1;

export function signOfProperty(property: string): Sign {
  if (property === 'B' || property === 'AB') return BLACK;
  if (property === 'W' || property === 'AW') return WHITE;
  return 0;
}

/** First move (B or W property) on a node, if any. */
export function moveOf(node: SgfNode): { sign: 1 | -1; vertex: Vertex } | null {
  for (const sign of [BLACK, WHITE] as const) {
    const property = sign === BLACK ? 'B' : 'W';
    const values = node.data[property];
    if (values?.length) {
      return { sign, vertex: parseVertex(values[0]) };
    }
  }
  return null;
}

/** SGF point letters are 0-indexed lower-case pairs, e.g. "je" -> [9, 4]. Shared space with Shudan/go-board vertices. */
export function parseVertex(point: string): Vertex {
  if (point.length < 2) return [-1, -1];
  return [point.charCodeAt(0) - 97, point.charCodeAt(1) - 97];
}

export function parseVertexList(points: string[] | undefined): Vertex[] {
  return (points ?? []).map(parseVertex);
}
