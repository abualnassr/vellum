import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import katex from 'katex';

function isValidDelim(state: StateInline, pos: number): { canOpen: boolean; canClose: boolean } {
  const max = state.posMax;
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  let canOpen = true;
  let canClose = true;

  // Reject "$ 5" opening or "5$" closing (currency protection)
  if (
    prevChar === 0x20 ||
    prevChar === 0x09 ||
    (nextChar >= 0x30 && nextChar <= 0x39)
  ) {
    canClose = false;
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }

  return { canOpen, canClose };
}

function inlineMath(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
  if (state.src.charCodeAt(state.pos + 1) === 0x24) return false;
  // Ignore escaped \$
  if (state.pos > 0 && state.src.charCodeAt(state.pos - 1) === 0x5c) return false;

  const res = isValidDelim(state, state.pos);
  if (!res.canOpen) {
    if (!silent) state.pending += '$';
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let pos = match - 1;
    while (state.src.charCodeAt(pos) === 0x5c /* \ */) {
      pos -= 1;
    }
    if ((match - pos) % 2 === 1) break;
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  if (match - start === 0) {
    if (!silent) state.pending += '$$';
    state.pos = start + 1;
    return true;
  }

  const closeCheck = isValidDelim(state, match);
  if (!closeCheck.canClose) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  const content = state.src.slice(start, match);
  if (content.includes('\n')) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = content;
  }

  state.pos = match + 1;
  return true;
}

function blockMath(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  if (pos + 2 > max) return false;
  if (state.src.slice(pos, pos + 2) !== '$$') return false;

  pos += 2;
  let firstLine = state.src.slice(pos, max);

  if (silent) return true;

  let nextLine = startLine;
  let found = false;

  if (firstLine.trim().endsWith('$$') && firstLine.trim().length >= 2) {
    const idx = firstLine.lastIndexOf('$$');
    firstLine = firstLine.slice(0, idx);
    found = true;
  }

  let lastLine = '';
  if (!found) {
    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
      const lineText = state.src.slice(pos, max).trim();
      if (lineText.endsWith('$$')) {
        const lastPos = state.src.slice(pos, max).lastIndexOf('$$');
        lastLine = state.src.slice(pos, pos + lastPos);
        found = true;
        break;
      }
    }
  }

  state.line = nextLine + 1;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.map = [startLine, state.line];
  if (startLine === nextLine) {
    token.content = firstLine.trim();
  } else {
    const middle = state.getLines(startLine + 1, nextLine, state.tShift[startLine], false);
    token.content = `${firstLine}\n${middle}${lastLine}`.trim();
  }

  return true;
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', inlineMath);
  md.block.ruler.after('blockquote', 'math_block', blockMath, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules.math_inline = (tokens, idx) => {
    const tex = tokens[idx].content;
    return katex.renderToString(tex, {
      displayMode: false,
      throwOnError: false,
      strict: false,
    });
  };

  md.renderer.rules.math_block = (tokens, idx, _options, env) => {
    const tex = tokens[idx].content;
    const lineOffset = typeof env?.lineOffset === 'number' ? env.lineOffset : 0;
    const map = tokens[idx].map;
    const lineAttr = map ? ` data-source-line="${map[0] + lineOffset}"` : '';
    const html = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
    return `<div class="vellum-math-block" dir="ltr"${lineAttr}>${html}</div>\n`;
  };
}
