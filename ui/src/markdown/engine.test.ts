// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  detectDocumentDirection,
  renderMarkdownDocument,
  toggleTaskAtLine,
} from './engine';

describe('Vellum Markdown Engine', () => {
  it('extracts YAML frontmatter and shifts source line numbers accurately', () => {
    const md = [
      '---',
      'title: Spec',
      'author: Ada',
      '---',
      '',
      '# Heading One',
      '',
      'Body text.',
    ].join('\n');

    const res = renderMarkdownDocument(md);
    expect(res.frontmatter).toEqual({ title: 'Spec', author: 'Ada' });
    expect(res.toc).toHaveLength(1);
    expect(res.toc[0]).toEqual({
      level: 1,
      text: 'Heading One',
      id: 'heading-one',
      line: 5,
    });
    expect(res.html).toContain('data-source-line="5"');
  });

  it('renders GitHub alerts for all five severities', () => {
    const md = [
      '> [!NOTE]',
      '> Helpful context.',
      '',
      '> [!TIP]',
      '> Handy shortcut.',
      '',
      '> [!IMPORTANT]',
      '> Key requirement.',
      '',
      '> [!WARNING]',
      '> Watch out.',
      '',
      '> [!CAUTION]',
      '> Destructive action.',
    ].join('\n');

    const { html } = renderMarkdownDocument(md);
    expect(html).toContain('vellum-alert-note');
    expect(html).toContain('vellum-alert-tip');
    expect(html).toContain('vellum-alert-important');
    expect(html).toContain('vellum-alert-warning');
    expect(html).toContain('vellum-alert-caution');
    expect(html).not.toContain('[!NOTE]');
    expect(html).not.toContain('[!CAUTION]');
  });

  it('renders KaTeX math while leaving currency dollar signs untouched', () => {
    const md = `Total cost is $49 and $100 today, while energy is $E = mc^2$.\n\n$$\nx^2 + y^2 = z^2\n$$\n`;
    const { html } = renderMarkdownDocument(md);
    expect(html).toContain('$49');
    expect(html).toContain('$100');
    expect(html).toContain('class="katex"');
    expect(html).toContain('vellum-math-block');
  });

  it('emits mermaid containers and syntax-highlighted code cards', () => {
    const md = '```ts\nconst x: number = 42;\n```\n\n```mermaid\ngraph LR; A-->B;\n```';
    const { html } = renderMarkdownDocument(md);
    expect(html).toContain('vellum-code-block');
    expect(html).toContain('vellum-copy-btn');
    expect(html).toContain('vellum-mermaid');
    expect(html).toContain('data-mermaid=');
  });

  it('rewrites relative image paths to vellum.local while keeping remote URLs intact', () => {
    const md = '![local](./img/diagram.png)\n![remote](https://example.com/a.png)';
    const { html } = renderMarkdownDocument(md, 'D:\\Docs\\guide.md');
    expect(html).toContain('https://vellum.local/file?path=D%3A%5CDocs%5Cimg%5Cdiagram.png');
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it('supports toggling task list items on the exact source line', () => {
    const md = '- [ ] First\n- [x] Second\n';
    const { html } = renderMarkdownDocument(md);
    expect(html).toContain('data-task-line="0"');
    expect(html).toContain('data-task-line="1"');

    const toggled = toggleTaskAtLine(md, 0, true);
    expect(toggled).toBe('- [x] First\n- [x] Second\n');
    expect(toggleTaskAtLine(toggled, 1, false)).toBe('- [x] First\n- [ ] Second\n');
  });

  it('strips XSS payloads via DOMPurify', () => {
    const md =
      '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">bad</a>\n\n[md-xss](javascript:alert(4))';
    const { html } = renderMarkdownDocument(md);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('href="javascript:');
  });

  it('emits BiDi dir="auto" on Arabic blocks while keeping code/math LTR', () => {
    const md = [
      '# مرحبا بالعالم',
      '',
      'هذه فقرة عربية مع `code` داخل النص.',
      '',
      '- [x] مهمة عربية',
      '',
      '> [!NOTE]',
      '> ملاحظة عربية مهمة',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '$$',
      'a + b = c',
      '$$',
    ].join('\n');

    const res = renderMarkdownDocument(md);
    expect(res.detectedDirection).toBe('rtl');
    expect(detectDocumentDirection('Hello world')).toBe('ltr');
    expect(res.html).toContain('<h1 data-source-line="0" dir="auto" id=');
    expect(res.html).toContain('<p data-source-line="2" dir="auto">');
    expect(res.html).toContain('class="vellum-alert vellum-alert-note" dir="rtl"');
    expect(res.html).toContain('class="vellum-code-block" dir="ltr"');
    expect(res.html).toContain('class="vellum-math-block" dir="ltr"');

    const forced = renderMarkdownDocument('# English', null, 'rtl');
    expect(forced.html).toContain('dir="rtl"');
  });
});
