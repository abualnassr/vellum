import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

export type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const ALERT_META: Record<AlertKind, { label: string; svgPath: string }> = {
  note: {
    label: 'Note',
    svgPath:
      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  },
  tip: {
    label: 'Tip',
    svgPath:
      '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  },
  important: {
    label: 'Important',
    svgPath:
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 15h.01"/>',
  },
  warning: {
    label: 'Warning',
    svgPath:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  },
  caution: {
    label: 'Caution',
    svgPath:
      '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  },
};

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\r?\n|$)/i;
const RTL_RE = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_RE = /[A-Za-z]/;

function detectAlertDirection(text: string): 'rtl' | 'ltr' {
  for (const ch of text) {
    if (RTL_RE.test(ch)) return 'rtl';
    if (LATIN_RE.test(ch)) return 'ltr';
  }
  return 'ltr';
}

function findMatchingClose(tokens: Token[], openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < tokens.length; i++) {
    if (tokens[i].type === 'blockquote_open') depth++;
    if (tokens[i].type === 'blockquote_close') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function alertsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('block', 'vellum_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      if (i + 2 >= tokens.length) continue;
      if (tokens[i + 1].type !== 'paragraph_open') continue;
      const inline = tokens[i + 2];
      if (inline.type !== 'inline') continue;

      const match = MARKER_RE.exec(inline.content);
      if (!match) continue;

      const kind = match[1].toLowerCase() as AlertKind;
      const closeIdx = findMatchingClose(tokens, i);
      if (closeIdx === -1) continue;

      // Strip the [!KIND] marker from the first paragraph inline token & its children
      inline.content = inline.content.slice(match[0].length);
      const autoDir = detectAlertDirection(inline.content);

      tokens[i].type = 'vellum_alert_open';
      tokens[i].tag = 'div';
      tokens[i].meta = { kind, autoDir };

      tokens[closeIdx].type = 'vellum_alert_close';
      tokens[closeIdx].tag = 'div';
      if (inline.children && inline.children.length > 0) {
        const first = inline.children[0];
        if (first.type === 'text') {
          first.content = first.content.replace(
            /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
            ''
          );
          if (
            first.content === '' &&
            inline.children.length > 1 &&
            (inline.children[1].type === 'softbreak' || inline.children[1].type === 'hardbreak')
          ) {
            inline.children.splice(0, 2);
          } else if (first.content === '') {
            inline.children.shift();
          }
        }
      }
    }
  });

  md.renderer.rules.vellum_alert_open = (tokens, idx, _options, env) => {
    const kind = (tokens[idx].meta?.kind ?? 'note') as AlertKind;
    const autoDir = (tokens[idx].meta?.autoDir ?? 'ltr') as 'rtl' | 'ltr';
    const meta = ALERT_META[kind];
    const lineOffset = typeof env?.lineOffset === 'number' ? env.lineOffset : 0;
    const dirMode = typeof env?.dirMode === 'string' ? env.dirMode : 'auto';
    const effectiveDir = dirMode === 'auto' ? autoDir : dirMode;
    const map = tokens[idx].map;
    const lineAttr = map ? ` data-source-line="${map[0] + lineOffset}"` : '';
    return `<div class="vellum-alert vellum-alert-${kind}" dir="${effectiveDir}"${lineAttr}><div class="vellum-alert-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${meta.svgPath}</svg><span>${meta.label}</span></div><div class="vellum-alert-body">\n`;
  };

  md.renderer.rules.vellum_alert_close = () => `</div></div>\n`;
}
