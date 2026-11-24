import {
  CheckCircle2,
  FilePlus,
  FolderOpen,
  FolderSearch,
  Sparkles,
} from 'lucide-react';
import type { AssocStatus } from '../bridge/types';

interface WelcomeViewProps {
  recentFiles: string[];
  assocStatus: AssocStatus | null;
  onNewDocument: () => void;
  onOpenFileDialog: () => void;
  onOpenFolderDialog: () => void;
  onOpenShowcase: () => void;
  onOpenRecent: (path: string) => void;
  onRegisterAssoc: () => void;
  onOpenDefaultApps: () => void;
}

export function WelcomeView({
  recentFiles,
  assocStatus,
  onNewDocument,
  onOpenFileDialog,
  onOpenFolderDialog,
  onOpenShowcase,
  onOpenRecent,
  onRegisterAssoc,
  onOpenDefaultApps,
}: WelcomeViewProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-hero">
          <img src="/vellum.svg" alt="Vellum logo" />
          <div>
            <h1>Vellum</h1>
            <p>Editorial Markdown viewer &amp; writer for Windows.</p>
          </div>
        </div>

        <div className="welcome-grid">
          <button type="button" className="action-tile" onClick={onNewDocument}>
            <span className="action-tile-icon">
              <FilePlus size={18} />
            </span>
            <div>
              <div className="action-tile-title">New Document</div>
              <div className="action-tile-sub">Start writing (Ctrl+N)</div>
            </div>
          </button>

          <button type="button" className="action-tile" onClick={onOpenFileDialog}>
            <span className="action-tile-icon">
              <FolderOpen size={18} />
            </span>
            <div>
              <div className="action-tile-title">Open Markdown File</div>
              <div className="action-tile-sub">Browse or drag &amp; drop (Ctrl+O)</div>
            </div>
          </button>

          <button type="button" className="action-tile" onClick={onOpenFolderDialog}>
            <span className="action-tile-icon">
              <FolderSearch size={18} />
            </span>
            <div>
              <div className="action-tile-title">Open Folder</div>
              <div className="action-tile-sub">Explore notes in sidebar</div>
            </div>
          </button>

          <button type="button" className="action-tile" onClick={onOpenShowcase}>
            <span className="action-tile-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <div className="action-tile-title">Welcome Showcase</div>
              <div className="action-tile-sub">Math, Mermaid, Alerts &amp; styling</div>
            </div>
          </button>
        </div>

        {recentFiles.length > 0 && (
          <div className="welcome-recent">
            <h3>Recent Files</h3>
            {recentFiles.slice(0, 6).map((filePath) => {
              const name = filePath.split(/[\\/]/).pop() || filePath;
              return (
                <button
                  key={filePath}
                  type="button"
                  className="recent-row"
                  onClick={() => onOpenRecent(filePath)}
                >
                  <span style={{ fontWeight: 550 }}>{name}</span>
                  <span className="recent-path">{filePath}</span>
                </button>
              );
            })}
          </div>
        )}

        {assocStatus && !assocStatus.isDefaultForMd && (
          <div className="assoc-banner">
            <div>
              <div style={{ fontWeight: 600 }}>Make Vellum your default .md viewer</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: 2 }}>
                {assocStatus.isRegistered
                  ? 'Registered for .md files — pick Vellum in Windows Default Apps.'
                  : 'Register Vellum with Windows Explorer (no admin rights needed).'}
              </div>
            </div>
            {assocStatus.isRegistered ? (
              <button type="button" className="btn-secondary" onClick={onOpenDefaultApps}>
                Default Apps
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={onRegisterAssoc}>
                Set as Default
              </button>
            )}
          </div>
        )}

        {assocStatus?.isDefaultForMd && (
          <div className="assoc-banner" style={{ color: 'var(--success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} />
              <span>Vellum is your default .md viewer on Windows.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
