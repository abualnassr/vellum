import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js/lib/common';
import powershell from 'highlight.js/lib/languages/powershell';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import DOMPurify from 'dompurify';
import { extractFrontmatter } from './frontmatter';
import { mathPlugin } from './mathPlugin';
import { alertsPlugin } from './alertsPlugin';

hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('dockerfile', dockerfile);

export interface TocItem {
  level: number;
  text: string;
  id: string;
  line: number;
}

export interface RenderedDocument {
  html: string;
  toc: TocItem[];
  frontmatter: Record<string, unknown> | null;
  wordCount: number;
  readingMinutes: number;
  detectedDirection: 'rtl' | 'ltr';
}

interface RenderEnv {
  lineOffset: number;
  documentPath: string | null;
  dirMode: 'auto' | 'ltr' | 'rtl';
  slugCounts: Map<string, number>;
  toc: TocItem[];
}

const RTL_CHAR_RE = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_CHAR_RE = /[A-Za-z]/g;

export function detectDocumentDirection(text: string): 'rtl' | 'ltr' {
  const proseOnly = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\r\n]*`/g, ' ');
  const rtlMatches = proseOnly.match(RTL_CHAR_RE)?.length ?? 0;
  const latinMatches = proseOnly.match(LATIN_CHAR_RE)?.length ?? 0;
  return rtlMatches > latinMatches && rtlMatches >= 3 ? 'rtl' : 'ltr';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'section';
}

function resolveRelativePath(docPath: string, relativeRef: string): string | null {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(relativeRef)) {
    return null;
  }
  const cleanRef = relativeRef.split('#')[0].split('?')[0];
  if (!cleanRef) return null;

  const isBackslash = docPath.includes('\\');
  const sep = isBackslash ? '\\' : '/';
  const dirParts = docPath.split(/[\\/]/);
  dirParts.pop();

  const relParts = decodeURIComponent(cleanRef).split(/[\\/]/);
  for (const part of relParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (dirParts.length > 1 || (dirParts.length === 1 && !dirParts[0].endsWith(':'))) {
        dirParts.pop();
      }
    } else {
      dirParts.push(part);
    }
  }
  return dirParts.join(sep);
}

function createMarkdownInstance(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
  });

  md.use(taskLists, { enabled: true, label: false, labelAfter: false });
  md.use(footnote);
  md.use(mathPlugin);
  md.use(alertsPlugin);

  // Inject data-source-line on block tokens + attach data-task-line on task checkboxes
  md.core.ruler.push('vellum_source_lines', (state) => {
    const env = (state.env ?? {}) as RenderEnv;
    const offset = env.lineOffset ?? 0;

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.map && token.nesting >= 0) {
        const line = token.map[0] + offset;
        token.attrSet('data-source-line', String(line));
      }

      if (
        token.type === 'paragraph_open' ||
        token.type === 'heading_open' ||
        token.type === 'bullet_list_open' ||
        token.type === 'ordered_list_open' ||
        token.type === 'list_item_open' ||
        token.type === 'blockquote_open' ||
        token.type === 'table_open' ||
        token.type === 'th_open' ||
        token.type === 'td_open'
      ) {
        token.attrSet('dir', env.dirMode ?? 'auto');
      }

      if (token.type === 'list_item_open' && token.map) {
        const itemLine = token.map[0] + offset;
        // Scan forward inside list item inline children for task-list checkbox html_inline
        for (let j = i + 1; j < state.tokens.length; j++) {
          const inner = state.tokens[j];
          if (inner.type === 'list_item_close' && inner.level === token.level) break;
          if (inner.type === 'inline' && inner.children) {
            for (const child of inner.children) {
              if (
                child.type === 'html_inline' &&
                child.content.includes('task-list-item-checkbox')
              ) {
                child.content = child.content.replace(
                  '<input ',
                  `<input data-task-line="${itemLine}" `
                );
              }
            }
          }
        }
      }
    }
  });

  // Deterministic GitHub-style heading IDs + TOC extraction + hover anchor link
  const defaultHeadingOpen =
    md.renderer.rules.heading_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const renderEnv = env as RenderEnv;
    const token = tokens[idx];
    const inlineToken = tokens[idx + 1];
    const text = inlineToken?.children
      ? inlineToken.children.map((c) => c.content).join('')
      : inlineToken?.content ?? '';

    const baseSlug = slugify(text);
    const count = renderEnv.slugCounts.get(baseSlug) ?? 0;
    renderEnv.slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

    token.attrSet('id', id);
    const level = Number(token.tag.slice(1));
    const line = Number(token.attrGet('data-source-line') ?? 0);
    renderEnv.toc.push({ level, text: text.trim(), id, line });

    const rendered = defaultHeadingOpen(tokens, idx, options, env, self);
    return `${rendered}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-hidden="true">#</a>`;
  };

  // Wrap tables for clean responsive scroll
  const defaultTableOpen =
    md.renderer.rules.table_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  const defaultTableClose =
    md.renderer.rules.table_close ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    const line = tokens[idx].attrGet('data-source-line');
    const lineAttr = line ? ` data-source-line="${escapeHtml(line)}"` : '';
    return `<div class="vellum-table-wrap"${lineAttr}>${defaultTableOpen(tokens, idx, options, env, self)}`;
  };
  md.renderer.rules.table_close = (tokens, idx, options, env, self) =>
    `${defaultTableClose(tokens, idx, options, env, self)}</div>`;

  // Rewrite relative image paths to https://vellum.local/file?path=...
  const defaultImage =
    md.renderer.rules.image ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const renderEnv = env as RenderEnv;
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (src && renderEnv.documentPath) {
      const resolved = resolveRelativePath(renderEnv.documentPath, src);
      if (resolved) {
        token.attrSet(
          'src',
          `https://vellum.local/file?path=${encodeURIComponent(resolved)}`
        );
      }
    }
    return defaultImage(tokens, idx, options, env, self);
  };

  // Fenced code blocks: Mermaid placeholder or syntax-highlighted card
  md.renderer.rules.fence = (tokens, idx, _options, env) => {
    const token = tokens[idx];
    const info = token.info.trim();
    const lang = info.split(/\s+/)[0]?.toLowerCase() ?? '';
    const offset = (env as RenderEnv)?.lineOffset ?? 0;
    const lineAttr = token.map ? ` data-source-line="${token.map[0] + offset}"` : '';

    if (lang === 'mermaid') {
      const encoded = encodeURIComponent(token.content);
      return `<div class="vellum-mermaid" dir="ltr" data-mermaid="${encoded}"${lineAttr}><span class="vellum-mermaid-loading">Rendering diagram…</span></div>\n`;
    }

    let highlighted: string;
    let displayLang = lang || 'text';
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value;
    } else if (token.content.trim().length > 0 && !lang) {
      const auto = hljs.highlightAuto(token.content);
      highlighted = auto.value;
      displayLang = auto.language || 'text';
    } else {
      highlighted = escapeHtml(token.content);
    }

    const encodedRaw = encodeURIComponent(token.content);
    return (
      `<div class="vellum-code-block" dir="ltr"${lineAttr}>` +
      `<div class="vellum-code-header">` +
      `<span class="vellum-code-lang">${escapeHtml(displayLang)}</span>` +
      `<button type="button" class="vellum-copy-btn" data-copy-code="${encodedRaw}">Copy</button>` +
      `</div>` +
      `<pre><code class="hljs">${highlighted}</code></pre>` +
      `</div>\n`
    );
  };

  return md;
}

const mdEngine = createMarkdownInstance();

function sanitizeHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_TAGS: ['input', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'mspace', 'mover', 'munder', 'mtable', 'mtr', 'mtd'],
    ADD_ATTR: [
      'type',
      'checked',
      'disabled',
      'dir',
      'data-source-line',
      'data-task-line',
      'data-mermaid',
      'data-copy-code',
      'aria-hidden',
      'target',
      'rel',
      'xmlns',
      'encoding',
      'mathvariant',
      'display',
    ],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
  });
}

export function renderMarkdownDocument(
  rawMarkdown: string,
  documentPath: string | null = null,
  dirMode: 'auto' | 'ltr' | 'rtl' = 'auto'
): RenderedDocument {
  const { attributes, body, lineOffset } = extractFrontmatter(rawMarkdown);
  const env: RenderEnv = {
    lineOffset,
    documentPath,
    dirMode,
    slugCounts: new Map<string, number>(),
    toc: [],
  };

  const rawHtml = mdEngine.render(body, env);
  const html = sanitizeHtml(rawHtml);

  const plainWords = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_\-[\]()!]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const readingMinutes = plainWords === 0 ? 0 : Math.max(1, Math.ceil(plainWords / 220));
  const detectedDirection = detectDocumentDirection(body);

  return {
    html,
    toc: env.toc,
    frontmatter: attributes,
    wordCount: plainWords,
    readingMinutes,
    detectedDirection,
  };
}

export function toggleTaskAtLine(markdown: string, lineIndex: number, checked: boolean): string {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return markdown;

  const line = lines[lineIndex];
  const updated = line.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/,
    `$1${checked ? 'x' : ' '}$3`
  );
  if (updated === line) return markdown;

  lines[lineIndex] = updated;
  return lines.join(eol);
}
