import type { ResolvedTheme, ThemeMode } from '../bridge/types';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  displayName: string;
  group: 'existing' | 'light' | 'dark';
}

export const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  { id: 'system', label: 'System', displayName: 'System Theme', group: 'existing' },
  { id: 'light', label: 'Ivory', displayName: 'Ivory Light', group: 'existing' },
  { id: 'dark', label: 'Obsidian', displayName: 'Obsidian Night', group: 'existing' },
  { id: 'paper', label: 'Paper', displayName: 'Warm Paper', group: 'existing' },
  { id: 'snow', label: 'Snow', displayName: 'Snow', group: 'light' },
  { id: 'charcoal', label: 'Charcoal', displayName: 'Charcoal', group: 'dark' },
  { id: 'sepia-dark', label: 'Sepia Dark', displayName: 'Sepia Dark', group: 'dark' },
  { id: 'nord', label: 'Nord', displayName: 'Nord', group: 'dark' },
  { id: 'oled', label: 'OLED', displayName: 'OLED', group: 'dark' },
];

export interface AccentPreset {
  id: string;
  label: string;
  swatch: string;
}

export const ACCENT_PRESETS: ReadonlyArray<AccentPreset> = [
  { id: 'default', label: 'Default Blue', swatch: '#3B5BDB' },
  { id: '#FFD400', label: 'Gold', swatch: '#FFD400' },
  { id: '#10B981', label: 'Emerald', swatch: '#10B981' },
  { id: '#F43F5E', label: 'Rose', swatch: '#F43F5E' },
  { id: '#8B5CF6', label: 'Violet', swatch: '#8B5CF6' },
];

export interface AccentTokenSet {
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentText: string;
  accentBorder: string;
  accentSelection: string;
  accentOnSolid: string;
}

const THEME_BG_HEX: Record<ResolvedTheme, string> = {
  light: '#FAF9F6',
  paper: '#F6F0E6',
  snow: '#F8FAFC',
  dark: '#111318',
  charcoal: '#1E1E1E',
  'sepia-dark': '#1F1D1A',
  nord: '#2E3440',
  oled: '#000000',
};

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return (
    theme === 'dark' ||
    theme === 'charcoal' ||
    theme === 'sepia-dark' ||
    theme === 'nord' ||
    theme === 'oled'
  );
}

export function getThemeLabel(theme: ThemeMode, resolved?: ResolvedTheme): string {
  if (theme === 'system') {
    if (resolved) {
      const inner = THEME_OPTIONS.find((t) => t.id === resolved)?.displayName ?? resolved;
      return `System (${inner})`;
    }
    return 'System Theme';
  }
  return THEME_OPTIONS.find((t) => t.id === theme)?.displayName ?? theme;
}

export function normalizeHexColor(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase();
    return `#${expanded}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const ratio = Math.max(0, Math.min(1, t));
  return rgbToHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function darkenUntilContrast(hex: string, bgHex: string, minContrast: number): string {
  if (contrastRatio(hex, bgHex) >= minContrast) return hex;
  for (let step = 1; step <= 40; step++) {
    const candidate = mixHex(hex, '#000000', step / 40);
    if (contrastRatio(candidate, bgHex) >= minContrast) {
      return candidate;
    }
  }
  return '#18181B';
}

function lightenUntilContrast(hex: string, bgHex: string, minContrast: number): string {
  if (contrastRatio(hex, bgHex) >= minContrast) return hex;
  for (let step = 1; step <= 40; step++) {
    const candidate = mixHex(hex, '#FFFFFF', step / 40);
    if (contrastRatio(candidate, bgHex) >= minContrast) {
      return candidate;
    }
  }
  return '#F4F4F5';
}

function rgbaString(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Computes WCAG-safe CSS token values for a selected accent color in the given resolved theme.
 * Returns null for "default" or invalid inputs so base theme CSS tokens remain active.
 */
export function computeAccentTokens(
  accentColor: string,
  resolvedTheme: ResolvedTheme
): AccentTokenSet | null {
  if (!accentColor || accentColor === 'default') return null;
  const hex = normalizeHexColor(accentColor);
  if (!hex) return null;

  const dark = isDarkTheme(resolvedTheme);
  const bgHex = THEME_BG_HEX[resolvedTheme] ?? (dark ? '#111318' : '#FAF9F6');
  const accentOnSolid = relativeLuminance(hex) > 0.36 ? '#18181B' : '#FFFFFF';

  if (!dark && hex === '#FFD400') {
    return {
      accent: '#FFD400',
      accentHover: '#E6BF00',
      accentText: '#A17C00',
      accentBorder: '#B48A00',
      accentSoft: 'rgba(180, 138, 0, 0.14)',
      accentSelection: 'rgba(255, 212, 0, 0.30)',
      accentOnSolid: '#18181B',
    };
  }

  if (dark && hex === '#FFD400') {
    return {
      accent: '#FFD400',
      accentHover: '#FFE033',
      accentText: '#FFD400',
      accentBorder: '#FFD400',
      accentSoft: 'rgba(255, 212, 0, 0.16)',
      accentSelection: 'rgba(255, 212, 0, 0.28)',
      accentOnSolid: '#18181B',
    };
  }

  if (!dark) {
    const accentText = darkenUntilContrast(hex, bgHex, 4.5);
    const accentBorder = darkenUntilContrast(hex, bgHex, 3.2);
    const accentHover = mixHex(hex, '#000000', 0.1);
    const tintSource = relativeLuminance(hex) > 0.6 ? accentBorder : hex;
    return {
      accent: hex,
      accentHover,
      accentText,
      accentBorder,
      accentSoft: rgbaString(tintSource, 0.12),
      accentSelection: rgbaString(hex, 0.22),
      accentOnSolid,
    };
  }

  const accentText = lightenUntilContrast(hex, bgHex, 4.5);
  const accentBorder = lightenUntilContrast(hex, bgHex, 3.2);
  const accentHover =
    relativeLuminance(hex) > 0.55 ? mixHex(hex, '#FFFFFF', 0.15) : mixHex(hex, '#FFFFFF', 0.12);

  return {
    accent: hex,
    accentHover,
    accentText,
    accentBorder,
    accentSoft: rgbaString(accentText, 0.16),
    accentSelection: rgbaString(hex, 0.26),
    accentOnSolid,
  };
}

const ACCENT_CSS_PROPS = [
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-text',
  '--accent-border',
  '--accent-selection',
  '--accent-on-solid',
  '--border-focus',
] as const;

export function applyAccentToRoot(
  root: HTMLElement,
  accentColor: string,
  resolvedTheme: ResolvedTheme
): void {
  const tokens = computeAccentTokens(accentColor, resolvedTheme);
  if (!tokens) {
    for (const prop of ACCENT_CSS_PROPS) {
      root.style.removeProperty(prop);
    }
    return;
  }

  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-hover', tokens.accentHover);
  root.style.setProperty('--accent-soft', tokens.accentSoft);
  root.style.setProperty('--accent-text', tokens.accentText);
  root.style.setProperty('--accent-border', tokens.accentBorder);
  root.style.setProperty('--accent-selection', tokens.accentSelection);
  root.style.setProperty('--accent-on-solid', tokens.accentOnSolid);
  root.style.setProperty('--border-focus', tokens.accentBorder);
}
