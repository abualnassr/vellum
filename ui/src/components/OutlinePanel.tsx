import type { TocItem } from '../markdown/engine';

interface OutlinePanelProps {
  items: TocItem[];
  activeHeadingId: string | null;
  onJumpToHeading: (item: TocItem) => void;
}

export function OutlinePanel({
  items,
  activeHeadingId,
  onJumpToHeading,
}: OutlinePanelProps) {
  const minLevel =
    items.length > 0 ? Math.min(...items.map((item) => item.level)) : 1;

  return (
    <aside className="outline-panel" aria-label="Document Outline">
      <div className="panel-header">
        <span>Outline</span>
        <span>{items.length}</span>
      </div>
      <div className="outline-list">
        {items.length === 0 ? (
          <div className="outline-empty">
            Add Markdown headings (<code>#</code>, <code>##</code>) to see an outline here.
          </div>
        ) : (
          items.map((item) => {
            const indent = Math.max(0, item.level - minLevel) * 12;
            const active = item.id === activeHeadingId;
            return (
              <button
                key={`${item.id}-${item.line}`}
                type="button"
                dir="auto"
                className={`outline-item ${active ? 'active' : ''}`}
                style={{ paddingInlineStart: `${10 + indent}px` }}
                onClick={() => onJumpToHeading(item)}
                title={item.text}
              >
                {item.text || 'Untitled'}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
