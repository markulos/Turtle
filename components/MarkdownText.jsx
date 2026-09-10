/**
 * MarkdownText — draws a chat reply with its Markdown applied: headings,
 * bullet / numbered lists, code blocks, inline code, bold, italic, strike,
 * links, quotes, rules. Backed by utils/markdownLite (pure data), so this is
 * only nested <Text> and a few <View>s — no dependency, no WebView.
 *
 * Colours come from the bubble it sits in: pass the same `style` the plain
 * text used (font size / line height / colour) and the renderer derives the
 * rest — code on a translucent field, links in the accent, quotes with a bar.
 */
import React, { memo, useMemo } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { parseMarkdown } from '../utils/markdownLite';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Parse once per distinct text, app-wide: a recycled list cell mounts a new
// component instance for the same message, and useMemo would parse again.
const PARSE_CACHE_MAX = 300;
const parseCache = new Map();
function parseCached(text) {
  const key = String(text || '');
  const hit = parseCache.get(key);
  if (hit) return hit;
  const blocks = parseMarkdown(key);
  if (parseCache.size >= PARSE_CACHE_MAX) parseCache.delete(parseCache.keys().next().value);
  parseCache.set(key, blocks);
  return blocks;
}

function openLink(url) {
  Linking.openURL(url).catch(() => {});
}

function Spans({ spans, colors }) {
  return spans.map((s, i) => {
    const style = [
      s.bold && styles.bold,
      s.italic && styles.italic,
      s.strike && styles.strike,
      s.code && [styles.code, { backgroundColor: colors.codeBg, color: colors.codeText }],
      s.link && [styles.link, { color: colors.link }],
    ].filter(Boolean);
    return (
      <Text
        key={i}
        style={style.length ? style : undefined}
        onPress={s.link ? () => openLink(s.link) : undefined}
        accessibilityRole={s.link ? 'link' : undefined}
      >
        {s.text}
      </Text>
    );
  });
}

function MarkdownText({ text, style, theme, testID }) {
  const blocks = useMemo(() => parseCached(text), [text]);
  const flat = StyleSheet.flatten(style) || {};
  const textColor = flat.color || theme?.colors?.textPrimary || '#fff';
  const fontSize = flat.fontSize || 15;
  const lineHeight = flat.lineHeight || Math.round(fontSize * 1.35);
  const colors = useMemo(() => ({
    codeBg: 'rgba(127,127,127,0.18)',
    codeText: textColor,
    link: theme?.colors?.accentInfo || '#60A5FA',
    quoteBar: 'rgba(127,127,127,0.5)',
    rule: 'rgba(127,127,127,0.35)',
    muted: theme?.colors?.textSecondary || textColor,
  }), [textColor, theme]);
  const base = [style, { color: textColor, fontSize, lineHeight }];

  return (
    <View testID={testID}>
      {blocks.map((b, i) => {
        const gap = i < blocks.length - 1 ? { marginBottom: 6 } : null;
        switch (b.type) {
          case 'heading': {
            const size = b.level === 1 ? fontSize + 4 : b.level === 2 ? fontSize + 2 : fontSize + 1;
            return (
              <Text key={i} style={[base, styles.bold, { fontSize: size, lineHeight: Math.round(size * 1.3) }, gap, i > 0 && { marginTop: 4 }]}>
                <Spans spans={b.spans} colors={colors} />
              </Text>
            );
          }
          case 'list':
            return (
              <View key={i} style={gap}>
                {b.items.map((it, j) => (
                  <View key={j} style={[styles.listRow, { paddingLeft: 4 + it.depth * 14 }]}>
                    <Text style={[base, styles.marker]}>{b.ordered ? `${it.number ?? j + 1}.` : '•'}</Text>
                    <Text style={[base, styles.listText]}>
                      <Spans spans={it.spans} colors={colors} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'code':
            return (
              <View key={i} style={[styles.codeBlock, { backgroundColor: colors.codeBg }, gap]}>
                <Text style={[base, styles.codeBlockText, { color: colors.codeText }]} selectable>{b.text}</Text>
              </View>
            );
          case 'quote':
            return (
              <View key={i} style={[styles.quote, { borderLeftColor: colors.quoteBar }, gap]}>
                <Text style={[base, { color: colors.muted }]}>
                  <Spans spans={b.spans} colors={colors} />
                </Text>
              </View>
            );
          case 'rule':
            return <View key={i} style={[styles.rule, { backgroundColor: colors.rule }, gap]} />;
          default:
            return (
              <Text key={i} style={[base, gap]}>
                <Spans spans={b.spans} colors={colors} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  code: {
    fontFamily: MONO,
    fontSize: 13,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  link: { textDecorationLine: 'underline' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  marker: {
    width: 20,
    textAlign: 'right',
    marginRight: 6,
  },
  listText: {
    flex: 1,
    flexShrink: 1,
  },
  codeBlock: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  codeBlockText: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 18,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: 4,
  },
});

export default memo(MarkdownText);
