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
  /** Try again button fill only (HANDOFF-games-update.md section 3). */
  barBg: string;
  /** Try again button's 1px inset edge (HANDOFF-games-update.md section 3). */
  barEdge: string;
  /** "Won · …" (HANDOFF-games-refinement.md section 1). */
  won: string;
  /** "Lost · …", and the ⋮ menu's one destructive item (HANDOFF-games-refinement.md section 1). */
  alert: string;
  /** ⋮ popover fill (HANDOFF-games-refinement.md section 6). */
  menuBg: string;
  /** ⋮ popover's 1px edge (HANDOFF-games-refinement.md section 6). */
  menuBorder: string;
  /** ⋮ popover's drop shadow (HANDOFF-games-refinement.md section 6). */
  menuShadow: string;
  /** ⋮ trigger's background while the popover is open (HANDOFF-games-refinement.md section 6). */
  menuHoverBg: string;
  /** Loading-state row placeholders (HANDOFF-games-refinement.md section 1/7). */
  skeleton: string;
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
  barBg: 'rgba(241,230,204,.06)',
  barEdge: 'rgba(241,230,204,.16)',
  won: '#A3C2A0',
  alert: '#E8907C',
  menuBg: '#192538',
  menuBorder: 'rgba(241,230,204,.12)',
  menuShadow: 'rgba(0,0,0,.4)',
  menuHoverBg: 'rgba(241,230,204,.08)',
  skeleton: 'rgba(241,230,204,.07)',
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
  barBg: 'rgba(28,26,23,.05)',
  barEdge: 'rgba(28,26,23,.18)',
  won: '#3E6346',
  alert: '#A4442F',
  menuBg: '#FBF5E8',
  menuBorder: 'rgba(28,26,23,.12)',
  menuShadow: 'rgba(28,26,23,.18)',
  menuHoverBg: 'rgba(28,26,23,.07)',
  skeleton: 'rgba(28,26,23,.07)',
};

/** Shared across both themes. */
export const SHARED_TOKENS = {
  vermilion: '#D9472B',
  wrongRing: '#B8361F',
  /** Yoru's own `primary` gold, lifted into a cross-theme constant: Washi's
   *  `primary` is indigo, so `--kz-primary` itself would go cold/blue in
   *  light theme for this one celebratory use (the success vignette glow). */
  glowGold: '#E0B45A',
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
  barBg: '--kz-bar-bg',
  barEdge: '--kz-bar-edge',
  won: '--kz-won',
  alert: '--kz-alert',
  menuBg: '--kz-menu-bg',
  menuBorder: '--kz-menu-border',
  menuShadow: '--kz-menu-shadow',
  menuHoverBg: '--kz-menu-hover-bg',
  skeleton: '--kz-skeleton',
};

export function toCssVariables(tokens: ThemeTokens): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(tokens) as (keyof ThemeTokens)[]) {
    result[CSS_VAR_NAMES[key]] = tokens[key];
  }
  result['--kz-vermilion'] = SHARED_TOKENS.vermilion;
  result['--kz-wrong-ring'] = SHARED_TOKENS.wrongRing;
  result['--kz-glow-gold'] = SHARED_TOKENS.glowGold;
  return result;
}
