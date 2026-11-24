import { useRef } from 'react';
import type { ReadingFont, ResolvedTheme, SpellIssue, TextDirection } from '../bridge/types';
import type { TocItem } from '../markdown/engine';
import { MarkdownEditor, type EditorHandle } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';

interface SplitViewProps {
  content: string;
  html: string;
  frontmatter: Record<string, unknown> | null;
  documentPath: string | null;
  toc: TocItem[];
  theme: ResolvedTheme;
  readingFont: ReadingFont;
  textDirection: TextDirection;
  spellCheck: boolean;
  spellIssues: SpellIssue[];
  readOnly: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  syncScroll: boolean;
  splitRatio: number;
  findQuery: string;
  activeFindIndex: number;
  editorRef: React.RefObject<EditorHandle | null>;
  previewScrollRef: React.RefObject<HTMLDivElement | null>;
  onSplitRatioChange: (ratio: number) => void;
  onChangeContent: (value: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onFindCountChange: (count: number) => void;
  onToggleTask: (lineIndex: number, checked: boolean) => void;
  onOpenRelativeFile: (resolvedPath: string) => void;
  onOpenExternalUrl: (url: string) => void;
  onInspectMedia: (media: { kind: 'image' | 'svg'; src: string }) => void;
  onActiveHeadingChange: (id: string | null) => void;
  onIgnoreSpellWord?: (issue: SpellIssue) => void;
  onAddSpellWord?: (issue: SpellIssue) => void;
}

export function SplitView({
  content,
  html,
  frontmatter,
  documentPath,
  toc,
  theme,
  readingFont,
  textDirection,
  spellCheck,
  spellIssues,
  readOnly,
  wordWrap,
  lineNumbers,
  syncScroll,
  splitRatio,
  findQuery,
  activeFindIndex,
  editorRef,
  previewScrollRef,
  onSplitRatioChange,
  onChangeContent,
  onCursorChange,
  onFindCountChange,
  onToggleTask,
  onOpenRelativeFile,
  onOpenExternalUrl,
  onInspectMedia,
  onActiveHeadingChange,
  onIgnoreSpellWord,
  onAddSpellWord,
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const syncLockRef = useRef<'editor' | 'preview' | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const lockSource = (src: 'editor' | 'preview') => {
    syncLockRef.current = src;
    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => {
      syncLockRef.current = null;
    }, 80);
  };

  const handleEditorScrollSync = (topLine: number) => {
    if (!syncScroll || syncLockRef.current === 'preview') return;
    const preview = previewScrollRef.current;
    if (!preview) return;
    lockSource('editor');

    const blocks = Array.from(preview.querySelectorAll<HTMLElement>('[data-source-line]'));
    if (blocks.length === 0) return;

    let best: HTMLElement = blocks[0];
    for (const block of blocks) {
      const line = Number(block.getAttribute('data-source-line') ?? 0);
      if (line <= topLine) best = block;
      else break;
    }

    const offsetTop =
      best.getBoundingClientRect().top -
      preview.getBoundingClientRect().top +
      preview.scrollTop -
      20;
    preview.scrollTo({ top: Math.max(0, offsetTop), behavior: 'auto' });
  };

  const handlePreviewScrollSync = (_scrollTop: number, container: HTMLElement) => {
    if (!syncScroll || syncLockRef.current === 'editor') return;
    const editor = editorRef.current;
    if (!editor) return;
    lockSource('preview');

    const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-source-line]'));
    if (blocks.length === 0) return;

    const topEdge = container.getBoundingClientRect().top + 24;
    let targetLine = 0;
    for (const block of blocks) {
      if (block.getBoundingClientRect().top <= topEdge) {
        targetLine = Number(block.getAttribute('data-source-line') ?? 0);
      } else {
        break;
      }
    }
    editor.scrollToSourceLine(targetLine);
  };

  const handleMouseDownResizer = () => {
    draggingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const raw = (ev.clientX - rect.left) / rect.width;
      onSplitRatioChange(Math.max(0.25, Math.min(0.75, raw)));
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={containerRef} className="stage-content">
      <div style={{ width: `${splitRatio * 100}%`, display: 'flex', minWidth: 0 }}>
        <MarkdownEditor
          ref={editorRef}
          value={content}
          readOnly={readOnly}
          wordWrap={wordWrap}
          showLineNumbers={lineNumbers}
          textDirection={textDirection}
          spellCheck={spellCheck}
          spellIssues={spellIssues}
          onChange={onChangeContent}
          onCursorChange={onCursorChange}
          onScrollSync={handleEditorScrollSync}
          onIgnoreSpellWord={onIgnoreSpellWord}
          onAddSpellWord={onAddSpellWord}
        />
      </div>

      <div
        className="split-resizer"
        onMouseDown={handleMouseDownResizer}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize split pane"
      />

      <div style={{ width: `${(1 - splitRatio) * 100}%`, display: 'flex', minWidth: 0 }}>
        <MarkdownPreview
          html={html}
          frontmatter={frontmatter}
          documentPath={documentPath}
          toc={toc}
          theme={theme}
          readingFont={readingFont}
          textDirection={textDirection}
          findQuery={findQuery}
          activeFindIndex={activeFindIndex}
          onFindCountChange={onFindCountChange}
          onToggleTask={onToggleTask}
          onOpenRelativeFile={onOpenRelativeFile}
          onOpenExternalUrl={onOpenExternalUrl}
          onInspectMedia={onInspectMedia}
          onActiveHeadingChange={onActiveHeadingChange}
          onPreviewScroll={handlePreviewScrollSync}
          scrollContainerRef={previewScrollRef}
        />
      </div>
    </div>
  );
}
