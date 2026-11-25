import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ExternalLink, Github, Tag, Bug, X } from 'lucide-react';
import type {
  AppSettings,
  AssocStatus,
  ReadingFont,
  ReadingWidth,
  SpellLanguagesInfo,
  StartupView,
  TextDirection,
  ViewMode,
} from '../bridge/types';
import {
  ACCENT_PRESETS,
  normalizeHexColor,
  relativeLuminance,
  THEME_OPTIONS,
} from '../utils/themeAccent';

export type SettingsTab = 'general' | 'appearance' | 'editor' | 'windows' | 'about';

const GITHUB_URL = 'https://github.com/abualnassr/vellum';
const RELEASES_URL = 'https://github.com/abualnassr/vellum/releases';
const ISSUES_URL = 'https://github.com/abualnassr/vellum/issues';

interface SettingsModalProps {
  settings: AppSettings;
  assocStatus: AssocStatus | null;
  spellLanguages: SpellLanguagesInfo | null;
  appVersion: string;
  initialTab?: SettingsTab;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onRegisterAssoc: () => void;
  onUnregisterAssoc: () => void;
  onOpenDefaultApps: () => void;
  onOpenExternalUrl: (url: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  assocStatus,
  spellLanguages,
  appVersion,
  initialTab = 'general',
  onUpdateSettings,
  onRegisterAssoc,
  onUnregisterAssoc,
  onOpenDefaultApps,
  onOpenExternalUrl,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [hexInput, setHexInput] = useState<string>(() =>
    settings.accentColor === 'default' || !settings.accentColor
      ? '#3B5BDB'
      : normalizeHexColor(settings.accentColor) ?? '#3B5BDB'
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setHexInput(
      settings.accentColor === 'default' || !settings.accentColor
        ? '#3B5BDB'
        : normalizeHexColor(settings.accentColor) ?? '#3B5BDB'
    );
  }, [settings.accentColor]);

  const normalizedAccent =
    settings.accentColor === 'default' || !settings.accentColor
      ? 'default'
      : normalizeHexColor(settings.accentColor) ?? 'default';

  const isPresetMatch = (presetId: string) =>
    presetId === 'default' ? normalizedAccent === 'default' : normalizedAccent === presetId;

  const isCustomAccentActive =
    normalizedAccent !== 'default' &&
    !ACCENT_PRESETS.some((p) => p.id !== 'default' && p.id === normalizedAccent);

  const pickerHex = normalizedAccent === 'default' ? '#3B5BDB' : normalizedAccent;

  const commitHexInput = (raw: string) => {
    const parsed = normalizeHexColor(raw);
    if (parsed) {
      setHexInput(parsed);
      onUpdateSettings({ accentColor: parsed });
    } else {
      setHexInput(pickerHex);
    }
  };

  return (
    <div className="vellum-modal-backdrop centered" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="modal-header">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${tab === 'general' ? 'active' : ''}`}
            onClick={() => setTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={`modal-tab ${tab === 'appearance' ? 'active' : ''}`}
            onClick={() => setTab('appearance')}
          >
            Appearance
          </button>
          <button
            type="button"
            className={`modal-tab ${tab === 'editor' ? 'active' : ''}`}
            onClick={() => setTab('editor')}
          >
            Editor
          </button>
          <button
            type="button"
            className={`modal-tab ${tab === 'windows' ? 'active' : ''}`}
            onClick={() => setTab('windows')}
          >
            Windows Integration
          </button>
          <button
            type="button"
            className={`modal-tab ${tab === 'about' ? 'active' : ''}`}
            onClick={() => setTab('about')}
          >
            About
          </button>
        </div>

        <div className="modal-body">
          {tab === 'general' && (
            <>
              <div className="setting-row">
                <div>
                  <div className="setting-title">Startup View</div>
                  <div className="setting-desc">
                    What Vellum opens when launched without a file argument.
                  </div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.startupView}
                  onChange={(e) =>
                    onUpdateSettings({ startupView: e.target.value as StartupView })
                  }
                >
                  <option value="welcome">Welcome Screen</option>
                  <option value="lastSession">Restore Last Session</option>
                  <option value="new">New Blank Document</option>
                  <option value="showcase">Welcome Showcase Guide</option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Default Document View</div>
                  <div className="setting-desc">
                    Initial layout when opening a Markdown file.
                  </div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.defaultViewMode}
                  onChange={(e) =>
                    onUpdateSettings({ defaultViewMode: e.target.value as ViewMode })
                  }
                >
                  <option value="read">Reading View</option>
                  <option value="split">Synced Split View</option>
                  <option value="source">Markdown Source</option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Open Explorer Sidebar on Startup</div>
                  <div className="setting-desc">
                    Show the left folder &amp; recent files drawer when Vellum launches.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.startupSidebar}
                  onChange={(e) =>
                    onUpdateSettings({ startupSidebar: e.target.checked })
                  }
                />
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Open Outline Panel on Startup</div>
                  <div className="setting-desc">
                    Show the Table of Contents outline sidebar automatically.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.startupOutline}
                  onChange={(e) =>
                    onUpdateSettings({ startupOutline: e.target.checked })
                  }
                />
              </div>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <div className="setting-row setting-row-top">
                <div>
                  <div className="setting-title">Color Theme</div>
                  <div className="setting-desc">Switch palette or follow Windows appearance.</div>
                </div>
                <div className="theme-swatches theme-swatches-grid">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`swatch-btn ${settings.theme === t.id ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ theme: t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Accent Color</div>
                  <div className="setting-desc">
                    Highlight color for links, active controls, and checkboxes.
                  </div>
                </div>
                <div className="accent-controls">
                  <div className="accent-swatches" role="radiogroup" aria-label="Accent Color">
                    {ACCENT_PRESETS.map((preset) => {
                      const active = isPresetMatch(preset.id);
                      const checkInk = relativeLuminance(preset.swatch) > 0.36 ? '#18181B' : '#FFFFFF';
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={preset.label}
                          title={`${preset.label} (${preset.swatch})`}
                          className={`accent-swatch ${active ? 'active' : ''}`}
                          style={{ backgroundColor: preset.swatch, color: checkInk }}
                          onClick={() => onUpdateSettings({ accentColor: preset.id })}
                        >
                          {active && <Check size={13} strokeWidth={2.75} />}
                        </button>
                      );
                    })}

                    <label
                      className={`accent-swatch accent-swatch-custom ${isCustomAccentActive ? 'active' : ''}`}
                      title={
                        isCustomAccentActive
                          ? `Custom Accent (${pickerHex})`
                          : 'Pick Custom Accent Color'
                      }
                      style={
                        isCustomAccentActive
                          ? {
                              background: pickerHex,
                              color: relativeLuminance(pickerHex) > 0.36 ? '#18181B' : '#FFFFFF',
                            }
                          : undefined
                      }
                    >
                      {isCustomAccentActive && <Check size={13} strokeWidth={2.75} />}
                      <input
                        type="color"
                        aria-label="Custom accent color picker"
                        value={pickerHex}
                        onChange={(e) => {
                          const normalized =
                            normalizeHexColor(e.target.value) ?? e.target.value.toUpperCase();
                          onUpdateSettings({ accentColor: normalized });
                        }}
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    className="accent-hex-input"
                    aria-label="Custom accent hex color"
                    value={hexInput}
                    placeholder="#3B5BDB"
                    maxLength={7}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setHexInput(raw);
                      if (/^#?[0-9a-fA-F]{6}$/.test(raw.trim())) {
                        const parsed = normalizeHexColor(raw);
                        if (parsed) onUpdateSettings({ accentColor: parsed });
                      }
                    }}
                    onBlur={() => commitHexInput(hexInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitHexInput(hexInput);
                      } else if (e.key === 'Escape') {
                        setHexInput(pickerHex);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Text Direction (BiDi / RTL)</div>
                  <div className="setting-desc">
                    Auto-detect Arabic RTL paragraphs or force direction globally.
                  </div>
                </div>
                <div className="theme-swatches">
                  {(['auto', 'ltr', 'rtl'] as TextDirection[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`swatch-btn ${settings.textDirection === d ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ textDirection: d })}
                    >
                      {d === 'auto' ? 'Auto (BiDi)' : d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Reading Typography</div>
                  <div className="setting-desc">Inter Sans or Newsreader Editorial Serif.</div>
                </div>
                <div className="theme-swatches">
                  {(['sans', 'serif'] as ReadingFont[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`swatch-btn ${settings.readingFont === f ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ readingFont: f })}
                    >
                      {f === 'sans' ? 'Sans (Inter)' : 'Serif (Newsreader)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Reading Font Size</div>
                  <div className="setting-desc">Base prose size ({settings.readingFontSize}px).</div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.readingFontSize}
                  onChange={(e) =>
                    onUpdateSettings({ readingFontSize: Number(e.target.value) })
                  }
                >
                  {[14, 15, 16, 17, 18, 20].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} px
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Line Measure</div>
                  <div className="setting-desc">Maximum reading column width.</div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.readingWidth}
                  onChange={(e) =>
                    onUpdateSettings({ readingWidth: e.target.value as ReadingWidth })
                  }
                >
                  <option value="narrow">Narrow (680px)</option>
                  <option value="comfortable">Comfortable (760px)</option>
                  <option value="wide">Wide (920px)</option>
                  <option value="full">Full Width</option>
                </select>
              </div>
            </>
          )}

          {tab === 'editor' && (
            <>
              <div className="setting-row">
                <div>
                  <div className="setting-title">Spell Checker &amp; Corrections</div>
                  <div className="setting-desc">
                    Underline typos in English &amp; Arabic with 1-click suggestions (F7).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.spellCheck}
                  onChange={(e) => onUpdateSettings({ spellCheck: e.target.checked })}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Spell Check Language</div>
                  <div className="setting-desc">
                    Uses installed Windows dictionaries (skips code blocks &amp; URLs).
                  </div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.spellCheckLanguage}
                  onChange={(e) =>
                    onUpdateSettings({ spellCheckLanguage: e.target.value })
                  }
                >
                  <option value="auto">Auto (English &amp; Arabic)</option>
                  {(spellLanguages?.available ?? []).map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Editor Font Size</div>
                  <div className="setting-desc">JetBrains Mono source size.</div>
                </div>
                <select
                  className="select-ctrl"
                  value={settings.editorFontSize}
                  onChange={(e) =>
                    onUpdateSettings({ editorFontSize: Number(e.target.value) })
                  }
                >
                  {[12, 13, 14, 15, 16, 18].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} px
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Word Wrap</div>
                  <div className="setting-desc">Wrap long lines inside the Markdown editor.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.wordWrap}
                  onChange={(e) => onUpdateSettings({ wordWrap: e.target.checked })}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Line Numbers</div>
                  <div className="setting-desc">Display gutter line numbers when editing.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lineNumbers}
                  onChange={(e) => onUpdateSettings({ lineNumbers: e.target.checked })}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Synchronized Split Scroll</div>
                  <div className="setting-desc">Keep Source editor and Preview aligned.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.syncScroll}
                  onChange={(e) => onUpdateSettings({ syncScroll: e.target.checked })}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Auto-Save Saved Files</div>
                  <div className="setting-desc">Automatically save edits after a brief pause.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => onUpdateSettings({ autoSave: e.target.checked })}
                />
              </div>
            </>
          )}

          {tab === 'windows' && (
            <>
              <div className="setting-row">
                <div>
                  <div className="setting-title">Default .md File Association</div>
                  <div className="setting-desc">
                    Registers Vellum in Windows Explorer for .md, .markdown, .mdown, .mkd, and .mdx under your current user account (zero admin prompt).
                  </div>
                </div>
              </div>

              <div className="setting-row stacked">
                <div className="assoc-status-header">
                  <div className="setting-title">Registration Status</div>
                  {assocStatus?.isDefaultForMd ? (
                    <span className="status-badge success">
                      <CheckCircle2 size={13} /> Default for .md
                    </span>
                  ) : assocStatus?.isRegistered ? (
                    <span className="status-badge registered">Registered</span>
                  ) : (
                    <span className="status-badge neutral">Not Registered</span>
                  )}
                </div>

                <div className="setting-desc">
                  {assocStatus?.isDefaultForMd
                    ? 'Vellum is set as your default viewer and editor for .md files.'
                    : assocStatus?.isRegistered
                    ? 'Vellum is registered in Windows. Open Default Apps and select Vellum for .md files to finish.'
                    : 'Not yet registered on this PC. Register Vellum to make it selectable in Windows Default Apps.'}
                </div>

                {assocStatus?.executablePath && (
                  <div className="setting-path-box" title={assocStatus.executablePath}>
                    {assocStatus.executablePath}
                  </div>
                )}

                <div className="setting-actions">
                  <button type="button" className="btn-primary" onClick={onRegisterAssoc}>
                    {assocStatus?.isRegistered ? 'Refresh Registration' : 'Register .md Files'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={onOpenDefaultApps}>
                    <ExternalLink size={13} /> Default Apps
                  </button>
                  {assocStatus?.isRegistered && (
                    <button type="button" className="btn-danger" onClick={onUnregisterAssoc}>
                      Unregister
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'about' && (
            <>
              <div className="about-hero">
                <img src="/vellum.svg" alt="Vellum logo" className="about-logo" />
                <div className="about-hero-text">
                  <div className="about-title-row">
                    <h3>Vellum</h3>
                    <span className="status-badge registered">v{appVersion}</span>
                  </div>
                  <p>
                    Fast, lightweight, editorial-grade Markdown viewer &amp; editor for Windows.
                  </p>
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">Designed &amp; Built By</div>
                  <div className="setting-desc">Creator &amp; maintainer of Vellum</div>
                </div>
                <div className="about-author-name">Bandar Abualnassr</div>
              </div>

              <div className="setting-row stacked">
                <div>
                  <div className="setting-title">GitHub Repository</div>
                  <div className="setting-desc">
                    Source code, releases, documentation, and issue tracker.
                  </div>
                </div>

                <button
                  type="button"
                  className="setting-path-box about-url-box"
                  onClick={() => onOpenExternalUrl(GITHUB_URL)}
                  title="Open Vellum on GitHub"
                >
                  <span>{GITHUB_URL}</span>
                  <ExternalLink size={13} />
                </button>

                <div className="setting-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onOpenExternalUrl(GITHUB_URL)}
                  >
                    <Github size={14} /> View on GitHub
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onOpenExternalUrl(RELEASES_URL)}
                  >
                    <Tag size={13} /> Releases
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onOpenExternalUrl(ISSUES_URL)}
                  >
                    <Bug size={13} /> Report Issue
                  </button>
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-title">License &amp; Stack</div>
                  <div className="setting-desc">
                    MIT License &middot; .NET 8 (WPF) &middot; Edge WebView2 &middot; React &middot; CodeMirror 6
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
