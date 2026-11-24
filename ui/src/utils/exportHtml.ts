import type { ResolvedTheme, TextDirection } from '../bridge/types';
import { computeAccentTokens } from './themeAccent';

const EXPORT_PALETTES: Record<
  ResolvedTheme,
  {
    bg: string;
    surface: string;
    codeBg: string;
    text: string;
    heading: string;
    muted: string;
    border: string;
    accent: string;
  }
> = {
  dark: {
    bg: '#111318',
    surface: '#161921',
    codeBg: '#161922',
    text: '#eceef2',
    heading: '#eceef2',
    muted: '#a1a8b8',
    border: 'rgba(255,255,255,0.1)',
    accent: '#7aa2f7',
  },
  paper: {
    bg: '#f6f0e6',
    surface: '#ede5d8',
    codeBg: '#eee6d8',
    text: '#2c2218',
    heading: '#2c2218',
    muted: '#625343',
    border: 'rgba(44,34,24,0.12)',
    accent: '#a85432',
  },
  light: {
    bg: '#faf9f6',
    surface: '#f3f1ec',
    codeBg: '#f4f1ea',
    text: '#1c1917',
    heading: '#1c1917',
    muted: '#57534e',
    border: 'rgba(28,25,23,0.1)',
    accent: '#3b5bdb',
  },
  snow: {
    bg: '#f8fafc',
    surface: '#f1f5f9',
    codeBg: '#f1f5f9',
    text: '#1e293b',
    heading: '#0f172a',
    muted: '#64748b',
    border: '#cbd5e1',
    accent: '#3b5bdb',
  },
  charcoal: {
    bg: '#1e1e1e',
    surface: '#27272a',
    codeBg: '#242427',
    text: '#e4e4e7',
    heading: '#ffffff',
    muted: '#a1a1aa',
    border: '#3f3f46',
    accent: '#7aa2f7',
  },
  'sepia-dark': {
    bg: '#1f1d1a',
    surface: '#292622',
    codeBg: '#26231f',
    text: '#ebdbb2',
    heading: '#fbf1c7',
    muted: '#a89984',
    border: '#3e3a34',
    accent: '#7aa2f7',
  },
  nord: {
    bg: '#2e3440',
    surface: '#3b4252',
    codeBg: '#343b49',
    text: '#d8dee9',
    heading: '#eceff4',
    muted: '#94a3b8',
    border: '#4c566a',
    accent: '#7aa2f7',
  },
  oled: {
    bg: '#000000',
    surface: '#121212',
    codeBg: '#0c0c0c',
    text: '#d4d4d4',
    heading: '#ffffff',
    muted: '#8e8e93',
    border: '#262626',
    accent: '#7aa2f7',
  },
};

export function buildStandaloneHtml(
  title: string,
  renderedProseHtml: string,
  frontmatter: Record<string, unknown> | null,
  theme: ResolvedTheme,
  dir: TextDirection = 'auto',
  accentColor: string = 'default'
): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const base = EXPORT_PALETTES[theme] ?? EXPORT_PALETTES.light;
  const accentTokens = computeAccentTokens(accentColor, theme);
  const accentText = accentTokens?.accentText ?? base.accent;
  const accentBorder = accentTokens?.accentBorder ?? base.accent;
  const accentSelection = accentTokens?.accentSelection ?? 'rgba(59, 91, 219, 0.2)';

  const fmHtml = frontmatter
    ? `<div class="vellum-frontmatter">${Object.entries(frontmatter)
        .map(
          ([k, v]) =>
            `<span class="vellum-fm-item"><span class="vellum-fm-key">${String(k).replace(/</g, '&lt;')}</span> <span class="vellum-fm-val">${Array.isArray(v) ? v.map(String).join(', ') : String(v)}</span></span>`
        )
        .join('')}</div>`
    : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    ::selection { background: ${accentSelection}; }
    body {
      margin: 0;
      background: ${base.bg};
      color: ${base.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Inter, Tahoma, sans-serif;
      line-height: 1.72;
      font-size: 16px;
    }
    main {
      max-width: 780px;
      margin: 0 auto;
      padding: 48px 32px 84px;
    }
    h1, h2, h3, h4 { color: ${base.heading}; line-height: 1.25; margin-top: 1.75em; margin-bottom: 0.6em; }
    h1, h2 { padding-bottom: 0.3em; border-bottom: 1px solid ${base.border}; }
    a { color: ${accentText}; }
    code { font-family: 'Cascadia Code', Consolas, monospace; font-size: 0.88em; background: ${base.surface}; padding: 0.14em 0.4em; border-radius: 4px; direction: ltr; unicode-bidi: isolate; }
    .vellum-code-block { margin: 1.3em 0; border: 1px solid ${base.border}; border-radius: 8px; background: ${base.codeBg}; overflow: hidden; direction: ltr; text-align: left; }
    .vellum-code-header { padding: 6px 12px; background: ${base.surface}; border-bottom: 1px solid ${base.border}; font-size: 12px; color: ${base.muted}; display: flex; justify-content: space-between; }
    .vellum-copy-btn, .heading-anchor { display: none; }
    pre { margin: 0; padding: 14px 16px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { margin: 1.2em 0; padding-block: 0.2em; padding-inline: 1.1em 0; border-inline-start: 3px solid ${accentBorder}; color: ${base.muted}; }
    .vellum-alert { margin: 1.2em 0; padding: 12px 16px; border-radius: 8px; border: 1px solid ${base.border}; border-inline-start: 3.5px solid ${accentBorder}; background: ${base.surface}; }
    .vellum-alert-title { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 5px; font-size: 0.88em; }
    .vellum-alert-title svg { width: 15px; height: 15px; }
    .vellum-table-wrap { overflow-x: auto; border: 1px solid ${base.border}; border-radius: 8px; margin: 1.3em 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 14px; border-bottom: 1px solid ${base.border}; text-align: start; }
    th { background: ${base.surface}; }
    ul, ol { padding-inline-start: 1.55em; padding-inline-end: 0; }
    .vellum-frontmatter { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 14px; margin-bottom: 24px; border-radius: 8px; background: ${base.surface}; border: 1px solid ${base.border}; font-size: 13px; }
    .vellum-fm-key { color: ${base.muted}; text-transform: uppercase; font-size: 11px; }
    .vellum-mermaid, .vellum-math-block { text-align: center; margin: 1.4em 0; direction: ltr; }
    img { max-width: 100%; border-radius: 8px; }
    hr { border: 0; height: 1px; background: ${base.border}; margin: 2em 0; }
  </style>
</head>
<body>
  <main dir="${dir}">
    ${fmHtml}
    <article class="vellum-prose">${renderedProseHtml}</article>
  </main>
</body>
</html>`;
}
