import { looksLikeMarkdown, parseInline, parseMarkdown } from '../markdownLite';

test('inline: bold, italic, code, strike, links, bare urls', () => {
  expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
  expect(parseInline('*it* and _it_')).toEqual([{ text: 'it', italic: true }, { text: ' and ' }, { text: 'it', italic: true }]);
  expect(parseInline('use `npm i`')).toEqual([{ text: 'use ' }, { text: 'npm i', code: true }]);
  expect(parseInline('~~gone~~')).toEqual([{ text: 'gone', strike: true }]);
  expect(parseInline('[docs](https://x.y/z)')).toEqual([{ text: 'docs', link: 'https://x.y/z' }]);
  expect(parseInline('see https://t3d.ca/app.')).toEqual([{ text: 'see ' }, { text: 'https://t3d.ca/app', link: 'https://t3d.ca/app' }, { text: '.' }]);
  // snake_case is not italic
  expect(parseInline('user_id and file_name')).toEqual([{ text: 'user_id and file_name' }]);
  // bold wrapping code keeps both
  expect(parseInline('**`x`**')).toEqual([{ text: 'x', code: true, bold: true }]);
});

test('blocks: headings, lists, code fences, quotes, rules, paragraphs', () => {
  const md = [
    '# Plan',
    'First **para** line',
    'continues here',
    '',
    '- one',
    '- two',
    '  more of two',
    '1. first',
    '2) second',
    '> quoted',
    '---',
    '```js',
    'const a = 1;',
    '```',
  ].join('\n');
  const b = parseMarkdown(md);
  expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'rule', 'code']);
  expect(b[0]).toMatchObject({ level: 1 });
  expect(b[1].spans).toEqual([{ text: 'First ' }, { text: 'para', bold: true }, { text: ' line continues here' }]);
  expect(b[2]).toMatchObject({ ordered: false });
  expect(b[2].items[1].spans.map((s) => s.text).join('')).toBe('two more of two');
  expect(b[3]).toMatchObject({ ordered: true });
  expect(b[3].items.map((i) => i.number)).toEqual([1, 2]);
  expect(b[6]).toEqual({ type: 'code', lang: 'js', text: 'const a = 1;' });
});

test('plain text stays one paragraph; detection is conservative', () => {
  expect(parseMarkdown('hello there')).toEqual([{ type: 'paragraph', spans: [{ text: 'hello there' }] }]);
  expect(looksLikeMarkdown('hello there')).toBe(false);
  expect(looksLikeMarkdown('- a list')).toBe(true);
  expect(looksLikeMarkdown('some **bold**')).toBe(true);
});
