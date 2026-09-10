// markdownLite — the subset of Markdown a chat reply actually uses, parsed
// into plain data so a native renderer (components/MarkdownText) can draw it
// with nested <Text>. No dependency: a pure-JS package would be safe for an
// OTA, but this is ~150 lines and covers what Turtle writes — headings,
// bullet / numbered lists, code fences, inline code, bold, italic, strike,
// links, quotes, rules. Anything else stays literal text.
//
//   parseMarkdown(text) → [
//     { type: 'paragraph', spans }            spans: [{ text, bold, italic, code, strike, link }]
//     { type: 'heading', level, spans }
//     { type: 'list', ordered, items: [{ spans, depth, number }] }
//     { type: 'code', text, lang }
//     { type: 'quote', spans }
//     { type: 'rule' }
//   ]

const FENCE = /^\s*```\s*([\w-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)([-*•])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

const URL_RE = /https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/;

/** Inline: `code`, **bold**, __bold__, *italic*, _italic_, ~~strike~~, [text](url), bare urls. */
export function parseInline(text) {
  const src = String(text || '');
  const spans = [];
  let i = 0;
  let buf = '';
  const flush = () => { if (buf) { spans.push({ text: buf }); buf = ''; } };
  const push = (t, style) => { if (t) spans.push({ text: t, ...style }); };
  const nest = (inner, style) => { flush(); parseInline(inner).forEach((s) => spans.push({ ...s, ...style })); };

  while (i < src.length) {
    const rest = src.slice(i);
    const prev = i === 0 ? '' : src[i - 1];
    let m;
    // inline code — nothing inside it is parsed
    if ((m = rest.match(/^`([^`]+)`/))) { flush(); push(m[1], { code: true }); i += m[0].length; continue; }
    if ((m = rest.match(/^\*\*(.+?)\*\*/))) { nest(m[1], { bold: true }); i += m[0].length; continue; }
    if ((m = rest.match(/^__(.+?)__/))) { nest(m[1], { bold: true }); i += m[0].length; continue; }
    if ((m = rest.match(/^~~(.+?)~~/))) { nest(m[1], { strike: true }); i += m[0].length; continue; }
    // italic: *x* anywhere; _x_ only at a word boundary (snake_case stays literal)
    if ((m = rest.match(/^\*(?!\s)([^*\n]+?)\*(?!\*)/)) && !/\s$/.test(m[1])) { nest(m[1], { italic: true }); i += m[0].length; continue; }
    if (!/[A-Za-z0-9]/.test(prev) && (m = rest.match(/^_(?!\s)([^_\n]+?)_(?![A-Za-z0-9])/)) && !/\s$/.test(m[1])) { nest(m[1], { italic: true }); i += m[0].length; continue; }
    if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) { flush(); push(m[1], { link: m[2] }); i += m[0].length; continue; }
    if ((m = rest.match(/^https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/))) { flush(); push(m[0], { link: m[0] }); i += m[0].length; continue; }
    buf += src[i];
    i += 1;
  }
  flush();
  return spans;
}

/** True when the text carries any markdown worth rendering. */
export function looksLikeMarkdown(text) {
  const s = String(text || '');
  return /(^|\n)\s*(#{1,6}\s|[-*•]\s|\d{1,3}[.)]\s|>\s|```)/.test(s)
    || /\*\*|__|~~|`|\[[^\]]+\]\([^)]+\)/.test(s)
    || URL_RE.test(s);
}

export function parseMarkdown(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  let code = null;

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'paragraph', spans: parseInline(para.join(' ')) }); para = []; }
  };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of lines) {
    if (code) {
      if (FENCE.test(raw)) { blocks.push(code); code = null; }
      else code.text += (code.text ? '\n' : '') + raw;
      continue;
    }
    let m;
    if ((m = raw.match(FENCE))) { flushPara(); flushList(); code = { type: 'code', lang: m[1] || '', text: '' }; continue; }
    if (!raw.trim()) { flushPara(); flushList(); continue; }
    if (RULE.test(raw)) { flushPara(); flushList(); blocks.push({ type: 'rule' }); continue; }
    if ((m = raw.match(HEADING))) { flushPara(); flushList(); blocks.push({ type: 'heading', level: m[1].length, spans: parseInline(m[2]) }); continue; }
    if ((m = raw.match(QUOTE))) { flushPara(); flushList(); blocks.push({ type: 'quote', spans: parseInline(m[1]) }); continue; }
    if ((m = raw.match(BULLET)) || (m = raw.match(ORDERED))) {
      const ordered = /\d/.test(m[2]);
      const depth = Math.min(2, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
      flushPara();
      if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
      list.items.push({ spans: parseInline(m[3]), depth, number: ordered ? parseInt(m[2], 10) : null });
      continue;
    }
    // A continuation line inside a list item (indented text) extends it.
    if (list && /^\s{2,}\S/.test(raw)) {
      const last = list.items[list.items.length - 1];
      last.spans.push({ text: ' ' }, ...parseInline(raw.trim()));
      continue;
    }
    flushList();
    para.push(raw.trim());
  }
  if (code) blocks.push(code);
  flushPara();
  flushList();
  return blocks;
}
