import type { ViewMode } from '../bridge/types';

interface StatusBarProps {
  path: string | null;
  wordCount: number;
  readingMinutes: number;
  cursorLine: number;
  cursorCol: number;
  encoding: string;
  lineEnding: 'CRLF' | 'LF';
  zoom: number;
  viewMode: ViewMode;
  spellCheck: boolean;
  spellIssueCount: number;
  onRevealInExplorer: (path: string) => void;
  onResetZoom: () => void;
  onNextSpellIssue: () => void;
  onToggleSpellCheck: () => void;
}

export function StatusBar({
  path,
  wordCount,
  readingMinutes,
  cursorLine,
  cursorCol,
  encoding,
  lineEnding,
  zoom,
  viewMode,
  spellCheck,
  spellIssueCount,
  onRevealInExplorer,
  onResetZoom,
  onNextSpellIssue,
  onToggleSpellCheck,
}: StatusBarProps) {
  return (
    <footer className="statusbar">
      <div className="status-group">
        {path ? (
          <button
            type="button"
            className="status-btn"
            onClick={() => onRevealInExplorer(path)}
            title="Click to reveal in Windows Explorer"
          >
            {path}
          </button>
        ) : (
          <span>Unsaved Draft</span>
        )}
      </div>

      <div className="status-group">
        {viewMode !== 'read' &&
          (spellCheck ? (
            <button
              type="button"
              className={`status-btn ${spellIssueCount > 0 ? 'spell-warn' : 'spell-ok'}`}
              onClick={onNextSpellIssue}
              title={
                spellIssueCount > 0
                  ? 'Click or press F7 to jump to next spelling suggestion'
                  : 'No spelling issues found'
              }
            >
              {spellIssueCount > 0
                ? `${spellIssueCount} spelling ${spellIssueCount === 1 ? 'issue' : 'issues'}`
                : '✓ Spelling'}
            </button>
          ) : (
            <button
              type="button"
              className="status-btn"
              onClick={onToggleSpellCheck}
              title="Spell checker is off — click to enable"
            >
              Spell: Off
            </button>
          ))}
        {viewMode !== 'read' && (
          <span>
            Ln {cursorLine}, Col {cursorCol}
          </span>
        )}
        <span>{wordCount.toLocaleString()} words</span>
        {readingMinutes > 0 && <span>{readingMinutes} min read</span>}
        <span>
          {encoding} · {lineEnding}
        </span>
        {Math.abs(zoom - 1) > 0.01 && (
          <button
            type="button"
            className="status-btn"
            onClick={onResetZoom}
            title="Click to reset zoom (Ctrl+0)"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
      </div>
    </footer>
  );
}
