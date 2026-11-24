import {
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code,
  FileCode2,
  GitBranch,
  Heading2,
  Italic,
  Languages,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  SpellCheck2,
  Strikethrough,
  Table,
} from 'lucide-react';
import type { TextDirection } from '../bridge/types';

export type FormatAction =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'inlineCode'
  | 'link'
  | 'quote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'table'
  | 'mathBlock'
  | 'mermaid'
  | 'hr';

interface FormattingToolbarProps {
  spellCheck: boolean;
  textDirection: TextDirection;
  onAction: (action: FormatAction) => void;
  onToggleSpellCheck: () => void;
  onCycleTextDirection: () => void;
}

export function FormattingToolbar({
  spellCheck,
  textDirection,
  onAction,
  onToggleSpellCheck,
  onCycleTextDirection,
}: FormattingToolbarProps) {
  return (
    <div className="formatting-toolbar" role="toolbar" aria-label="Markdown Formatting">
      <button type="button" className="fmt-btn" onClick={() => onAction('heading')} title="Heading">
        <Heading2 size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('bold')} title="Bold (Ctrl+B)">
        <Bold size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('italic')} title="Italic (Ctrl+I)">
        <Italic size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('strike')} title="Strikethrough">
        <Strikethrough size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('inlineCode')} title="Inline Code">
        <Code size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('link')} title="Insert Link">
        <Link size={14} />
      </button>

      <span className="fmt-sep" />

      <button type="button" className="fmt-btn" onClick={() => onAction('quote')} title="Blockquote">
        <Quote size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('bulletList')} title="Bullet List">
        <List size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('orderedList')} title="Numbered List">
        <ListOrdered size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('taskList')} title="Task Checklist">
        <CheckSquare size={14} />
      </button>

      <span className="fmt-sep" />

      <button type="button" className="fmt-btn" onClick={() => onAction('codeBlock')} title="Code Block">
        <FileCode2 size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('table')} title="Insert Table">
        <Table size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('mathBlock')} title="KaTeX Math Block">
        <Sigma size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('mermaid')} title="Mermaid Diagram">
        <GitBranch size={14} />
      </button>
      <button type="button" className="fmt-btn" onClick={() => onAction('hr')} title="Horizontal Rule">
        <Minus size={14} />
      </button>

      <span style={{ flex: 1 }} />

      <button
        type="button"
        className={`fmt-btn ${textDirection !== 'auto' ? 'active' : ''}`}
        onClick={onCycleTextDirection}
        title={`Text Direction: ${textDirection.toUpperCase()} (Click to cycle Auto / LTR / RTL)`}
      >
        {textDirection === 'rtl' ? (
          <AlignRight size={14} />
        ) : textDirection === 'ltr' ? (
          <AlignLeft size={14} />
        ) : (
          <Languages size={14} />
        )}
        <span style={{ fontSize: 11 }}>{textDirection.toUpperCase()}</span>
      </button>

      <button
        type="button"
        className={`fmt-btn ${spellCheck ? 'active' : ''}`}
        onClick={onToggleSpellCheck}
        title="Toggle Spell Checker (F7 for next suggestion)"
      >
        <SpellCheck2 size={14} />
        <span style={{ fontSize: 11 }}>Spell</span>
      </button>
    </div>
  );
}
