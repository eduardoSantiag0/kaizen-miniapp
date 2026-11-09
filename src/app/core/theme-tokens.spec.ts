import { tokensFor, toCssVariables, YORU_DARK, WASHI_LIGHT } from './theme-tokens';

describe('theme-tokens', () => {
  it('picks Yoru (dark) and Washi (light) by colour scheme', () => {
    expect(tokensFor('dark')).toBe(YORU_DARK);
    expect(tokensFor('light')).toBe(WASHI_LIGHT);
  });

  it('maps every token to a --kz- prefixed CSS variable', () => {
    const vars = toCssVariables(YORU_DARK);
    expect(vars['--kz-base']).toBe('#0F1B2D');
    expect(vars['--kz-primary']).toBe('#E0B45A');
    expect(vars['--kz-vermilion']).toBe('#D9472B');
  });
});
