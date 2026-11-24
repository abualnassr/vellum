import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  BookOpen,
  Code2,
  Columns2,
  Copy,
  FolderOpen,
  ListTree,
  Minus,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Save,
  ScrollText,
  Search,
  Settings,
  Square,
  Sun,
  X,
} from 'lucide-react';
import type { ResolvedTheme, TabDoc, ThemeMode, ViewMode } from '../bridge/types';
import { getThemeLabel, isDarkTheme } from '../utils/themeAccent';

interface TitleBarProps {
  tabs: TabDoc[];
  activeTabId: string | null;
  activeViewMode: ViewMode;
  hasActiveTab: boolean;
  isActiveDirty: boolean;
  sidebarOpen: boolean;
  outlineOpen: boolean;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isMaximized: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onPrint: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  onToggleSidebar: () => void;
  onToggleOutline: () => void;
  onCycleTheme: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onDragWindow: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export function TitleBar({
  tabs,
  activeTabId,
  activeViewMode,
  hasActiveTab,
  isActiveDirty,
  sidebarOpen,
  outlineOpen,
  themeMode,
  resolvedTheme,
  isMaximized,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onExportPdf,
  onExportHtml,
  onPrint,
  onSetViewMode,
  onToggleSidebar,
  onToggleOutline,
  onCycleTheme,
  onOpenPalette,
  onOpenSettings,
  onDragWindow,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleBarMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, .tab-pill, .mode-segmented, .titlebar-menu')) return;
    onDragWindow();
  };

  const handleBarDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, .tab-pill, .mode-segmented, .titlebar-menu')) return;
    onToggleMaximize();
  };

  const runMenuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const themeLabel = getThemeLabel(themeMode, resolvedTheme);

  return (
    <header
      className="titlebar"
      onMouseDown={handleBarMouseDown}
      onDoubleClick={handleBarDoubleClick}
    >
      <div className="titlebar-left">
        <div className="brand-chip" title="Vellum">
          <img src="/vellum.svg" alt="Vellum" />
        </div>

        <button
          type="button"
          className={`icon-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title="Toggle File Sidebar (Ctrl+\)"
          aria-label="Toggle File Sidebar"
        >
          <PanelLeft size={15} />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenFile}
          title="Open File (Ctrl+O)"
          aria-label="Open File"
        >
          <FolderOpen size={15} />
        </button>

        <button
          type="button"
          className={`icon-btn ${isActiveDirty ? 'save-dirty' : ''}`}
          disabled={!hasActiveTab}
          onClick={onSave}
          title={isActiveDirty ? 'Save Changes (Ctrl+S)' : 'Save (Ctrl+S)'}
          aria-label="Save File"
        >
          <Save size={15} />
        </button>

        <div className="titlebar-menu-wrap" ref={menuWrapRef}>
          <button
            type="button"
            className={`icon-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="File & Export Menu"
            aria-label="File & Export Menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div className="titlebar-menu" role="menu" aria-label="File and Export Menu">
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                onClick={() => runMenuAction(onNewTab)}
              >
                <span>New Document</span>
                <span className="titlebar-menu-kbd">Ctrl+N</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                onClick={() => runMenuAction(onOpenFile)}
              >
                <span>Open File…</span>
                <span className="titlebar-menu-kbd">Ctrl+O</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                onClick={() => runMenuAction(onOpenFolder)}
              >
                <span>Open Folder…</span>
              </button>

              <div className="titlebar-menu-sep" />

              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                disabled={!hasActiveTab}
                onClick={() => runMenuAction(onSave)}
              >
                <span>Save</span>
                <span className="titlebar-menu-kbd">Ctrl+S</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                disabled={!hasActiveTab}
                onClick={() => runMenuAction(onSaveAs)}
              >
                <span>Save As…</span>
                <span className="titlebar-menu-kbd">Ctrl+Shift+S</span>
              </button>

              <div className="titlebar-menu-sep" />

              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                disabled={!hasActiveTab}
                onClick={() => runMenuAction(onExportPdf)}
              >
                <span>Export Styled PDF…</span>
                <span className="titlebar-menu-kbd">Ctrl+E</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                disabled={!hasActiveTab}
                onClick={() => runMenuAction(onExportHtml)}
              >
                <span>Export Standalone HTML…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="titlebar-menu-item"
                disabled={!hasActiveTab}
                onClick={() => runMenuAction(onPrint)}
              >
                <span>Print…</span>
                <span className="titlebar-menu-kbd">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        <span className="titlebar-sep" />

        <div className="tab-strip" role="tablist">
          {tabs.map((tab) => {
            const isDirty = tab.content !== tab.savedContent;
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={active}
                className={`tab-pill ${active ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                title={tab.path ?? tab.title}
              >
                {isDirty && <span className="tab-dirty-dot" title="Unsaved changes" />}
                <span className="tab-title">{tab.title}</span>
                <button
                  type="button"
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close Tab (Ctrl+W)"
                  aria-label={`Close ${tab.title}`}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="icon-btn"
            onClick={onNewTab}
            title="New Document (Ctrl+N)"
            aria-label="New Document"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {activeTabId && (
        <div className="titlebar-center">
          <div className="mode-segmented" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`mode-seg-btn ${activeViewMode === 'read' ? 'active' : ''}`}
              onClick={() => onSetViewMode('read')}
              title="Reading Mode (Ctrl+1)"
            >
              <BookOpen size={13} />
              <span>Read</span>
            </button>
            <button
              type="button"
              className={`mode-seg-btn ${activeViewMode === 'split' ? 'active' : ''}`}
              onClick={() => onSetViewMode('split')}
              title="Split Mode (Ctrl+2)"
            >
              <Columns2 size={13} />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`mode-seg-btn ${activeViewMode === 'source' ? 'active' : ''}`}
              onClick={() => onSetViewMode('source')}
              title="Source Mode (Ctrl+3)"
            >
              <Code2 size={13} />
              <span>Source</span>
            </button>
          </div>
        </div>
      )}

      <div className="titlebar-right">
        <button
          type="button"
          className="cmd-trigger-btn"
          onClick={onOpenPalette}
          title="Command Palette (Ctrl+K)"
        >
          <Search size={12} />
          <span>Commands</span>
          <span className="cmd-kbd">Ctrl K</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onCycleTheme}
          title={`Theme: ${themeLabel} (Click to switch)`}
          aria-label="Switch Theme"
        >
          {resolvedTheme === 'paper' ? (
            <ScrollText size={15} />
          ) : isDarkTheme(resolvedTheme) ? (
            <Moon size={15} />
          ) : (
            <Sun size={15} />
          )}
        </button>

        <button
          type="button"
          className={`icon-btn ${outlineOpen ? 'active' : ''}`}
          onClick={onToggleOutline}
          title="Toggle Table of Contents (Ctrl+Shift+O)"
          aria-label="Toggle Outline"
        >
          <ListTree size={15} />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          aria-label="Settings"
        >
          <Settings size={15} />
        </button>

        <div className="win-controls">
          <button
            type="button"
            className="win-btn"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize window"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="win-btn"
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          >
            {isMaximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button
            type="button"
            className="win-btn close"
            onClick={onCloseWindow}
            title="Close"
            aria-label="Close window"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
