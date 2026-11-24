import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers as lineNumbersExt,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  findNext,
  findPrevious,
  highlightSelectionMatches,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';
import { tags } from '@lezer/highlight';
import type { SpellIssue, TextDirection } from '../bridge/types';
import type { FormatAction } from './FormattingToolbar';

export interface EditorHandle {
  applyFormatting: (action: FormatAction) => void;
  scrollToLine: (lineOneBased: number) => void;
  getScrollDom: () => HTMLElement | null;
  getLineAtScrollTop: (scrollTop: number) => number;
  scrollToSourceLine: (lineZeroBased: number) => void;
  setFindQuery: (query: string, replaceText?: string) => number;
  findStep: (forward: boolean) => void;
  replaceCurrent: () => void;
  replaceAllMatches: () => void;
  openNextSpellIssue: () => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  value: string;
  readOnly: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  textDirection: TextDirection;
  spellCheck: boolean;
  spellIssues: SpellIssue[];
  onChange: (value: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onScrollSync?: (topLineZeroBased: number) => void;
  onIgnoreSpellWord?: (issue: SpellIssue) => void;
  onAddSpellWord?: (issue: SpellIssue) => void;
}

interface ActivePopover {
  issue: SpellIssue;
  top: number;
  left: number;
}

const editorialMarkdownStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.38em', fontWeight: '700', color: 'var(--text-primary)' },
  { tag: tags.heading2, fontSize: '1.22em', fontWeight: '650', color: 'var(--text-primary)' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '650', color: 'var(--text-primary)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--text-primary)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: [tags.link, tags.url], color: 'var(--accent-text)', textDecoration: 'underline' },
  { tag: tags.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: [tags.monospace, tags.processingInstruction], color: 'var(--accent-text)' },
  { tag: tags.meta, color: 'var(--text-muted)' },
  { tag: tags.keyword, color: 'var(--accent-text)' },
  { tag: tags.string, color: 'var(--success)' },
  { tag: tags.comment, color: 'var(--text-muted)', fontStyle: 'italic' },
]);

const setSpellIssuesEffect = StateEffect.define<SpellIssue[]>();

const spellDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    let next = decos.map(tr.changes);
    if (tr.docChanged) {
      next = next.update({
        filter: (from, to) => {
          let touched = false;
          tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
            if (from <= toB && to >= fromB) touched = true;
          });
          return !touched;
        },
      });
    }
    for (const effect of tr.effects) {
      if (effect.is(setSpellIssuesEffect)) {
        const builder = new RangeSetBuilder<Decoration>();
        const docLen = tr.state.doc.length;
        const sorted = effect.value
          .map((issue, idx) => ({ issue, idx }))
          .filter(
            ({ issue }) =>
              issue.start >= 0 && issue.length > 0 && issue.start + issue.length <= docLen
          )
          .sort((a, b) => a.issue.start - b.issue.start);

        let lastEnd = 0;
        for (const { issue, idx } of sorted) {
          if (issue.start < lastEnd) continue;
          const end = issue.start + issue.length;
          builder.add(
            issue.start,
            end,
            Decoration.mark({
              class: 'cm-spell-error',
              attributes: { 'data-spell-idx': String(idx) },
            })
          );
          lastEnd = end;
        }
        next = builder.finish();
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const RTL_CHAR_RE = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_CHAR_RE = /[A-Za-z]/;
const PREFIX_STRIP_RE = /^\s*(?:#{1,6}\s+|>\s+|(?:[-*+]|\d+[.)])\s+(?:\[[xX ]\])?\s*)/;

function detectLineDirection(text: string): 'rtl' | 'ltr' {
  const stripped = text.replace(PREFIX_STRIP_RE, '');
  for (const ch of stripped) {
    if (RTL_CHAR_RE.test(ch)) return 'rtl';
    if (LATIN_CHAR_RE.test(ch)) return 'ltr';
  }
  return 'ltr';
}

function buildLineDirectionPlugin(mode: TextDirection) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.compute(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.compute(update.view);
        }
      }

      compute(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const maxVisibleEnd =
          view.visibleRanges.length > 0
            ? view.visibleRanges[view.visibleRanges.length - 1].to
            : doc.length;
        const maxLine = doc.lineAt(Math.min(maxVisibleEnd, doc.length)).number;

        let fenceChar: string | null = null;
        for (let ln = 1; ln <= maxLine; ln++) {
          const line = doc.line(ln);
          const trimmed = line.text.trimStart();
          const isFenceLine = trimmed.startsWith('```') || trimmed.startsWith('~~~');

          let inCode = fenceChar !== null;
          if (isFenceLine) {
            inCode = true;
            const ch = trimmed[0];
            if (fenceChar === null) fenceChar = ch;
            else if (fenceChar === ch) fenceChar = null;
          }

          if (inCode) {
            builder.add(
              line.from,
              line.from,
              Decoration.line({ attributes: { dir: 'ltr', spellcheck: 'false' } })
            );
          } else {
            const lineDir = mode === 'auto' ? detectLineDirection(line.text) : mode;
            builder.add(
              line.from,
              line.from,
              Decoration.line({ attributes: { dir: lineDir } })
            );
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}

function wrapSelection(view: EditorView, before: string, after = before, placeholder = 'text') {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const body = selected || placeholder;
  view.dispatch({
    changes: { from, to, insert: `${before}${body}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + body.length,
    },
  });
  view.focus();
}

function prefixLine(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
    selection: { anchor: from + prefix.length },
  });
  view.focus();
}

function insertBlock(view: EditorView, snippet: string) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const needsLeadingNewline = line.text.trim().length > 0 ? '\n' : '';
  const insert = `${needsLeadingNewline}${snippet}\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  view.focus();
}

export const MarkdownEditor = forwardRef<EditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      readOnly,
      wordWrap,
      showLineNumbers,
      textDirection,
      spellCheck,
      spellIssues,
      onChange,
      onCursorChange,
      onScrollSync,
      onIgnoreSpellWord,
      onAddSpellWord,
    },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const wrapCompRef = useRef(new Compartment());
    const lineNumCompRef = useRef(new Compartment());
    const readOnlyCompRef = useRef(new Compartment());
    const dirCompRef = useRef(new Compartment());
    const spellAttrCompRef = useRef(new Compartment());

    const onChangeRef = useRef(onChange);
    const onCursorRef = useRef(onCursorChange);
    const onScrollRef = useRef(onScrollSync);
    const spellIssuesRef = useRef<SpellIssue[]>(spellIssues);
    const lastValueRef = useRef(value);

    const [popover, setPopover] = useState<ActivePopover | null>(null);
    const popoverIssueRef = useRef<SpellIssue | null>(null);
    popoverIssueRef.current = popover?.issue ?? null;

    onChangeRef.current = onChange;
    onCursorRef.current = onCursorChange;
    onScrollRef.current = onScrollSync;
    spellIssuesRef.current = spellIssues;

    const openPopoverForIssue = (view: EditorView, issue: SpellIssue) => {
      const clampedPos = Math.max(0, Math.min(issue.start, view.state.doc.length));
      const coords = view.coordsAtPos(clampedPos);
      if (!coords) return;
      const top = Math.min(window.innerHeight - 230, coords.bottom + 6);
      const left = Math.max(12, Math.min(window.innerWidth - 260, coords.left));
      setPopover({ issue, top, left });
    };

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const customKeys = keymap.of([
        {
          key: 'Mod-b',
          run: (view) => {
            wrapSelection(view, '**', '**', 'bold');
            return true;
          },
        },
        {
          key: 'Mod-i',
          run: (view) => {
            wrapSelection(view, '*', '*', 'italic');
            return true;
          },
        },
      ]);

      const pointerHandlers = EditorView.domEventHandlers({
        mousedown(event, view) {
          const target = event.target as HTMLElement | null;
          const spellSpan = target?.closest<HTMLElement>('.cm-spell-error');
          if (!spellSpan) {
            setPopover(null);
            return false;
          }
          if (event.button === 2) {
            const idxStr = spellSpan.getAttribute('data-spell-idx');
            if (idxStr === null) return false;
            const issue = spellIssuesRef.current[Number(idxStr)];
            if (!issue) return false;
            event.preventDefault();
            openPopoverForIssue(view, issue);
            return true;
          }
          // Left-click: let CodeMirror place the cursor normally so manual editing works
          return false;
        },
        mouseup(event, view) {
          if (event.button !== 0) return false;
          const target = event.target as HTMLElement | null;
          if (!target?.closest('.cm-spell-error')) return false;

          requestAnimationFrame(() => {
            const sel = view.state.selection.main;
            if (!sel.empty) {
              setPopover(null);
              return;
            }
            const issue = spellIssuesRef.current.find(
              (iss) => sel.head >= iss.start && sel.head <= iss.start + iss.length
            );
            if (issue) {
              openPopoverForIssue(view, issue);
            }
          });
          return false;
        },
        contextmenu(event) {
          const target = event.target as HTMLElement | null;
          if (target?.closest('.cm-spell-error')) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          highlightSelectionMatches(),
          search({ top: true }),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(editorialMarkdownStyle),
          spellDecoField,
          pointerHandlers,
          wrapCompRef.current.of(wordWrap ? EditorView.lineWrapping : []),
          lineNumCompRef.current.of(showLineNumbers ? lineNumbersExt() : []),
          readOnlyCompRef.current.of(EditorState.readOnly.of(readOnly)),
          dirCompRef.current.of([
            EditorView.perLineTextDirection.of(textDirection !== 'ltr'),
            buildLineDirectionPlugin(textDirection),
          ]),
          spellAttrCompRef.current.of(
            EditorView.contentAttributes.of({
              spellcheck: spellCheck ? 'true' : 'false',
              autocorrect: spellCheck ? 'on' : 'off',
            })
          ),
          customKeys,
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setPopover(null);
              const text = update.state.doc.toString();
              lastValueRef.current = text;
              onChangeRef.current(text);
            }
            if (update.selectionSet || update.docChanged) {
              const sel = update.state.selection.main;
              const line = update.state.doc.lineAt(sel.head);
              onCursorRef.current(line.number, sel.head - line.from + 1);

              const activeIssue = popoverIssueRef.current;
              if (!update.docChanged && activeIssue) {
                if (
                  !sel.empty ||
                  sel.head < activeIssue.start ||
                  sel.head > activeIssue.start + activeIssue.length
                ) {
                  setPopover(null);
                }
              }
            }
          }),
        ],
      });

      const view = new EditorView({ state, parent: host });
      viewRef.current = view;

      const scroller = view.scrollDOM;
      const handleScroll = () => {
        setPopover(null);
        if (!onScrollRef.current) return;
        const block = view.lineBlockAtHeight(scroller.scrollTop);
        const line = view.state.doc.lineAt(block.from);
        onScrollRef.current(line.number - 1);
      };
      scroller.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        scroller.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    // Sync external value changes (tab switches, checkbox clicks, reloads)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value !== current && value !== lastValueRef.current) {
        lastValueRef.current = value;
        setPopover(null);
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
      } else {
        lastValueRef.current = value;
      }
    }, [value]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: wrapCompRef.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
      });
    }, [wordWrap]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: lineNumCompRef.current.reconfigure(showLineNumbers ? lineNumbersExt() : []),
      });
    }, [showLineNumbers]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: readOnlyCompRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    }, [readOnly]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: dirCompRef.current.reconfigure([
          EditorView.perLineTextDirection.of(textDirection !== 'ltr'),
          buildLineDirectionPlugin(textDirection),
        ]),
      });
    }, [textDirection]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: spellAttrCompRef.current.reconfigure(
          EditorView.contentAttributes.of({
            spellcheck: spellCheck ? 'true' : 'false',
            autocorrect: spellCheck ? 'on' : 'off',
          })
        ),
      });
    }, [spellCheck]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: setSpellIssuesEffect.of(spellIssues),
      });
    }, [spellIssues]);

    useEffect(() => {
      if (!popover) return;
      const closeOnEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setPopover(null);
      };
      const closeOnOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.spell-popover, .cm-spell-error')) {
          setPopover(null);
        }
      };
      window.addEventListener('keydown', closeOnEscape);
      window.addEventListener('mousedown', closeOnOutsideClick);
      return () => {
        window.removeEventListener('keydown', closeOnEscape);
        window.removeEventListener('mousedown', closeOnOutsideClick);
      };
    }, [popover]);

    const applyCorrection = (issue: SpellIssue, replacement: string) => {
      const view = viewRef.current;
      if (!view) return;
      const end = Math.min(view.state.doc.length, issue.start + issue.length);
      view.dispatch({
        changes: { from: issue.start, to: end, insert: replacement },
        selection: { anchor: issue.start + replacement.length },
      });
      setPopover(null);
      view.focus();
    };

    useImperativeHandle(ref, () => ({
      applyFormatting(action: FormatAction) {
        const view = viewRef.current;
        if (!view) return;
        switch (action) {
          case 'heading':
            prefixLine(view, '## ');
            break;
          case 'bold':
            wrapSelection(view, '**', '**', 'bold text');
            break;
          case 'italic':
            wrapSelection(view, '*', '*', 'italic text');
            break;
          case 'strike':
            wrapSelection(view, '~~', '~~', 'strikethrough');
            break;
          case 'inlineCode':
            wrapSelection(view, '`', '`', 'code');
            break;
          case 'link':
            wrapSelection(view, '[', '](https://)', 'link text');
            break;
          case 'quote':
            prefixLine(view, '> ');
            break;
          case 'bulletList':
            prefixLine(view, '- ');
            break;
          case 'orderedList':
            prefixLine(view, '1. ');
            break;
          case 'taskList':
            prefixLine(view, '- [ ] ');
            break;
          case 'codeBlock':
            insertBlock(view, '```typescript\n\n```');
            break;
          case 'table':
            insertBlock(
              view,
              '| Column A | Column B |\n| :--- | :--- |\n| Value 1 | Value 2 |'
            );
            break;
          case 'mathBlock':
            insertBlock(view, '$$\nx^2 + y^2 = z^2\n$$');
            break;
          case 'mermaid':
            insertBlock(view, '```mermaid\nflowchart LR\n    A[Start] --> B[Finish]\n```');
            break;
          case 'hr':
            insertBlock(view, '---');
            break;
        }
      },
      scrollToLine(lineOneBased: number) {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.max(1, Math.min(lineOneBased, view.state.doc.lines));
        const line = view.state.doc.line(clamped);
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }),
        });
      },
      getScrollDom() {
        return viewRef.current?.scrollDOM ?? null;
      },
      getLineAtScrollTop(scrollTop: number) {
        const view = viewRef.current;
        if (!view) return 0;
        const block = view.lineBlockAtHeight(scrollTop);
        return view.state.doc.lineAt(block.from).number - 1;
      },
      scrollToSourceLine(lineZeroBased: number) {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.max(1, Math.min(lineZeroBased + 1, view.state.doc.lines));
        const line = view.state.doc.line(clamped);
        const coords = view.lineBlockAt(line.from);
        view.scrollDOM.scrollTop = coords.top;
      },
      setFindQuery(query: string, replaceText = '') {
        const view = viewRef.current;
        if (!view) return 0;
        const sq = new SearchQuery({
          search: query,
          replace: replaceText,
          caseSensitive: false,
        });
        view.dispatch({ effects: setSearchQuery.of(sq) });
        if (!query) return 0;
        let count = 0;
        const cursor = sq.getCursor(view.state.doc);
        while (!cursor.next().done) count++;
        return count;
      },
      findStep(forward: boolean) {
        const view = viewRef.current;
        if (!view) return;
        if (forward) findNext(view);
        else findPrevious(view);
      },
      replaceCurrent() {
        const view = viewRef.current;
        if (!view) return;
        replaceNext(view);
      },
      replaceAllMatches() {
        const view = viewRef.current;
        if (!view) return;
        replaceAll(view);
      },
      openNextSpellIssue() {
        const view = viewRef.current;
        const issues = spellIssuesRef.current;
        if (!view || issues.length === 0) return;

        const cursor = view.state.selection.main.head;
        const next = issues.find((iss) => iss.start > cursor) ?? issues[0];
        const end = Math.min(view.state.doc.length, next.start + next.length);
        view.dispatch({
          selection: { anchor: next.start, head: end },
          effects: EditorView.scrollIntoView(next.start, { y: 'center' }),
        });
        requestAnimationFrame(() => openPopoverForIssue(view, next));
      },
      focus() {
        viewRef.current?.focus();
      },
    }));

    return (
      <div className="editor-pane">
        <div className="cm-host" ref={hostRef} />
        {popover && (
          <div
            className="spell-popover"
            style={{ top: popover.top, left: popover.left }}
            role="dialog"
            aria-label="Spelling Suggestions"
          >
            <div className="spell-popover-header">
              <span className="spell-popover-word" dir="auto">
                {popover.issue.word}
              </span>
              <span className="spell-popover-lang">{popover.issue.language}</span>
            </div>

            <div className="spell-popover-list">
              {popover.issue.suggestions.length > 0 ? (
                popover.issue.suggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    dir="auto"
                    className="spell-sug-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyCorrection(popover.issue, sug)}
                  >
                    {sug}
                  </button>
                ))
              ) : (
                <div className="spell-empty">No suggestions</div>
              )}
            </div>

            <div className="spell-popover-actions">
              <button
                type="button"
                className="spell-act-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onIgnoreSpellWord?.(popover.issue);
                  setPopover(null);
                }}
              >
                Ignore
              </button>
              <button
                type="button"
                className="spell-act-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAddSpellWord?.(popover.issue);
                  setPopover(null);
                }}
              >
                Add to Dictionary
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
