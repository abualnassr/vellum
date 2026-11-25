import type {
  AppSettings,
  AssocStatus,
  BridgeEvent,
  DirectoryNode,
  FileDocument,
  SpellIssue,
} from './types';
import { SHOWCASE_MARKDOWN } from './welcomeDoc';

interface WebView2Bridge {
  postMessage: (message: unknown) => void;
  postMessageWithAdditionalObjects?: (message: unknown, additionalObjects: unknown[]) => void;
  addEventListener: (type: string, listener: (ev: MessageEvent) => void) => void;
  removeEventListener: (type: string, listener: (ev: MessageEvent) => void) => void;
}

declare global {
  interface Window {
    chrome?: {
      webview?: WebView2Bridge;
    };
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentColor: 'default',
  readingFont: 'sans',
  readingFontSize: 16,
  editorFontSize: 14,
  readingWidth: 'comfortable',
  defaultViewMode: 'read',
  startupView: 'welcome',
  startupSidebar: false,
  startupOutline: false,
  textDirection: 'auto',
  spellCheck: true,
  spellCheckLanguage: 'auto',
  wordWrap: true,
  lineNumbers: true,
  syncScroll: true,
  autoSave: false,
  zoom: 1,
  splitRatio: 0.5,
  recentFiles: [],
  lastOpenedFolder: null,
  lastSessionFiles: [],
  lastSessionActivePath: null,
};

interface RpcResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

const pending = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();
const eventListeners = new Set<(event: BridgeEvent) => void>();
let initialized = false;
let reqCounter = 0;

function ensureListener() {
  if (initialized) return;
  initialized = true;
  const webview = window.chrome?.webview;
  if (!webview) return;

  webview.addEventListener('message', (ev: MessageEvent) => {
    const raw = typeof ev.data === 'string' ? safeParse(ev.data) : ev.data;
    if (!raw || typeof raw !== 'object') return;
    const msg = raw as Record<string, unknown>;

    if (typeof msg.id === 'string' && pending.has(msg.id)) {
      const entry = pending.get(msg.id)!;
      pending.delete(msg.id);
      const res = msg as unknown as RpcResponse;
      if (res.ok) {
        entry.resolve(res.result);
      } else {
        entry.reject(new Error(res.error || 'Unknown native bridge error'));
      }
      return;
    }

    if (typeof msg.event === 'string') {
      const evt = msg as unknown as BridgeEvent;
      for (const listener of eventListeners) {
        listener(evt);
      }
    }
  });
}

function safeParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function isNativeHost(): boolean {
  return Boolean(window.chrome?.webview);
}

export function onBridgeEvent(listener: (event: BridgeEvent) => void): () => void {
  ensureListener();
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

// Browser preview in-memory fallback when running outside WebView2
const MOCK_STORAGE_KEY = 'vellum-preview-settings';
const mockFiles = new Map<string, FileDocument>([
  [
    'C:\\Users\\Demo\\Documents\\Welcome.md',
    {
      path: 'C:\\Users\\Demo\\Documents\\Welcome.md',
      name: 'Welcome.md',
      content: SHOWCASE_MARKDOWN,
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      lastModifiedUtc: new Date().toISOString(),
      sizeBytes: SHOWCASE_MARKDOWN.length,
      readOnly: false,
    },
  ],
  [
    'C:\\Users\\Demo\\Documents\\Notes\\Architecture.md',
    {
      path: 'C:\\Users\\Demo\\Documents\\Notes\\Architecture.md',
      name: 'Architecture.md',
      content: `# Vellum Architecture\n\nVellum pairs a tiny **.NET 8 WPF** host with **Edge WebView2**.\n\n## Highlights\n\n- Zero Chromium bundling overhead\n- Custom in-memory \`https://vellum.app\` embedded asset handler\n- Strict DOMPurify sanitization and local media allowlisting\n\n\`\`\`csharp\npublic sealed class BridgeHost\n{\n    public string Version => "1.0.0";\n}\n\`\`\`\n`,
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      lastModifiedUtc: new Date().toISOString(),
      sizeBytes: 340,
      readOnly: false,
    },
  ],
  [
    'C:\\Users\\Demo\\Documents\\Notes\\Changelog.md',
    {
      path: 'C:\\Users\\Demo\\Documents\\Notes\\Changelog.md',
      name: 'Changelog.md',
      content: `# Changelog\n\n## v1.0.0\n\n- Initial public release of **Vellum**\n- Read, Split, and Source editing modes\n- Ivory Light, Obsidian Night, and Warm Paper themes\n- KaTeX equations, Mermaid diagrams, and GitHub Callouts\n- Styled PDF and standalone HTML export\n`,
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      lastModifiedUtc: new Date().toISOString(),
      sizeBytes: 260,
      readOnly: false,
    },
  ],
]);

let mockAssoc: AssocStatus = {
  isRegistered: false,
  isDefaultForMd: false,
  executablePath: 'D:\\Antigravity\\vellum\\dist\\Vellum.exe',
};

function getMockSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    }
  } catch {
    // ignore
  }
  return {
    ...DEFAULT_SETTINGS,
    recentFiles: [
      'C:\\Users\\Demo\\Documents\\Welcome.md',
      'C:\\Users\\Demo\\Documents\\Notes\\Architecture.md',
    ],
    lastOpenedFolder: 'C:\\Users\\Demo\\Documents',
  };
}

function getMockTree(): DirectoryNode {
  return {
    name: 'Documents',
    path: 'C:\\Users\\Demo\\Documents',
    isDirectory: true,
    children: [
      {
        name: 'Notes',
        path: 'C:\\Users\\Demo\\Documents\\Notes',
        isDirectory: true,
        children: [
          {
            name: 'Architecture.md',
            path: 'C:\\Users\\Demo\\Documents\\Notes\\Architecture.md',
            isDirectory: false,
          },
          {
            name: 'Changelog.md',
            path: 'C:\\Users\\Demo\\Documents\\Notes\\Changelog.md',
            isDirectory: false,
          },
        ],
      },
      {
        name: 'Welcome.md',
        path: 'C:\\Users\\Demo\\Documents\\Welcome.md',
        isDirectory: false,
      },
    ],
  };
}

const mockDictionary = new Set<string>();

const MOCK_SPELL_DICT: Record<string, { lang: string; suggestions: string[] }> = {
  teh: { lang: 'en-US', suggestions: ['the', 'tea', 'ten'] },
  recieve: { lang: 'en-US', suggestions: ['receive', 'relieve', 'deceive'] },
  speling: { lang: 'en-US', suggestions: ['spelling', 'spieling', 'sealing'] },
  documnt: { lang: 'en-US', suggestions: ['document', 'documents'] },
  helo: { lang: 'en-US', suggestions: ['hello', 'held', 'help'] },
  wrld: { lang: 'en-US', suggestions: ['world', 'weld', 'wild'] },
  مرحباا: { lang: 'ar-SA', suggestions: ['مرحبا', 'مرحباً'] },
  العررربية: { lang: 'ar-SA', suggestions: ['العربية'] },
};

async function handleMockRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case 'app:ready': {
      const s = getMockSettings();
      const hasStored = Boolean(localStorage.getItem(MOCK_STORAGE_KEY));
      const initialFiles =
        !hasStored || s.startupView === 'lastSession'
          ? [mockFiles.get('C:\\Users\\Demo\\Documents\\Welcome.md')!]
          : [];
      return {
        settings: s,
        initialFiles,
        activeSessionPath: initialFiles[0]?.path ?? null,
        isMaximized: false,
        version: '1.0.1',
      };
    }
    case 'app:setDirtyState':
    case 'app:confirmClose':
    case 'window:minimize':
    case 'window:close':
    case 'window:drag':
    case 'file:revealInExplorer':
    case 'file:openExternalUrl': {
      const url = String(params?.url ?? '');
      if (/^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return true;
    }
    case 'assoc:openDefaultApps':
      return true;
    case 'spell:getLanguages':
      return {
        available: ['en-US', 'ar-SA'],
        activeEnglish: 'en-US',
        activeArabic: 'ar-SA',
      };
    case 'spell:check': {
      const text = String(params?.text ?? '');
      const issues: SpellIssue[] = [];
      const re = /[\p{L}]+/gu;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const w = m[0];
        const key = w.toLowerCase();
        if (mockDictionary.has(key)) continue;
        const hit = MOCK_SPELL_DICT[key] ?? MOCK_SPELL_DICT[w];
        if (hit) {
          issues.push({
            start: m.index,
            length: w.length,
            word: w,
            language: hit.lang,
            suggestions: hit.suggestions,
          });
        }
      }
      return issues;
    }
    case 'spell:addToDictionary':
    case 'spell:ignore': {
      const word = String(params?.word ?? '').toLowerCase();
      if (word) mockDictionary.add(word);
      return true;
    }
    case 'window:toggleMaximize':
      return false;
    case 'settings:get':
      return getMockSettings();
    case 'settings:save': {
      const next = { ...getMockSettings(), ...(params as Partial<AppSettings>) };
      try {
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    }
    case 'file:read': {
      const path = String(params?.path ?? '');
      const found = mockFiles.get(path);
      if (found) return found;
      throw new Error(`File not found in preview mode: ${path}`);
    }
    case 'file:save': {
      const path = String(params?.path ?? '');
      const content = String(params?.content ?? '');
      const doc: FileDocument = {
        path,
        name: path.split(/[\\/]/).pop() || 'Untitled.md',
        content,
        encoding: 'UTF-8',
        lineEnding: 'CRLF',
        lastModifiedUtc: new Date().toISOString(),
        sizeBytes: content.length,
        readOnly: false,
      };
      mockFiles.set(path, doc);
      return doc;
    }
    case 'file:saveAs': {
      const suggested = String(params?.suggestedName ?? 'Untitled.md');
      const content = String(params?.content ?? '');
      const path = `C:\\Users\\Demo\\Documents\\${suggested}`;
      const doc: FileDocument = {
        path,
        name: suggested,
        content,
        encoding: 'UTF-8',
        lineEnding: 'CRLF',
        lastModifiedUtc: new Date().toISOString(),
        sizeBytes: content.length,
        readOnly: false,
      };
      mockFiles.set(path, doc);
      return doc;
    }
    case 'file:openDialog':
      return [mockFiles.get('C:\\Users\\Demo\\Documents\\Notes\\Architecture.md')!];
    case 'file:openFolderDialog':
    case 'file:listDirectory':
      return getMockTree();
    case 'file:createInFolder': {
      const folder = String(params?.folderPath ?? 'C:\\Users\\Demo\\Documents');
      const fileName = String(params?.fileName ?? 'New Note.md');
      const full = `${folder}\\${fileName}`;
      const doc: FileDocument = {
        path: full,
        name: fileName,
        content: `# ${fileName.replace(/\.md$/i, '')}\n\n`,
        encoding: 'UTF-8',
        lineEnding: 'CRLF',
        lastModifiedUtc: new Date().toISOString(),
        sizeBytes: 18,
        readOnly: false,
      };
      mockFiles.set(full, doc);
      return doc;
    }
    case 'assoc:getStatus':
      return mockAssoc;
    case 'assoc:register':
      mockAssoc = { ...mockAssoc, isRegistered: true };
      return mockAssoc;
    case 'assoc:unregister':
      mockAssoc = { ...mockAssoc, isRegistered: false, isDefaultForMd: false };
      return mockAssoc;
    case 'export:pdf':
      window.print();
      return { saved: true, path: 'browser-print' };
    case 'export:html': {
      const html = String(params?.html ?? '');
      const name = String(params?.suggestedName ?? 'document.html');
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return { saved: true, path: name };
    }
    default:
      return null;
  }
}

export function invokeBridge<T = unknown>(
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  ensureListener();
  const webview = window.chrome?.webview;
  if (!webview) {
    return handleMockRpc(method, params) as Promise<T>;
  }

  const id = `req_${++reqCounter}_${Date.now()}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (val: unknown) => void,
      reject,
    });
    webview.postMessage({ id, method, params: params ?? {} });
  });
}

export function sendDroppedFiles(files: FileList): void {
  const webview = window.chrome?.webview;
  if (webview && typeof webview.postMessageWithAdditionalObjects === 'function') {
    webview.postMessageWithAdditionalObjects(
      { event: 'ui:filesDropped' },
      Array.from(files)
    );
    return;
  }

  // Browser preview fallback: read dropped .md/.txt files directly via FileReader
  Array.from(files).forEach((file) => {
    if (!/\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(file.name)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const doc: FileDocument = {
        path: file.name,
        name: file.name,
        content,
        encoding: 'UTF-8',
        lineEnding: content.includes('\r\n') ? 'CRLF' : 'LF',
        lastModifiedUtc: new Date(file.lastModified).toISOString(),
        sizeBytes: file.size,
        readOnly: false,
      };
      for (const listener of eventListeners) {
        listener({ event: 'file:open', payload: doc });
      }
    };
    reader.readAsText(file);
  });
}
