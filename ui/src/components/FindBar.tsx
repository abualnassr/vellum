import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react';

interface FindBarProps {
  query: string;
  replaceText: string;
  showReplace: boolean;
  canReplace: boolean;
  matchCount: number;
  activeIndex: number;
  onQueryChange: (q: string) => void;
  onReplaceTextChange: (r: string) => void;
  onToggleReplace: () => void;
  onStep: (forward: boolean) => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindBar({
  query,
  replaceText,
  showReplace,
  canReplace,
  matchCount,
  activeIndex,
  onQueryChange,
  onReplaceTextChange,
  onToggleReplace,
  onStep,
  onReplaceOne,
  onReplaceAll,
  onClose,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const countLabel = !query
    ? ''
    : matchCount === 0
    ? '0 / 0'
    : `${((activeIndex % matchCount) + matchCount) % matchCount + 1} / ${matchCount}`;

  return (
    <div className="find-bar" role="dialog" aria-label="Find and Replace">
      <div className="find-row">
        <input
          ref={inputRef}
          type="text"
          className="find-input"
          placeholder="Find in document…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onStep(!e.shiftKey);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <span className="find-count">{countLabel}</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onStep(false)}
          title="Previous Match (Shift+Enter)"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onStep(true)}
          title="Next Match (Enter)"
        >
          <ChevronDown size={15} />
        </button>
        {canReplace && (
          <button
            type="button"
            className={`icon-btn ${showReplace ? 'active' : ''}`}
            onClick={onToggleReplace}
            title="Toggle Replace"
          >
            <Replace size={14} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onClose} title="Close (Esc)">
          <X size={14} />
        </button>
      </div>

      {canReplace && showReplace && (
        <div className="find-row">
          <input
            type="text"
            className="find-input"
            placeholder="Replace with…"
            value={replaceText}
            onChange={(e) => onReplaceTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button type="button" className="btn-secondary" style={{ height: 27, padding: '0 9px' }} onClick={onReplaceOne}>
            Replace
          </button>
          <button type="button" className="btn-secondary" style={{ height: 27, padding: '0 9px' }} onClick={onReplaceAll}>
            All
          </button>
        </div>
      )}
    </div>
  );
}
