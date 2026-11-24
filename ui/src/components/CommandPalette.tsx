import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const execute = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  return (
    <div className="vellum-modal-backdrop" onClick={onClose}>
      <div
        className="palette-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command Palette"
      >
        <div className="palette-input-wrap">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command, theme, or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filtered.length ? (i - 1 + filtered.length) % filtered.length : 0
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                execute(filtered[selectedIndex]);
              }
            }}
          />
          <span className="cmd-kbd">Esc</span>
        </div>

        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="outline-empty">No matching commands.</div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => execute(cmd)}
              >
                <span className="palette-item-left">
                  <span className="palette-cat">{cmd.category}</span>
                  <span>{cmd.label}</span>
                </span>
                {cmd.shortcut && <span className="cmd-kbd">{cmd.shortcut}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
