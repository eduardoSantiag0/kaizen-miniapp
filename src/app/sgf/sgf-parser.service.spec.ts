import { SgfParserService, UnreadableSgfError } from './sgf-parser.service';
import type { SgfNode } from './sgf-node';

describe('SgfParserService', () => {
  let service: SgfParserService;

  beforeEach(() => {
    service = new SgfParserService();
  });

  it('parses setup stones, PL and variations into a navigable tree', () => {
    const sgf = '(;FF[4]SZ[9]AB[ee]AW[gg]PL[B](;B[cc];W[dd])(;B[ff]))';
    const tree = service.parse(sgf);

    expect(tree.root.data['AB']).toEqual(['ee']);
    expect(tree.root.data['AW']).toEqual(['gg']);
    expect(tree.root.data['PL']).toEqual(['B']);
    expect(tree.root.children.length).toBe(2);
    expect(tree.root.children[0].data['B']).toEqual(['cc']);
    expect(tree.root.children[0].children[0].data['W']).toEqual(['dd']);
    expect(tree.root.children[1].data['B']).toEqual(['ff']);
  });

  it('preserves passes as empty move values', () => {
    const sgf = '(;FF[4]SZ[9];B[];W[cc])';
    const tree = service.parse(sgf);
    expect(tree.root.children[0].data['B']).toEqual(['']);
  });

  it('walks a real games_test-shaped tree depth first through every sibling', () => {
    const sgf = '(;SZ[19]AB[dd]AW[pp]PL[W](;W[je];B[ie])(;W[ro];B[qo])(;W[an];B[ar]))';
    const tree = service.parse(sgf);

    expect(tree.root.children.map((c: SgfNode) => c.data['W'][0])).toEqual(['je', 'ro', 'an']);
  });

  it('throws UnreadableSgfError when the tokenizer/parser itself throws', () => {
    // An extra stray closing parenthesis crashes @sabaki/sgf's parser internally.
    expect(() => service.parse(')))')).toThrowError(UnreadableSgfError);
  });

  it('throws UnreadableSgfError on empty input', () => {
    expect(() => service.parse('')).toThrowError(UnreadableSgfError);
  });
});
