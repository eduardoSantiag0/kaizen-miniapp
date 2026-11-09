/** HANDOFF.md section 3, "Colour" — Yoru 夜 (dark) / Washi 和紙 (light). */
export interface ThemeTokens {
  base: string;
  ink: string;
  hint: string;
  rule: string;
  ruleList: string;
  primary: string;
  onPrimary: string;
  pressedBg: string;
  disabledBg: string;
  shu: string;
  pine: string;
}

export const YORU_DARK: ThemeTokens = {
  base: '#0F1B2D',
  ink: '#F1E6CC',
  hint: '#A7B3C4',
  rule: 'rgba(241,230,204,.28)',
  ruleList: 'rgba(241,230,204,.18)',
  primary: '#E0B45A',
  onPrimary: '#1C1A17',
  pressedBg: 'rgba(224,180,90,.16)',
  disabledBg: 'rgba(241,230,204,.08)',
  shu: '#EE7253',
  pine: '#6CC09D',
};

export const WASHI_LIGHT: ThemeTokens = {
  base: '#F1E6CC',
  ink: '#1C1A17',
  hint: '#5C5244',
  rule: 'rgba(28,26,23,.28)',
  ruleList: 'rgba(28,26,23,.20)',
  primary: '#1F3A5F',
  onPrimary: '#F1E6CC',
  pressedBg: 'rgba(31,58,95,.10)',
  disabledBg: 'rgba(28,26,23,.06)',
  shu: '#A8301B',
  pine: '#2A604E',
};

/** Shared across both themes. */
export const SHARED_TOKENS = {
  vermilion: '#D9472B',
  wrongRing: '#B8361F',
};

export function tokensFor(colorScheme: 'light' | 'dark'): ThemeTokens {
  return colorScheme === 'dark' ? YORU_DARK : WASHI_LIGHT;
}

const CSS_VAR_NAMES: Record<keyof ThemeTokens, string> = {
  base: '--kz-base',
  ink: '--kz-ink',
  hint: '--kz-hint',
  rule: '--kz-rule',
  ruleList: '--kz-rule-list',
  primary: '--kz-primary',
  onPrimary: '--kz-on-primary',
  pressedBg: '--kz-pressed-bg',
  disabledBg: '--kz-disabled-bg',
  shu: '--kz-shu',
  pine: '--kz-pine',
};

export function toCssVariables(tokens: ThemeTokens): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(tokens) as (keyof ThemeTokens)[]) {
    result[CSS_VAR_NAMES[key]] = tokens[key];
  }
  result['--kz-vermilion'] = SHARED_TOKENS.vermilion;
  result['--kz-wrong-ring'] = SHARED_TOKENS.wrongRing;
  return result;
}
