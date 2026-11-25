import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  invokeBridge,
  onBridgeEvent,
  sendDroppedFiles,
} from './bridge/client';
import type {
  AppSettings,
  AssocStatus,
  DirectoryNode,
  FileDocument,
  ResolvedTheme,
  SpellIssue,
  SpellLanguagesInfo,
  TabDoc,
  TextDirection,
  ThemeMode,
  ViewMode,
} from './bridge/types';
import { SHOWCASE_MARKDOWN } from './bridge/welcomeDoc';
import { renderMarkdownDocument, toggleTaskAtLine, type TocItem } from './markdown/engine';
import { buildStandaloneHtml } from './utils/exportHtml';
import { applyAccentToRoot, getThemeLabel, THEME_OPTIONS } from './utils/themeAccent';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { OutlinePanel } from './components/OutlinePanel';
import { WelcomeView } from './components/WelcomeView';
import { FormattingToolbar, type FormatAction } from './components/FormattingToolbar';
import { MarkdownPreview } from './components/MarkdownPreview';
import { MarkdownEditor, type EditorHandle } from './components/MarkdownEditor';
import { SplitView } from './components/SplitView';
import { FindBar } from './components/FindBar';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { SettingsModal, type SettingsTab } from './components/SettingsModal';
import { StatusBar } from './components/StatusBar';
import { UnsavedModal } from './components/UnsavedModal';
import { ImageLightbox } from './components/ImageLightbox';

const MEASURE_MAP = {
  narrow: '680px',
  comfortable: '760px',
  wide: '920px',
  full: '100%',
} as const;

let tabCounter = 0;

function docToTab(doc: FileDocument, defaultMode: ViewMode): TabDoc {
  return {
    id: `tab_${++tabCounter}`,
    path: doc.path,
    title: doc.name,
    content: doc.content,
    savedContent: doc.content,
    encoding: doc.encoding,
    lineEnding: doc.lineEnding,
    readOnly: doc.readOnly,
    externallyModified: false,
    viewMode: defaultMode,
    cursorLine: 1,
    cursorCol: 1,
  };
}

function getSystemDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);
  const [tabs, setTabs] = useState<TabDoc[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [folderTree, setFolderTree] = useState<DirectoryNode | null>(null);
  const [assocStatus, setAssocStatus] = useState<AssocStatus | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [appVersion, setAppVersion] = useState('1.0.1');
  const [findOpen, setFindOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findCount, setFindCount] = useState(0);
  const [activeFindIdx, setActiveFindIdx] = useState(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [mediaLightbox, setMediaLightbox] = useState<{
    kind: 'image' | 'svg';
    src: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [spellIssues, setSpellIssues] = useState<SpellIssue[]>([]);
  const [spellLanguages, setSpellLanguages] = useState<SpellLanguagesInfo | null>(null);
  const [spellNonce, setSpellNonce] = useState(0);
  const [pendingClose, setPendingClose] = useState<
    | { kind: 'tab'; tabId: string; title: string }
    | { kind: 'app'; dirtyCount: number }
    | null
  >(null);

  const editorRef = useRef<EditorHandle | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const spellTimerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const bootedRef = useRef(false);
  const activeDocRef = useRef<{ id: string | null; content: string }>({
    id: null,
    content: '',
  });
  const defaultViewModeRef = useRef<ViewMode>(settings.defaultViewMode);
  defaultViewModeRef.current = settings.defaultViewMode;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (settings.theme === 'system') return systemDark ? 'dark' : 'light';
    return settings.theme;
  }, [settings.theme, systemDark]);

  // Apply CSS custom properties, data-theme, and contrast-safe accent overrides immediately
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    applyAccentToRoot(root, settings.accentColor, resolvedTheme);
    root.style.setProperty('--reading-measure', MEASURE_MAP[settings.readingWidth]);
    root.style.setProperty('--reading-size', `${settings.readingFontSize}px`);
    root.style.setProperty('--editor-size', `${settings.editorFontSize}px`);
    root.style.setProperty('--zoom', String(settings.zoom));
    try {
      localStorage.setItem('vellum-theme', settings.theme);
    } catch {
      // ignore
    }
  }, [
    resolvedTheme,
    settings.theme,
    settings.accentColor,
    settings.readingWidth,
    settings.readingFontSize,
    settings.editorFontSize,
    settings.zoom,
  ]);

  // Listen to OS theme preference
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void invokeBridge('settings:save', next).catch(() => {});
      return next;
    });
  }, []);

  const openDocumentIntoTab = useCallback(
    (doc: FileDocument, defaultMode: ViewMode) => {
      setTabs((prev) => {
        const existing = prev.find(
          (t) => t.path && t.path.toLowerCase() === doc.path.toLowerCase()
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const tab = docToTab(doc, defaultMode);
        setActiveTabId(tab.id);
        return [...prev, tab];
      });

      setSettings((prev) => {
        const filtered = prev.recentFiles.filter(
          (p) => p.toLowerCase() !== doc.path.toLowerCase()
        );
        const recentFiles = [doc.path, ...filtered].slice(0, 15);
        const next = { ...prev, recentFiles };
        void invokeBridge('settings:save', next).catch(() => {});
        return next;
      });
    },
    []
  );

  // Initialize host handshake & native event listeners
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const boot = await invokeBridge<{
          settings: AppSettings;
          initialFiles: FileDocument[];
          activeSessionPath?: string | null;
          isMaximized: boolean;
          version?: string;
        }>('app:ready');
        if (!mounted) return;
        if (boot.version) setAppVersion(boot.version);
        const mergedSettings = { ...DEFAULT_SETTINGS, ...boot.settings };
        setSettings(mergedSettings);
        setIsMaximized(Boolean(boot.isMaximized));
        setSidebarOpen(Boolean(mergedSettings.startupSidebar));
        setOutlineOpen(Boolean(mergedSettings.startupOutline));

        if (boot.initialFiles && boot.initialFiles.length > 0) {
          const initialTabs = boot.initialFiles.map((f) =>
            docToTab(f, mergedSettings.defaultViewMode)
          );
          setTabs(initialTabs);
          const matched = boot.activeSessionPath
            ? initialTabs.find(
                (t) =>
                  t.path &&
                  t.path.toLowerCase() === boot.activeSessionPath!.toLowerCase()
              )
            : undefined;
          setActiveTabId((matched ?? initialTabs[0]).id);
        } else if (mergedSettings.startupView === 'new') {
          const id = `tab_${++tabCounter}`;
          setTabs([
            {
              id,
              path: null,
              title: 'Untitled.md',
              content: '# Untitled\n\n',
              savedContent: '# Untitled\n\n',
              encoding: 'UTF-8',
              lineEnding: 'CRLF',
              readOnly: false,
              externallyModified: false,
              viewMode:
                mergedSettings.defaultViewMode === 'read'
                  ? 'split'
                  : mergedSettings.defaultViewMode,
              cursorLine: 3,
              cursorCol: 1,
            },
          ]);
          setActiveTabId(id);
        } else if (mergedSettings.startupView === 'showcase') {
          const id = `tab_${++tabCounter}`;
          setTabs([
            {
              id,
              path: null,
              title: 'Welcome Showcase.md',
              content: SHOWCASE_MARKDOWN,
              savedContent: SHOWCASE_MARKDOWN,
              encoding: 'UTF-8',
              lineEnding: 'CRLF',
              readOnly: false,
              externallyModified: false,
              viewMode: mergedSettings.defaultViewMode,
              isShowcase: true,
              cursorLine: 1,
              cursorCol: 1,
            },
          ]);
          setActiveTabId(id);
        }

        bootedRef.current = true;

        void invokeBridge<SpellLanguagesInfo>('spell:getLanguages')
          .then((info) => {
            if (mounted && info) setSpellLanguages(info);
          })
          .catch(() => {});

        if (mergedSettings.lastOpenedFolder) {
          void invokeBridge<DirectoryNode | null>('file:listDirectory', {
            path: mergedSettings.lastOpenedFolder,
          })
            .then((tree) => {
              if (mounted && tree) setFolderTree(tree);
            })
            .catch(() => {});
        }

        void invokeBridge<AssocStatus>('assoc:getStatus')
          .then((status) => {
            if (mounted && status) setAssocStatus(status);
          })
          .catch(() => {});
      } catch (err) {
        if (mounted) {
          showToast(err instanceof Error ? err.message : 'Failed to initialize Vellum');
        }
      }
    })();

    const unsub = onBridgeEvent((evt) => {
      if (evt.event === 'file:open') {
        openDocumentIntoTab(evt.payload, defaultViewModeRef.current);
      } else if (evt.event === 'file:externalChanged') {
        setTabs((prev) =>
          prev.map((t) => {
            if (!t.path || t.path.toLowerCase() !== evt.payload.path.toLowerCase()) {
              return t;
            }
            const isDirty = t.content !== t.savedContent;
            if (!isDirty) {
              // Silent live reload when clean
              void invokeBridge<FileDocument>('file:read', { path: t.path })
                .then((fresh) => {
                  setTabs((latest) =>
                    latest.map((item) =>
                      item.id === t.id
                        ? {
                            ...item,
                            content: fresh.content,
                            savedContent: fresh.content,
                            externallyModified: false,
                          }
                        : item
                    )
                  );
                })
                .catch(() => {});
              return t;
            }
            return { ...t, externallyModified: true };
          })
        );
      } else if (evt.event === 'window:stateChanged') {
        setIsMaximized(evt.payload.isMaximized);
      } else if (evt.event === 'app:requestClose') {
        setPendingClose({ kind: 'app', dirtyCount: evt.payload.dirtyCount });
      } else if (evt.event === 'app:error') {
        showToast(evt.payload.message);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [openDocumentIntoTab, showToast]);

  // Report live dirty state to WPF host for instant clean close vs prompt on unsaved close
  useEffect(() => {
    const dirtyCount = tabs.filter((t) => t.content !== t.savedContent).length;
    void invokeBridge('app:setDirtyState', { dirtyCount }).catch(() => {});
  }, [tabs]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );
  activeDocRef.current = {
    id: activeTab?.id ?? null,
    content: activeTab?.content ?? '',
  };

  // Sync window title
  useEffect(() => {
    if (!activeTab) {
      document.title = 'Vellum';
      return;
    }
    const dirty = activeTab.content !== activeTab.savedContent ? '● ' : '';
    document.title = `${dirty}${activeTab.title} — Vellum`;
  }, [activeTab]);

  // Render active Markdown document synchronously (highlight.js + KaTeX + DOMPurify)
  const rendered = useMemo(() => {
    if (!activeTab) return null;
    return renderMarkdownDocument(
      activeTab.content,
      activeTab.path,
      settings.textDirection
    );
  }, [activeTab?.content, activeTab?.path, settings.textDirection]);

  // Persist open file session for "Restore Last Session" startup view
  useEffect(() => {
    if (!bootedRef.current) return;
    if (sessionTimerRef.current) window.clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = window.setTimeout(() => {
      const filePaths = tabs
        .map((t) => t.path)
        .filter((p): p is string => Boolean(p));
      const activePath = activeTab?.path ?? null;
      setSettings((prev) => {
        const sameFiles =
          prev.lastSessionFiles.length === filePaths.length &&
          prev.lastSessionFiles.every((f, i) => f === filePaths[i]);
        if (sameFiles && prev.lastSessionActivePath === activePath) return prev;
        const next = {
          ...prev,
          lastSessionFiles: filePaths,
          lastSessionActivePath: activePath,
        };
        void invokeBridge('settings:save', next).catch(() => {});
        return next;
      });
    }, 450);

    return () => {
      if (sessionTimerRef.current) window.clearTimeout(sessionTimerRef.current);
    };
  }, [tabs, activeTab?.path]);

  // Debounced Windows-native spell check while editing
  useEffect(() => {
    if (spellTimerRef.current) window.clearTimeout(spellTimerRef.current);

    if (!activeTab || activeTab.viewMode === 'read' || !settings.spellCheck) {
      setSpellIssues([]);
      return;
    }

    const targetTabId = activeTab.id;
    const textToCheck = activeTab.content;
    const lang = settings.spellCheckLanguage;

    spellTimerRef.current = window.setTimeout(() => {
      void invokeBridge<SpellIssue[]>('spell:check', {
        text: textToCheck,
        language: lang,
      })
        .then((issues) => {
          if (
            activeDocRef.current.id === targetTabId &&
            activeDocRef.current.content === textToCheck
          ) {
            setSpellIssues(Array.isArray(issues) ? issues : []);
          }
        })
        .catch(() => {});
    }, 380);

    return () => {
      if (spellTimerRef.current) window.clearTimeout(spellTimerRef.current);
    };
  }, [
    activeTab?.id,
    activeTab?.content,
    activeTab?.viewMode,
    settings.spellCheck,
    settings.spellCheckLanguage,
    spellNonce,
  ]);

  // Actions
  const createNewTab = useCallback(() => {
    const id = `tab_${++tabCounter}`;
    const newTab: TabDoc = {
      id,
      path: null,
      title: 'Untitled.md',
      content: '# Untitled\n\n',
      savedContent: '# Untitled\n\n',
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      readOnly: false,
      externallyModified: false,
      viewMode: 'split',
      cursorLine: 3,
      cursorCol: 1,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  }, []);

  const openShowcaseTab = useCallback(() => {
    const existing = tabs.find((t) => t.isShowcase);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const id = `tab_${++tabCounter}`;
    const tab: TabDoc = {
      id,
      path: null,
      title: 'Welcome Showcase.md',
      content: SHOWCASE_MARKDOWN,
      savedContent: SHOWCASE_MARKDOWN,
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      readOnly: false,
      externallyModified: false,
      viewMode: 'read',
      isShowcase: true,
      cursorLine: 1,
      cursorCol: 1,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
  }, [tabs]);

  const openFileByPath = useCallback(
    async (filePath: string) => {
      try {
        const doc = await invokeBridge<FileDocument>('file:read', { path: filePath });
        openDocumentIntoTab(doc, settings.defaultViewMode);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to open file');
      }
    },
    [openDocumentIntoTab, settings.defaultViewMode, showToast]
  );

  const openFileDialog = useCallback(async () => {
    try {
      const docs = await invokeBridge<FileDocument[]>('file:openDialog');
      for (const doc of docs) {
        openDocumentIntoTab(doc, settings.defaultViewMode);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open file');
    }
  }, [openDocumentIntoTab, settings.defaultViewMode, showToast]);

  const openFolderDialog = useCallback(async () => {
    try {
      const tree = await invokeBridge<DirectoryNode | null>('file:openFolderDialog');
      if (tree) {
        setFolderTree(tree);
        setSidebarOpen(true);
        updateSettings({ lastOpenedFolder: tree.path });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open folder');
    }
  }, [showToast, updateSettings]);

  const createFileInFolder = useCallback(
    async (folderPath: string) => {
      const name = `Note ${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.md`;
      try {
        const doc = await invokeBridge<FileDocument>('file:createInFolder', {
          folderPath,
          fileName: name,
        });
        openDocumentIntoTab(doc, 'split');
        const refreshed = await invokeBridge<DirectoryNode | null>('file:listDirectory', {
          path: folderPath,
        });
        if (refreshed) setFolderTree(refreshed);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to create file');
      }
    },
    [openDocumentIntoTab, showToast]
  );

  const saveTab = useCallback(
    async (tab: TabDoc, forceSaveAs = false): Promise<boolean> => {
      try {
        let saved: FileDocument | null;
        if (!tab.path || forceSaveAs) {
          saved = await invokeBridge<FileDocument | null>('file:saveAs', {
            suggestedName: tab.title.endsWith('.md') ? tab.title : `${tab.title}.md`,
            content: tab.content,
            lineEnding: tab.lineEnding,
          });
        } else {
          saved = await invokeBridge<FileDocument>('file:save', {
            path: tab.path,
            content: tab.content,
            encoding: tab.encoding,
            lineEnding: tab.lineEnding,
          });
        }
        if (!saved) return false;

        setTabs((prev) =>
          prev.map((t) =>
            t.id === tab.id
              ? {
                  ...t,
                  path: saved.path,
                  title: saved.name,
                  savedContent: tab.content,
                  externallyModified: false,
                  isShowcase: false,
                }
              : t
          )
        );
        showToast(`Saved ${saved.name}`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Save failed');
        return false;
      }
    },
    [showToast]
  );

  // Auto-save for files that already exist on disk
  useEffect(() => {
    if (!settings.autoSave || !activeTab || !activeTab.path) return;
    if (activeTab.content === activeTab.savedContent || activeTab.externallyModified) return;

    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveTab(activeTab);
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [settings.autoSave, activeTab, saveTab]);

  const forceCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      setActiveTabId((cur) => {
        if (cur !== tabId) return cur;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].id;
      });
      return next;
    });
  }, []);

  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.content !== tab.savedContent) {
        setPendingClose({ kind: 'tab', tabId: tab.id, title: tab.title });
        return;
      }
      forceCloseTab(tabId);
    },
    [tabs, forceCloseTab]
  );

  const reloadActiveFromDisk = useCallback(async () => {
    if (!activeTab?.path) return;
    try {
      const fresh = await invokeBridge<FileDocument>('file:read', {
        path: activeTab.path,
      });
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                content: fresh.content,
                savedContent: fresh.content,
                externallyModified: false,
              }
            : t
        )
      );
      showToast('Reloaded from disk');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reload failed');
    }
  }, [activeTab, showToast]);

  const updateActiveContent = useCallback(
    (nextContent: string) => {
      if (!activeTabId) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, content: nextContent } : t
        )
      );
    },
    [activeTabId]
  );

  const setActiveViewMode = useCallback(
    (mode: ViewMode) => {
      if (!activeTabId) return;
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, viewMode: mode } : t))
      );
    },
    [activeTabId]
  );

  const handleToggleTask = useCallback(
    (lineIndex: number, checked: boolean) => {
      if (!activeTab || activeTab.readOnly) return;
      const updated = toggleTaskAtLine(activeTab.content, lineIndex, checked);
      if (updated === activeTab.content) return;
      updateActiveContent(updated);
      if (activeTab.path && !activeTab.externallyModified) {
        void invokeBridge('file:save', {
          path: activeTab.path,
          content: updated,
          encoding: activeTab.encoding,
          lineEnding: activeTab.lineEnding,
        })
          .then(() => {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === activeTab.id ? { ...t, savedContent: updated } : t
              )
            );
          })
          .catch(() => {});
      }
    },
    [activeTab, updateActiveContent]
  );

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = THEME_OPTIONS.map((t) => t.id);
    const curIdx = order.indexOf(settings.theme);
    const next = order[(curIdx + 1) % order.length];
    updateSettings({ theme: next });
    showToast(getThemeLabel(next));
  }, [settings.theme, updateSettings, showToast]);

  const exportPdf = useCallback(async () => {
    if (!activeTab) return;
    const wasSource = activeTab.viewMode === 'source';
    const targetTabId = activeTab.id;
    try {
      if (wasSource) {
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, viewMode: 'read' } : t))
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 140)))
        );
      }
      const base = activeTab.title.replace(/\.[^.]+$/, '');
      const res = await invokeBridge<{ saved: boolean; path?: string }>('export:pdf', {
        suggestedName: `${base}.pdf`,
      });
      if (res?.saved) showToast('Exported PDF');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      if (wasSource) {
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, viewMode: 'source' } : t))
        );
      }
    }
  }, [activeTab, showToast]);

  const exportHtml = useCallback(async () => {
    if (!activeTab || !rendered) return;
    try {
      const base = activeTab.title.replace(/\.[^.]+$/, '');
      const effectiveDir =
        settings.textDirection === 'auto'
          ? rendered.detectedDirection
          : settings.textDirection;
      const htmlDoc = buildStandaloneHtml(
        base,
        rendered.html,
        rendered.frontmatter,
        resolvedTheme,
        effectiveDir,
        settings.accentColor
      );
      const res = await invokeBridge<{ saved: boolean }>('export:html', {
        suggestedName: `${base}.html`,
        html: htmlDoc,
      });
      if (res?.saved) showToast('Exported standalone HTML');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'HTML export failed');
    }
  }, [activeTab, rendered, resolvedTheme, settings.textDirection, settings.accentColor, showToast]);

  const cycleTextDirection = useCallback(() => {
    const order: TextDirection[] = ['auto', 'ltr', 'rtl'];
    const next = order[(order.indexOf(settings.textDirection) + 1) % order.length];
    updateSettings({ textDirection: next });
    showToast(
      next === 'auto'
        ? 'Text Direction: Auto (BiDi)'
        : `Text Direction: ${next.toUpperCase()}`
    );
  }, [settings.textDirection, updateSettings, showToast]);

  const handleIgnoreSpellWord = useCallback(
    (issue: SpellIssue) => {
      void invokeBridge('spell:ignore', {
        word: issue.word,
        language: issue.language,
      })
        .then(() => setSpellNonce((n) => n + 1))
        .catch(() => {});
    },
    []
  );

  const handleAddSpellWord = useCallback(
    (issue: SpellIssue) => {
      void invokeBridge('spell:addToDictionary', {
        word: issue.word,
        language: issue.language,
      })
        .then(() => {
          setSpellNonce((n) => n + 1);
          showToast(`Added "${issue.word}" to dictionary`);
        })
        .catch(() => {});
    },
    [showToast]
  );

  const registerAssoc = useCallback(async () => {
    try {
      const status = await invokeBridge<AssocStatus>('assoc:register');
      setAssocStatus(status);
      showToast('Vellum registered for .md files');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Registration failed');
    }
  }, [showToast]);

  const unregisterAssoc = useCallback(async () => {
    try {
      const status = await invokeBridge<AssocStatus>('assoc:unregister');
      setAssocStatus(status);
      showToast('Unregistered Vellum file associations');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unregister failed');
    }
  }, [showToast]);

  const openDefaultApps = useCallback(() => {
    void invokeBridge('assoc:openDefaultApps').catch(() => {});
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    void invokeBridge('file:openExternalUrl', { url }).catch(() => {});
  }, []);

  const openSettingsModal = useCallback((initialTab: SettingsTab = 'general') => {
    setSettingsTab(initialTab);
    setSettingsOpen(true);
  }, []);

  const jumpToHeading = useCallback(
    (item: TocItem) => {
      setActiveHeadingId(item.id);
      if (activeTab?.viewMode === 'source') {
        editorRef.current?.scrollToLine(item.line + 1);
        return;
      }
      const container = previewScrollRef.current;
      const target = container?.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [activeTab?.viewMode]
  );

  // Sync Find query to CodeMirror when in source/split mode
  useEffect(() => {
    if (!findOpen) {
      editorRef.current?.setFindQuery('', '');
      return;
    }
    if (activeTab?.viewMode === 'source') {
      const count = editorRef.current?.setFindQuery(findQuery, replaceText) ?? 0;
      setFindCount(count);
    } else if (activeTab?.viewMode === 'split') {
      editorRef.current?.setFindQuery(findQuery, replaceText);
    }
  }, [findOpen, findQuery, replaceText, activeTab?.viewMode]);

  const handleFindStep = useCallback(
    (forward: boolean) => {
      if (activeTab?.viewMode !== 'read') {
        editorRef.current?.findStep(forward);
      }
      if (findCount > 0) {
        setActiveFindIdx((prev) => (forward ? prev + 1 : prev - 1 + findCount));
      }
    },
    [activeTab?.viewMode, findCount]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (mediaLightbox) setMediaLightbox(null);
        else if (paletteOpen) setPaletteOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (findOpen) setFindOpen(false);
        return;
      }

      if (e.key === 'F7' && activeTab && activeTab.viewMode !== 'read') {
        e.preventDefault();
        editorRef.current?.openNextSpellIssue();
        return;
      }

      if (!ctrl) return;

      if (key === 'k' || (shift && key === 'p')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (key === 'n') {
        e.preventDefault();
        createNewTab();
      } else if (key === 'o' && !shift) {
        e.preventDefault();
        void openFileDialog();
      } else if (key === 'o' && shift) {
        e.preventDefault();
        setOutlineOpen((v) => !v);
      } else if (key === 's' && !shift) {
        e.preventDefault();
        if (activeTab) void saveTab(activeTab, false);
      } else if (key === 's' && shift) {
        e.preventDefault();
        if (activeTab) void saveTab(activeTab, true);
      } else if (key === 'w') {
        e.preventDefault();
        if (activeTabId) requestCloseTab(activeTabId);
      } else if (key === '1' && activeTab) {
        e.preventDefault();
        setActiveViewMode('read');
      } else if (key === '2' && activeTab) {
        e.preventDefault();
        setActiveViewMode('split');
      } else if (key === '3' && activeTab) {
        e.preventDefault();
        setActiveViewMode('source');
      } else if (key === 'f' && activeTab) {
        e.preventDefault();
        setFindOpen(true);
        setFindReplaceOpen(false);
      } else if (key === 'h' && activeTab) {
        e.preventDefault();
        if (activeTab.viewMode === 'read') setActiveViewMode('split');
        setFindOpen(true);
        setFindReplaceOpen(true);
      } else if (key === '\\') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (key === ',') {
        e.preventDefault();
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          openSettingsModal('general');
        }
      } else if (key === 'e' && activeTab) {
        e.preventDefault();
        void exportPdf();
      } else if (key === 'p' && activeTab) {
        e.preventDefault();
        window.print();
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        updateSettings({ zoom: Math.min(1.6, Number((settings.zoom + 0.1).toFixed(2))) });
      } else if (key === '-') {
        e.preventDefault();
        updateSettings({ zoom: Math.max(0.7, Number((settings.zoom - 0.1).toFixed(2))) });
      } else if (key === '0') {
        e.preventDefault();
        updateSettings({ zoom: 1 });
      } else if (e.key === 'Tab' && tabs.length > 1 && activeTabId) {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = shift
          ? (curIdx - 1 + tabs.length) % tabs.length
          : (curIdx + 1) % tabs.length;
        setActiveTabId(tabs[nextIdx].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    activeTabId,
    tabs,
    paletteOpen,
    settingsOpen,
    findOpen,
    mediaLightbox,
    settings.zoom,
    createNewTab,
    openFileDialog,
    saveTab,
    requestCloseTab,
    setActiveViewMode,
    exportPdf,
    updateSettings,
    openSettingsModal,
  ]);

  // Command Palette Registry
  const commands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      {
        id: 'file:new',
        category: 'File',
        label: 'New Markdown Document',
        shortcut: 'Ctrl+N',
        run: createNewTab,
      },
      {
        id: 'file:open',
        category: 'File',
        label: 'Open File…',
        shortcut: 'Ctrl+O',
        run: () => void openFileDialog(),
      },
      {
        id: 'file:folder',
        category: 'File',
        label: 'Open Folder in Explorer Sidebar…',
        run: () => void openFolderDialog(),
      },
      {
        id: 'file:showcase',
        category: 'Help',
        label: 'Open Vellum Welcome Showcase',
        run: openShowcaseTab,
      },
    ];

    if (activeTab) {
      list.push(
        {
          id: 'file:save',
          category: 'File',
          label: 'Save',
          shortcut: 'Ctrl+S',
          run: () => void saveTab(activeTab, false),
        },
        {
          id: 'file:saveAs',
          category: 'File',
          label: 'Save As…',
          shortcut: 'Ctrl+Shift+S',
          run: () => void saveTab(activeTab, true),
        },
        {
          id: 'mode:read',
          category: 'View',
          label: 'Switch to Reading Mode',
          shortcut: 'Ctrl+1',
          run: () => setActiveViewMode('read'),
        },
        {
          id: 'mode:split',
          category: 'View',
          label: 'Switch to Synced Split Mode',
          shortcut: 'Ctrl+2',
          run: () => setActiveViewMode('split'),
        },
        {
          id: 'mode:source',
          category: 'View',
          label: 'Switch to Source Mode',
          shortcut: 'Ctrl+3',
          run: () => setActiveViewMode('source'),
        },
        {
          id: 'export:pdf',
          category: 'Export',
          label: 'Export Styled PDF…',
          shortcut: 'Ctrl+E',
          run: () => void exportPdf(),
        },
        {
          id: 'export:html',
          category: 'Export',
          label: 'Export Standalone HTML…',
          run: () => void exportHtml(),
        },
        {
          id: 'edit:find',
          category: 'Edit',
          label: 'Find in Document',
          shortcut: 'Ctrl+F',
          run: () => {
            setFindOpen(true);
            setFindReplaceOpen(false);
          },
        }
      );
    }

    list.push(
      {
        id: 'theme:light',
        category: 'Theme',
        label: 'Theme: Ivory Light',
        run: () => updateSettings({ theme: 'light' }),
      },
      {
        id: 'theme:dark',
        category: 'Theme',
        label: 'Theme: Obsidian Night',
        run: () => updateSettings({ theme: 'dark' }),
      },
      {
        id: 'theme:paper',
        category: 'Theme',
        label: 'Theme: Warm Paper',
        run: () => updateSettings({ theme: 'paper' }),
      },
      {
        id: 'theme:snow',
        category: 'Theme',
        label: 'Theme: Snow (Cool Slate Light)',
        run: () => updateSettings({ theme: 'snow' }),
      },
      {
        id: 'theme:charcoal',
        category: 'Theme',
        label: 'Theme: Charcoal (Soft Dark)',
        run: () => updateSettings({ theme: 'charcoal' }),
      },
      {
        id: 'theme:sepia-dark',
        category: 'Theme',
        label: 'Theme: Sepia Dark (Warm Dark)',
        run: () => updateSettings({ theme: 'sepia-dark' }),
      },
      {
        id: 'theme:nord',
        category: 'Theme',
        label: 'Theme: Nord (Cool Slate Dark)',
        run: () => updateSettings({ theme: 'nord' }),
      },
      {
        id: 'theme:oled',
        category: 'Theme',
        label: 'Theme: OLED (Pure Black)',
        run: () => updateSettings({ theme: 'oled' }),
      },
      {
        id: 'theme:system',
        category: 'Theme',
        label: 'Theme: Follow Windows System',
        run: () => updateSettings({ theme: 'system' }),
      },
      {
        id: 'typo:font',
        category: 'Typography',
        label:
          settings.readingFont === 'sans'
            ? 'Switch Reading Font to Newsreader Serif'
            : 'Switch Reading Font to Inter Sans',
        run: () =>
          updateSettings({
            readingFont: settings.readingFont === 'sans' ? 'serif' : 'sans',
          }),
      },
      {
        id: 'typo:dirAuto',
        category: 'Direction',
        label: 'Text Direction: Auto (Arabic RTL & English LTR)',
        run: () => updateSettings({ textDirection: 'auto' }),
      },
      {
        id: 'typo:dirRtl',
        category: 'Direction',
        label: 'Text Direction: Force Right-to-Left (RTL)',
        run: () => updateSettings({ textDirection: 'rtl' }),
      },
      {
        id: 'typo:dirLtr',
        category: 'Direction',
        label: 'Text Direction: Force Left-to-Right (LTR)',
        run: () => updateSettings({ textDirection: 'ltr' }),
      },
      {
        id: 'spell:toggle',
        category: 'Spelling',
        label: settings.spellCheck
          ? 'Disable Spell Checker'
          : 'Enable Spell Checker',
        run: () => updateSettings({ spellCheck: !settings.spellCheck }),
      },
      {
        id: 'spell:next',
        category: 'Spelling',
        label: 'Next Spelling Issue & Suggestion',
        shortcut: 'F7',
        run: () => editorRef.current?.openNextSpellIssue(),
      },
      {
        id: 'panel:sidebar',
        category: 'View',
        label: 'Toggle Explorer Sidebar',
        shortcut: 'Ctrl+\\',
        run: () => setSidebarOpen((v) => !v),
      },
      {
        id: 'panel:outline',
        category: 'View',
        label: 'Toggle Table of Contents Outline',
        shortcut: 'Ctrl+Shift+O',
        run: () => setOutlineOpen((v) => !v),
      },
      {
        id: 'app:settings',
        category: 'App',
        label: 'Open Settings & Windows Integration',
        shortcut: 'Ctrl+,',
        run: () => openSettingsModal('general'),
      },
      {
        id: 'app:about',
        category: 'Help',
        label: 'About Vellum & GitHub Repository',
        run: () => openSettingsModal('about'),
      }
    );

    return list;
  }, [
    activeTab,
    settings.readingFont,
    settings.spellCheck,
    createNewTab,
    openFileDialog,
    openFolderDialog,
    openShowcaseTab,
    saveTab,
    setActiveViewMode,
    exportPdf,
    exportHtml,
    updateSettings,
    openSettingsModal,
  ]);

  const handleUnsavedSave = async () => {
    if (!pendingClose) return;
    if (pendingClose.kind === 'tab') {
      const target = tabs.find((t) => t.id === pendingClose.tabId);
      setPendingClose(null);
      if (target && (await saveTab(target))) {
        forceCloseTab(target.id);
      }
    } else {
      const dirtyTabs = tabs.filter((t) => t.content !== t.savedContent);
      setPendingClose(null);
      for (const t of dirtyTabs) {
        const ok = await saveTab(t);
        if (!ok) return;
      }
      await invokeBridge('app:confirmClose');
    }
  };

  const handleUnsavedDiscard = async () => {
    if (!pendingClose) return;
    if (pendingClose.kind === 'tab') {
      const id = pendingClose.tabId;
      setPendingClose(null);
      forceCloseTab(id);
    } else {
      setPendingClose(null);
      await invokeBridge('app:confirmClose');
    }
  };

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.relatedTarget) {
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) {
          sendDroppedFiles(e.dataTransfer.files);
        }
      }}
    >
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        activeViewMode={activeTab?.viewMode ?? 'read'}
        hasActiveTab={Boolean(activeTab)}
        isActiveDirty={Boolean(activeTab && activeTab.content !== activeTab.savedContent)}
        sidebarOpen={sidebarOpen}
        outlineOpen={outlineOpen}
        themeMode={settings.theme}
        resolvedTheme={resolvedTheme}
        isMaximized={isMaximized}
        onSelectTab={setActiveTabId}
        onCloseTab={requestCloseTab}
        onNewTab={createNewTab}
        onOpenFile={() => void openFileDialog()}
        onOpenFolder={() => void openFolderDialog()}
        onSave={() => {
          if (activeTab) void saveTab(activeTab, false);
        }}
        onSaveAs={() => {
          if (activeTab) void saveTab(activeTab, true);
        }}
        onExportPdf={() => void exportPdf()}
        onExportHtml={() => void exportHtml()}
        onPrint={() => window.print()}
        onSetViewMode={setActiveViewMode}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleOutline={() => setOutlineOpen((v) => !v)}
        onCycleTheme={cycleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => openSettingsModal('general')}
        onOpenAbout={() => openSettingsModal('about')}
        onDragWindow={() => void invokeBridge('window:drag').catch(() => {})}
        onMinimize={() => void invokeBridge('window:minimize').catch(() => {})}
        onToggleMaximize={() =>
          void invokeBridge<boolean>('window:toggleMaximize')
            .then((max) => setIsMaximized(Boolean(max)))
            .catch(() => {})
        }
        onCloseWindow={() => void invokeBridge('window:close').catch(() => {})}
      />

      <div className="workspace-body">
        {sidebarOpen && (
          <Sidebar
            tree={folderTree}
            activePath={activeTab?.path ?? null}
            recentFiles={settings.recentFiles}
            onOpenFolder={() => void openFolderDialog()}
            onOpenFile={(p) => void openFileByPath(p)}
            onCreateFileInFolder={(f) => void createFileInFolder(f)}
          />
        )}

        <main className="main-stage">
          {activeTab?.externallyModified && (
            <div className="external-banner">
              <span>
                <strong>{activeTab.title}</strong> was modified externally on disk while you have unsaved edits.
              </span>
              <div className="banner-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: 26, padding: '0 10px' }}
                  onClick={() => void reloadActiveFromDisk()}
                >
                  Reload from Disk
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: 26, padding: '0 10px' }}
                  onClick={() =>
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTab.id
                          ? { ...t, externallyModified: false }
                          : t
                      )
                    )
                  }
                >
                  Keep My Edits
                </button>
              </div>
            </div>
          )}

          {!activeTab ? (
            <WelcomeView
              recentFiles={settings.recentFiles}
              assocStatus={assocStatus}
              appVersion={appVersion}
              onNewDocument={createNewTab}
              onOpenFileDialog={() => void openFileDialog()}
              onOpenFolderDialog={() => void openFolderDialog()}
              onOpenShowcase={openShowcaseTab}
              onOpenRecent={(p) => void openFileByPath(p)}
              onRegisterAssoc={() => void registerAssoc()}
              onOpenDefaultApps={openDefaultApps}
              onOpenAbout={() => openSettingsModal('about')}
              onOpenExternalUrl={openExternalUrl}
            />
          ) : (
            <>
              {activeTab.viewMode !== 'read' && (
                <FormattingToolbar
                  spellCheck={settings.spellCheck}
                  textDirection={settings.textDirection}
                  onAction={(action: FormatAction) =>
                    editorRef.current?.applyFormatting(action)
                  }
                  onToggleSpellCheck={() =>
                    updateSettings({ spellCheck: !settings.spellCheck })
                  }
                  onCycleTextDirection={cycleTextDirection}
                />
              )}

              {findOpen && (
                <FindBar
                  query={findQuery}
                  replaceText={replaceText}
                  showReplace={findReplaceOpen}
                  canReplace={activeTab.viewMode !== 'read' && !activeTab.readOnly}
                  matchCount={findCount}
                  activeIndex={activeFindIdx}
                  onQueryChange={(q) => {
                    setFindQuery(q);
                    setActiveFindIdx(0);
                  }}
                  onReplaceTextChange={setReplaceText}
                  onToggleReplace={() => setFindReplaceOpen((v) => !v)}
                  onStep={handleFindStep}
                  onReplaceOne={() => editorRef.current?.replaceCurrent()}
                  onReplaceAll={() => editorRef.current?.replaceAllMatches()}
                  onClose={() => setFindOpen(false)}
                />
              )}

              {activeTab.viewMode === 'read' && rendered && (
                <div className="stage-content">
                  <MarkdownPreview
                    html={rendered.html}
                    frontmatter={rendered.frontmatter}
                    documentPath={activeTab.path}
                    toc={rendered.toc}
                    theme={resolvedTheme}
                    readingFont={settings.readingFont}
                    textDirection={settings.textDirection}
                    findQuery={findOpen ? findQuery : ''}
                    activeFindIndex={activeFindIdx}
                    onFindCountChange={setFindCount}
                    onToggleTask={handleToggleTask}
                    onOpenRelativeFile={(p) => void openFileByPath(p)}
                    onOpenExternalUrl={(url) =>
                      void invokeBridge('file:openExternalUrl', { url }).catch(() => {})
                    }
                    onInspectMedia={setMediaLightbox}
                    onActiveHeadingChange={setActiveHeadingId}
                    scrollContainerRef={previewScrollRef}
                  />
                </div>
              )}

              {activeTab.viewMode === 'split' && rendered && (
                <SplitView
                  content={activeTab.content}
                  html={rendered.html}
                  frontmatter={rendered.frontmatter}
                  documentPath={activeTab.path}
                  toc={rendered.toc}
                  theme={resolvedTheme}
                  readingFont={settings.readingFont}
                  textDirection={settings.textDirection}
                  spellCheck={settings.spellCheck}
                  spellIssues={spellIssues}
                  readOnly={activeTab.readOnly}
                  wordWrap={settings.wordWrap}
                  lineNumbers={settings.lineNumbers}
                  syncScroll={settings.syncScroll}
                  splitRatio={settings.splitRatio}
                  findQuery={findOpen ? findQuery : ''}
                  activeFindIndex={activeFindIdx}
                  editorRef={editorRef}
                  previewScrollRef={previewScrollRef}
                  onSplitRatioChange={(r) => updateSettings({ splitRatio: r })}
                  onChangeContent={updateActiveContent}
                  onCursorChange={(line, col) =>
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTab.id
                          ? { ...t, cursorLine: line, cursorCol: col }
                          : t
                      )
                    )
                  }
                  onFindCountChange={setFindCount}
                  onToggleTask={handleToggleTask}
                  onOpenRelativeFile={(p) => void openFileByPath(p)}
                  onOpenExternalUrl={(url) =>
                    void invokeBridge('file:openExternalUrl', { url }).catch(() => {})
                  }
                  onInspectMedia={setMediaLightbox}
                  onActiveHeadingChange={setActiveHeadingId}
                  onIgnoreSpellWord={handleIgnoreSpellWord}
                  onAddSpellWord={handleAddSpellWord}
                />
              )}

              {activeTab.viewMode === 'source' && (
                <div className="stage-content">
                  <MarkdownEditor
                    ref={editorRef}
                    value={activeTab.content}
                    readOnly={activeTab.readOnly}
                    wordWrap={settings.wordWrap}
                    showLineNumbers={settings.lineNumbers}
                    textDirection={settings.textDirection}
                    spellCheck={settings.spellCheck}
                    spellIssues={spellIssues}
                    onChange={updateActiveContent}
                    onCursorChange={(line, col) =>
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === activeTab.id
                            ? { ...t, cursorLine: line, cursorCol: col }
                            : t
                        )
                      )
                    }
                    onIgnoreSpellWord={handleIgnoreSpellWord}
                    onAddSpellWord={handleAddSpellWord}
                  />
                </div>
              )}
            </>
          )}
        </main>

        {outlineOpen && activeTab && rendered && (
          <OutlinePanel
            items={rendered.toc}
            activeHeadingId={activeHeadingId}
            onJumpToHeading={jumpToHeading}
          />
        )}
      </div>

      {activeTab && rendered && (
        <StatusBar
          path={activeTab.path}
          wordCount={rendered.wordCount}
          readingMinutes={rendered.readingMinutes}
          cursorLine={activeTab.cursorLine}
          cursorCol={activeTab.cursorCol}
          encoding={activeTab.encoding}
          lineEnding={activeTab.lineEnding}
          zoom={settings.zoom}
          viewMode={activeTab.viewMode}
          spellCheck={settings.spellCheck}
          spellIssueCount={spellIssues.length}
          onRevealInExplorer={(p) =>
            void invokeBridge('file:revealInExplorer', { path: p }).catch(() => {})
          }
          onResetZoom={() => updateSettings({ zoom: 1 })}
          onNextSpellIssue={() => editorRef.current?.openNextSpellIssue()}
          onToggleSpellCheck={() =>
            updateSettings({ spellCheck: !settings.spellCheck })
          }
        />
      )}

      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          assocStatus={assocStatus}
          spellLanguages={spellLanguages}
          appVersion={appVersion}
          initialTab={settingsTab}
          onUpdateSettings={updateSettings}
          onRegisterAssoc={() => void registerAssoc()}
          onUnregisterAssoc={() => void unregisterAssoc()}
          onOpenDefaultApps={openDefaultApps}
          onOpenExternalUrl={openExternalUrl}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingClose && (
        <UnsavedModal
          title={pendingClose.kind === 'tab' ? pendingClose.title : ''}
          isAppClose={pendingClose.kind === 'app'}
          dirtyCount={pendingClose.kind === 'app' ? pendingClose.dirtyCount : 1}
          onSaveAndContinue={() => void handleUnsavedSave()}
          onDiscardAndContinue={() => void handleUnsavedDiscard()}
          onCancel={() => setPendingClose(null)}
        />
      )}

      {mediaLightbox && (
        <ImageLightbox
          media={mediaLightbox}
          onClose={() => setMediaLightbox(null)}
        />
      )}

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-box">
            <FileUp size={36} style={{ color: 'var(--accent)' }} />
            <h3>Drop Markdown File to Open</h3>
            <p>Supports .md, .markdown, .mdown, .mkd, .mdx, and .txt</p>
          </div>
        </div>
      )}

      {toast && <div className="toast-pill">{toast}</div>}
    </div>
  );
}
