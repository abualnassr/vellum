export const SHOWCASE_MARKDOWN = `---
title: Welcome to Vellum
subtitle: Editorial Markdown Viewer & Editor for Windows
author: Bandar Abualnassr
version: 1.0.1
tags: [markdown, editorial, showcase]
---

# Welcome to Vellum

**Vellum** is crafted to feel like fine stationery paired with a precision drafting tool. Open any \`.md\` file to read comfortably right away, or switch seamlessly into **Split** (\`Ctrl+2\`) or **Source** (\`Ctrl+3\`) mode to write with zero friction.

> [!TIP]
> Press \`Ctrl+K\` at any time to launch the **Command Palette** — switch across 8 curated themes (**Ivory Light**, **Obsidian Night**, **Warm Paper**, **Snow**, **Charcoal**, **Sepia Dark**, **Nord**, **OLED**) or **System** sync, customize your **Accent Color** in Settings, toggle typography, export to PDF, or jump across headings.

---

## Crafted Typography & GFM Support

Vellum supports full GitHub Flavored Markdown out of the box, including crisp tables, footnotes[^1], smart punctuation, and interactive task lists you can click directly in Reading mode:

- [x] Instant single-file Windows startup with native WebView2 rendering
- [x] 8 curated themes (**Ivory**, **Obsidian**, **Paper**, **Snow**, **Charcoal**, **Sepia Dark**, **Nord**, **OLED**) + custom **Accent Colors**
- [x] Synchronized scroll between Source editor and Reading preview
- [ ] Set Vellum as your default \`.md\` viewer in **Settings (\`Ctrl+,\`)**

| Shortcut | Mode / Action | Scope |
| :--- | :--- | :--- |
| \`Ctrl+1\` / \`2\` / \`3\` | Read / Split / Source | Active Tab |
| \`Ctrl+K\` | Command Palette | Global |
| \`Ctrl+\\\` | Toggle File Tree Sidebar | Workspace |
| \`Ctrl+Shift+O\` | Toggle Table of Contents | Document |
| \`Ctrl+E\` | Export Styled PDF | Document |

---

## GitHub Alerts & Callouts

> [!NOTE]
> Highlights helpful context and subtle details without interrupting the reading flow.

> [!IMPORTANT]
> Crucial architectural notes stay visually distinct while preserving clean proportions.

> [!WARNING]
> Pay attention to external file edits — Vellum watches open documents and alerts you automatically when another tool modifies a file on disk.

> [!CAUTION]
> Closing tabs with unsaved edits prompts cleanly so work is never lost unexpectedly.

---

## Syntax-Highlighted Code

Every fenced code block gets language detection, harmonized token colors, and a one-click copy button:

\`\`\`typescript
interface VellumDocument {
  path: string;
  mode: 'read' | 'split' | 'source';
  wordCount: number;
}

export function estimateReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
\`\`\`

---

## Mathematics with KaTeX

Inline expressions like $E = mc^2$ and $\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$ render smoothly alongside display equations, while currency amounts like \\$49 or \\$100 stay plain text:

$$
\\mathcal{F}(\\omega) = \\int_{-\\infty}^{\\infty} f(t)\\, e^{-i\\omega t}\\, dt
$$

---

## Live Mermaid Diagrams

\`\`\`mermaid
flowchart LR
    A[Open .md File] --> B{Choose Mode}
    B -->|Ctrl+1| C[Editorial Reading]
    B -->|Ctrl+2| D[Synced Split View]
    B -->|Ctrl+3| E[Markdown Source]
    C --> F[Export PDF or HTML]
    D --> F
    E --> F
\`\`\`

---

## دعم اللغة العربية والاتجاه من اليمين إلى اليسار (RTL)

يدعم **Vellum** عرض وتحرير النصوص العربية تلقائياً بالاتجاه الصحيح من اليمين إلى اليسار مع إبقاء الأكواد التقنية مثل \`const rtl = true;\` من اليسار إلى اليمين:

- [x] محاذاة تلقائية للعناوين والفقرات العربية من اليمين إلى اليسار
- [x] دعم التنبيهات والقوائم والجداول العربية بشكل متكامل
- [ ] جرّب التدقيق الإملائي الثنائي اللغة أثناء التحرير

> [!NOTE]
> يمكنك اختيار اتجاه النص (**تلقائي / LTR / RTL**) وعرض البداية الافتراضي من **الإعدادات (\`Ctrl+,\`)**.

---

[^1]: Footnotes automatically gather at the bottom of your document with smooth back-reference links.
`;
