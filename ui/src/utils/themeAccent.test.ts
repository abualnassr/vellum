import { describe, expect, it } from 'vitest';
import {
  computeAccentTokens,
  contrastRatio,
  isDarkTheme,
  normalizeHexColor,
} from './themeAccent';

describe('themeAccent utilities', () => {
  it('returns null for default or invalid accent values', () => {
    expect(computeAccentTokens('default', 'light')).toBeNull();
    expect(computeAccentTokens('default', 'dark')).toBeNull();
    expect(computeAccentTokens('default', 'paper')).toBeNull();
    expect(computeAccentTokens('not-a-color', 'snow')).toBeNull();
  });

  it('normalizes 3-digit, 6-digit, and bare hex colors', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
    expect(normalizeHexColor('ffd400')).toBe('#FFD400');
    expect(normalizeHexColor(' #10b981 ')).toBe('#10B981');
    expect(normalizeHexColor('#12')).toBeNull();
    expect(normalizeHexColor('#GGGGGG')).toBeNull();
  });

  it('applies readable darkened gold on all Light themes while keeping dark ink on #FFD400 solid fills', () => {
    for (const theme of ['light', 'paper', 'snow'] as const) {
      const tokens = computeAccentTokens('#FFD400', theme);
      expect(tokens).not.toBeNull();
      expect(tokens!.accent).toBe('#FFD400');
      expect(tokens!.accentText).toBe('#A17C00');
      expect(tokens!.accentBorder).toBe('#B48A00');
      expect(tokens!.accentOnSolid).toBe('#18181B');
    }
  });

  it('keeps #FFD400 luminous on Dark themes with #18181B ink for solid fills', () => {
    for (const theme of ['dark', 'charcoal', 'sepia-dark', 'nord', 'oled'] as const) {
      const tokens = computeAccentTokens('#FFD400', theme);
      expect(tokens).not.toBeNull();
      expect(tokens!.accent).toBe('#FFD400');
      expect(tokens!.accentText).toBe('#FFD400');
      expect(tokens!.accentBorder).toBe('#FFD400');
      expect(tokens!.accentOnSolid).toBe('#18181B');
    }
  });

  it('enforces WCAG text contrast safeguards for arbitrary bright/dark custom colors', () => {
    const paleCyanOnSnow = computeAccentTokens('#00FFFF', 'snow');
    expect(paleCyanOnSnow).not.toBeNull();
    expect(contrastRatio(paleCyanOnSnow!.accentText, '#F8FAFC')).toBeGreaterThanOrEqual(4.5);
    expect(paleCyanOnSnow!.accentOnSolid).toBe('#18181B');

    const deepNavyOnOled = computeAccentTokens('#0A1030', 'oled');
    expect(deepNavyOnOled).not.toBeNull();
    expect(contrastRatio(deepNavyOnOled!.accentText, '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(deepNavyOnOled!.accentOnSolid).toBe('#FFFFFF');
  });

  it('classifies all resolved light and dark themes accurately', () => {
    expect(isDarkTheme('light')).toBe(false);
    expect(isDarkTheme('paper')).toBe(false);
    expect(isDarkTheme('snow')).toBe(false);

    expect(isDarkTheme('dark')).toBe(true);
    expect(isDarkTheme('charcoal')).toBe(true);
    expect(isDarkTheme('sepia-dark')).toBe(true);
    expect(isDarkTheme('nord')).toBe(true);
    expect(isDarkTheme('oled')).toBe(true);
  });
});
