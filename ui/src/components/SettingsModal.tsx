import { useState } from 'react';
import { CheckCircle2, ExternalLink, X } from 'lucide-react';
import type {
  AppSettings,
  AssocStatus,
  ReadingFont,
  ReadingWidth,
  SpellLanguagesInfo,
  StartupView,
  TextDirection,
  ThemeMode,
  ViewMode,
} from '../bridge/types';

interface SettingsModalProps {
  settings: AppSettings;
  assocStatus: AssocStatus | null;
  spellLanguages: SpellLanguagesInfo | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onRegisterAssoc: () => void;
  onUnregisterAssoc: () => void;
  onOpenDefaultApps: () => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  assocStatus,
  spellLanguages,
  onUpdateSettings,
  onRegisterAssoc,
  onUnregisterAssoc,
  onOpenDefaultApps,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<'general' | 'appearance' | 'editor' | 'windows'>('general');

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
              <div className="setting-row">
                <div>
                  <div className="setting-title">Color Theme</div>
                  <div className="setting-desc">Switch palette or follow Windows appearance.</div>
                </div>
                <div className="theme-swatches">
                  {(['system', 'light', 'dark', 'paper'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`swatch-btn ${settings.theme === t ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ theme: t })}
                    >
                      {t === 'system'
                        ? 'System'
                        : t === 'light'
                        ? 'Ivory'
                        : t === 'dark'
                        ? 'Obsidian'
                        : 'Paper'}
                    </button>
                  ))}
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
        </div>
      </div>
    </div>
  );
}
