import type { ResolvedTheme, TextDirection } from '../bridge/types';

export function buildStandaloneHtml(
  title: string,
  renderedProseHtml: string,
  frontmatter: Record<string, unknown> | null,
  theme: ResolvedTheme,
  dir: TextDirection = 'auto'
): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const palette =
    theme === 'dark'
      ? {
          bg: '#111318',
          surface: '#161921',
          codeBg: '#161922',
          text: '#eceef2',
          muted: '#a1a8b8',
          border: 'rgba(255,255,255,0.1)',
          accent: '#7aa2f7',
        }
      : theme === 'paper'
      ? {
          bg: '#f6f0e6',
          surface: '#ede5d8',
          codeBg: '#eee6d8',
          text: '#2c2218',
          muted: '#625343',
          border: 'rgba(44,34,24,0.12)',
          accent: '#a85432',
        }
      : {
          bg: '#faf9f6',
          surface: '#f3f1ec',
          codeBg: '#f4f1ea',
          text: '#1c1917',
          muted: '#57534e',
          border: 'rgba(28,25,23,0.1)',
          accent: '#3b5bdb',
        };

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
    body {
      margin: 0;
      background: ${palette.bg};
      color: ${palette.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Inter, Tahoma, sans-serif;
      line-height: 1.72;
      font-size: 16px;
    }
    main {
      max-width: 780px;
      margin: 0 auto;
      padding: 48px 32px 84px;
    }
    h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.75em; margin-bottom: 0.6em; }
    h1, h2 { padding-bottom: 0.3em; border-bottom: 1px solid ${palette.border}; }
    a { color: ${palette.accent}; }
    code { font-family: 'Cascadia Code', Consolas, monospace; font-size: 0.88em; background: ${palette.surface}; padding: 0.14em 0.4em; border-radius: 4px; direction: ltr; unicode-bidi: isolate; }
    .vellum-code-block { margin: 1.3em 0; border: 1px solid ${palette.border}; border-radius: 8px; background: ${palette.codeBg}; overflow: hidden; direction: ltr; text-align: left; }
    .vellum-code-header { padding: 6px 12px; background: ${palette.surface}; border-bottom: 1px solid ${palette.border}; font-size: 12px; color: ${palette.muted}; display: flex; justify-content: space-between; }
    .vellum-copy-btn, .heading-anchor { display: none; }
    pre { margin: 0; padding: 14px 16px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { margin: 1.2em 0; padding-block: 0.2em; padding-inline: 1.1em 0; border-inline-start: 3px solid ${palette.accent}; color: ${palette.muted}; }
    .vellum-alert { margin: 1.2em 0; padding: 12px 16px; border-radius: 8px; border: 1px solid ${palette.border}; border-inline-start: 3.5px solid ${palette.accent}; background: ${palette.surface}; }
    .vellum-alert-title { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 5px; font-size: 0.88em; }
    .vellum-alert-title svg { width: 15px; height: 15px; }
    .vellum-table-wrap { overflow-x: auto; border: 1px solid ${palette.border}; border-radius: 8px; margin: 1.3em 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 14px; border-bottom: 1px solid ${palette.border}; text-align: start; }
    th { background: ${palette.surface}; }
    ul, ol { padding-inline-start: 1.55em; padding-inline-end: 0; }
    .vellum-frontmatter { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 14px; margin-bottom: 24px; border-radius: 8px; background: ${palette.surface}; border: 1px solid ${palette.border}; font-size: 13px; }
    .vellum-fm-key { color: ${palette.muted}; text-transform: uppercase; font-size: 11px; }
    .vellum-mermaid, .vellum-math-block { text-align: center; margin: 1.4em 0; direction: ltr; }
    img { max-width: 100%; border-radius: 8px; }
    hr { border: 0; height: 1px; background: ${palette.border}; margin: 2em 0; }
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
