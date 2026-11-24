import type { ResolvedTheme } from '../bridge/types';

let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null;
const svgCache = new Map<string, string>();
let renderCounter = 0;

function getMermaidThemeConfig(theme: ResolvedTheme) {
  switch (theme) {
    case 'dark':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#1c202a',
          primaryColor: '#252b3b',
          primaryTextColor: '#eceef2',
          primaryBorderColor: '#7aa2f7',
          lineColor: '#7aa2f7',
          secondaryColor: '#1d222e',
          tertiaryColor: '#161921',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'charcoal':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#27272a',
          primaryColor: '#323236',
          primaryTextColor: '#e4e4e7',
          primaryBorderColor: '#7aa2f7',
          lineColor: '#7aa2f7',
          secondaryColor: '#242427',
          tertiaryColor: '#1e1e1e',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'sepia-dark':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#292622',
          primaryColor: '#36312b',
          primaryTextColor: '#ebdbb2',
          primaryBorderColor: '#7aa2f7',
          lineColor: '#7aa2f7',
          secondaryColor: '#26231f',
          tertiaryColor: '#1f1d1a',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'nord':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#3b4252',
          primaryColor: '#434c5e',
          primaryTextColor: '#d8dee9',
          primaryBorderColor: '#7aa2f7',
          lineColor: '#88c0d0',
          secondaryColor: '#343b49',
          tertiaryColor: '#2e3440',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'oled':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#121212',
          primaryColor: '#1c1c1c',
          primaryTextColor: '#d4d4d4',
          primaryBorderColor: '#7aa2f7',
          lineColor: '#7aa2f7',
          secondaryColor: '#0c0c0c',
          tertiaryColor: '#000000',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'paper':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#fbf7f0',
          primaryColor: '#efe6d6',
          primaryTextColor: '#2c2218',
          primaryBorderColor: '#a85432',
          lineColor: '#8f4324',
          secondaryColor: '#f6f0e6',
          tertiaryColor: '#e6dccb',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'snow':
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#e2e8f0',
          primaryTextColor: '#1e293b',
          primaryBorderColor: '#3b5bdb',
          lineColor: '#3b5bdb',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#e2e8f0',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
    case 'light':
    default:
      return {
        theme: 'base' as const,
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#edf1fd',
          primaryTextColor: '#1c1917',
          primaryBorderColor: '#3b5bdb',
          lineColor: '#3b5bdb',
          secondaryColor: '#f3f1ec',
          tertiaryColor: '#edeae2',
          fontFamily: 'Inter, Segoe UI, sans-serif',
        },
      };
  }
}

export async function renderMermaidDiagrams(
  container: HTMLElement,
  theme: ResolvedTheme,
  signal?: { cancelled: boolean }
): Promise<void> {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.vellum-mermaid[data-mermaid]'));
  if (nodes.length === 0) return;

  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid');
  }
  const { default: mermaid } = await mermaidModulePromise;
  if (signal?.cancelled) return;

  const cfg = getMermaidThemeConfig(theme);
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    ...cfg,
  });

  for (const node of nodes) {
    if (signal?.cancelled) return;
    const encoded = node.getAttribute('data-mermaid');
    if (!encoded) continue;

    let code = '';
    try {
      code = decodeURIComponent(encoded);
    } catch {
      continue;
    }

    const cacheKey = `${theme}::${code}`;
    const cached = svgCache.get(cacheKey);
    if (cached) {
      node.innerHTML = cached;
      continue;
    }

    try {
      const id = `vellum_mmd_${++renderCounter}`;
      const { svg } = await mermaid.render(id, code);
      if (signal?.cancelled) return;
      svgCache.set(cacheKey, svg);
      node.innerHTML = svg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      node.innerHTML = `<div class="vellum-mermaid-error">Mermaid diagram error:\n${msg.replace(/</g, '&lt;')}</div>`;
    }
  }
}
