# Vellum

> A fast, lightweight, editorial-grade Markdown viewer and editor for Windows.

Vellum opens instantaneously in a refined reading view and lets you switch effortlessly between **Read**, **Split**, and **Source** modes. Built with **.NET 8 (WPF) + Edge WebView2 + TypeScript**, it avoids bundling Chromium, resulting in a tiny single-file executable with native Windows integration.

---

## Features

- **Editorial Reading Experience** — Crafted typography powered by *Inter*, *Newsreader*, and *JetBrains Mono* across three curated themes: **Ivory Light**, **Obsidian Night**, and **Warm Paper**.
- **Three Modes (`Ctrl+1` / `2` / `3`)** — Clean Reading mode, synchronized Split preview, and distraction-free CodeMirror 6 Markdown Source editor.
- **Rich Markdown Support** — GitHub Flavored Markdown tables, interactive clickable task lists, footnotes, YAML frontmatter bar, all 5 GitHub Alerts (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`), syntax-highlighted code blocks with copy button, inline & display **KaTeX** math, and **Mermaid** diagrams.
- **Workspace & Navigation** — Multi-tab strip, collapsible file tree sidebar, live scroll-spy Table of Contents outline, in-page Find & Replace, and a `Ctrl+K` Command Palette.
- **Native Windows Integration** — Frameless Aero Snap window, single-instance multi-tab launching, drag-and-drop file opening, automatic live reload on external edits, and one-click `.md` file association (no admin rights required).
- **Export Anywhere** — Styled PDF export (`Ctrl+E`) preserving vector diagrams and equations, plus standalone self-contained HTML export.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Switch to Read / Split / Source mode |
| `Ctrl+K` | Open Command Palette |
| `Ctrl+O` / `Ctrl+N` | Open File / New Document |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save As |
| `Ctrl+W` / `Ctrl+Tab` | Close Tab / Next Tab |
| `Ctrl+F` / `Ctrl+H` | Find / Replace |
| `Ctrl+\` / `Ctrl+Shift+O` | Toggle File Sidebar / Outline |
| `Ctrl+E` | Export to PDF |
| `Ctrl+,` | Open Settings |

---

## Building from Source

### Prerequisites

- **Windows 10 / 11** (with Edge WebView2 Runtime — pre-installed on Windows 11 and modern Windows 10)
- **Node.js 20+**
- **.NET 8 SDK**

### Build Single-File Executable

```powershell
# 1. Install frontend packages
cd ui
npm install
cd ..

# 2. Generate icon, build UI, and publish lightweight single-file dist\Vellum.exe
.\scripts\build.ps1
```

To build a fully self-contained executable that requires no `.NET 8 Desktop Runtime` on the target machine:

```powershell
.\scripts\build.ps1 -SelfContained
```

### Run Tests

```powershell
# Frontend unit tests & typecheck
cd ui
npm run typecheck
npm test
cd ..

# Backend C# unit tests
dotnet test tests/Vellum.Tests/Vellum.Tests.csproj
```

---

## Setting as Default `.md` Viewer

Open **Settings (`Ctrl+,`) -> Windows Integration -> Register Vellum for .md Files**, then click **Open Windows Default Apps** and choose **Vellum** for `.md`.

---

## License

[MIT](LICENSE)
