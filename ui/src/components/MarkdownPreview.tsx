import { useEffect, useRef, useState } from 'react';
import type { ReadingFont, ResolvedTheme, TextDirection } from '../bridge/types';
import type { TocItem } from '../markdown/engine';
import { renderMermaidDiagrams } from '../markdown/mermaidRenderer';

interface MarkdownPreviewProps {
  html: string;
  frontmatter: Record<string, unknown> | null;
  documentPath: string | null;
  toc: TocItem[];
  theme: ResolvedTheme;
  readingFont: ReadingFont;
  textDirection: TextDirection;
  findQuery: string;
  activeFindIndex: number;
  onFindCountChange: (count: number) => void;
  onToggleTask: (lineIndex: number, checked: boolean) => void;
  onOpenRelativeFile: (resolvedPath: string) => void;
  onOpenExternalUrl: (url: string) => void;
  onInspectMedia: (media: { kind: 'image' | 'svg'; src: string }) => void;
  onActiveHeadingChange: (id: string | null) => void;
  onPreviewScroll?: (scrollTop: number, container: HTMLElement) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function resolveDocLink(docPath: string, href: string): string {
  const cleanHref = href.split('#')[0].split('?')[0];
  const sep = docPath.includes('\\') ? '\\' : '/';
  const parts = docPath.split(/[\\/]/);
  parts.pop();
  for (const seg of decodeURIComponent(cleanHref).split(/[\\/]/)) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 1 || (parts.length === 1 && !parts[0].endsWith(':'))) {
        parts.pop();
      }
    } else {
      parts.push(seg);
    }
  }
  return parts.join(sep);
}

function clearFindMarks(root: HTMLElement) {
  const marks = root.querySelectorAll('mark.vellum-find-match');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });
}

function applyFindMarks(root: HTMLElement, query: string): HTMLElement[] {
  clearFindMarks(root);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lowerQ = trimmed.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (
        parent.closest(
          '.katex, .vellum-mermaid, .vellum-copy-btn, .heading-anchor, script, style'
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return (node.nodeValue ?? '').toLowerCase().includes(lowerQ)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  const created: HTMLElement[] = [];
  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    const lower = text.toLowerCase();
    let idx = 0;
    let pos = lower.indexOf(lowerQ, idx);
    if (pos === -1) continue;

    const frag = document.createDocumentFragment();
    while (pos !== -1) {
      if (pos > idx) {
        frag.appendChild(document.createTextNode(text.slice(idx, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'vellum-find-match';
      mark.textContent = text.slice(pos, pos + trimmed.length);
      frag.appendChild(mark);
      created.push(mark);
      idx = pos + trimmed.length;
      pos = lower.indexOf(lowerQ, idx);
    }
    if (idx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(idx)));
    }
    node.parentNode?.replaceChild(frag, node);
  }
  return created;
}

export function MarkdownPreview({
  html,
  frontmatter,
  documentPath,
  toc,
  theme,
  readingFont,
  textDirection,
  findQuery,
  activeFindIndex,
  onFindCountChange,
  onToggleTask,
  onOpenRelativeFile,
  onOpenExternalUrl,
  onInspectMedia,
  onActiveHeadingChange,
  onPreviewScroll,
  scrollContainerRef,
}: MarkdownPreviewProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const marksRef = useRef<HTMLElement[]>([]);

  // Update article DOM cleanly and hydrate Mermaid diagrams
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const signal = { cancelled: false };
    article.innerHTML = html;

    if (findQuery.trim()) {
      const marks = applyFindMarks(article, findQuery);
      marksRef.current = marks;
      onFindCountChange(marks.length);
    } else {
      marksRef.current = [];
      onFindCountChange(0);
    }

    void renderMermaidDiagrams(article, theme, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [html, theme]);

  // Apply or update Find highlights without disturbing Mermaid SVGs
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const marks = applyFindMarks(article, findQuery);
    marksRef.current = marks;
    onFindCountChange(marks.length);
  }, [findQuery]);

  // Highlight active match and scroll it into view
  useEffect(() => {
    const marks = marksRef.current;
    marks.forEach((m) => m.classList.remove('active'));
    if (marks.length === 0) return;
    const wrappedIdx = ((activeFindIndex % marks.length) + marks.length) % marks.length;
    const active = marks[wrappedIdx];
    active.classList.add('active');
    active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeFindIndex, findQuery, html]);

  // Click delegation for checkboxes, copy-code, links, and media zoom
  const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    const copyBtn = target.closest<HTMLButtonElement>('.vellum-copy-btn');
    if (copyBtn) {
      const encoded = copyBtn.getAttribute('data-copy-code') ?? '';
      try {
        const text = decodeURIComponent(encoded);
        void navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        window.setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1600);
      } catch {
        // ignore clipboard error
      }
      return;
    }

    const checkbox = target.closest<HTMLInputElement>('input.task-list-item-checkbox');
    if (checkbox) {
      const lineAttr = checkbox.getAttribute('data-task-line');
      if (lineAttr !== null) {
        const lineNum = Number(lineAttr);
        if (!Number.isNaN(lineNum)) {
          onToggleTask(lineNum, checkbox.checked);
        }
      }
      return;
    }

    const anchor = target.closest<HTMLAnchorElement>('a');
    if (anchor) {
      const href = anchor.getAttribute('href') ?? '';
      if (!href) return;
      e.preventDefault();

      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        const targetEl = articleRef.current?.querySelector<HTMLElement>(
          `[id="${CSS.escape(id)}"]`
        );
        targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (/^(?:https?|mailto):/i.test(href)) {
        onOpenExternalUrl(href);
        return;
      }

      if (documentPath && /\.(md|markdown|mdown|mkd|mdx|txt)(?:[?#].*)?$/i.test(href)) {
        onOpenRelativeFile(resolveDocLink(documentPath, href));
        return;
      }
      return;
    }

    const img = target.closest<HTMLImageElement>('img');
    if (img && img.src) {
      onInspectMedia({ kind: 'image', src: img.src });
      return;
    }

    const mermaidWrap = target.closest<HTMLElement>('.vellum-mermaid');
    if (mermaidWrap) {
      const svg = mermaidWrap.querySelector('svg');
      if (svg) {
        onInspectMedia({ kind: 'svg', src: svg.outerHTML });
      }
    }
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    setProgress(maxScroll > 0 ? Math.min(100, (el.scrollTop / maxScroll) * 100) : 0);

    if (toc.length > 0 && articleRef.current) {
      const containerTop = el.getBoundingClientRect().top;
      let currentId: string | null = toc[0].id;
      for (const item of toc) {
        const headingEl = articleRef.current.querySelector<HTMLElement>(
          `[id="${CSS.escape(item.id)}"]`
        );
        if (!headingEl) continue;
        const offset = headingEl.getBoundingClientRect().top - containerTop;
        if (offset <= 64) {
          currentId = item.id;
        } else {
          break;
        }
      }
      onActiveHeadingChange(currentId);
    }

    onPreviewScroll?.(el.scrollTop, el);
  };

  return (
    <div className="preview-pane">
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <div
        className="preview-scroll"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div
          className={`vellum-prose-shell ${readingFont === 'serif' ? 'font-serif' : ''} ${
            textDirection === 'rtl' ? 'dir-rtl' : textDirection === 'ltr' ? 'dir-ltr' : ''
          }`}
        >
          {frontmatter && Object.keys(frontmatter).length > 0 && (
            <div className="vellum-frontmatter" dir={textDirection === 'auto' ? 'auto' : textDirection}>
              {Object.entries(frontmatter).map(([key, value]) => (
                <div key={key} className="vellum-fm-item">
                  <span className="vellum-fm-key">{key}</span>
                  {Array.isArray(value) ? (
                    <span className="vellum-fm-tags">
                      {value.map((tag, i) => (
                        <span key={i} className="vellum-fm-tag">
                          {String(tag)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="vellum-fm-val">{String(value)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <article
            ref={articleRef}
            className="vellum-prose"
            onClick={handleArticleClick}
          />
        </div>
      </div>
    </div>
  );
}
