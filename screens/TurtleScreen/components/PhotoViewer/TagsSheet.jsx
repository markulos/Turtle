/**
 * TagsSheet — the photo's tags, edited in place. Instagram-comments shape: a
 * page slides up over the photo, the current tags sit at the top as chips you
 * can remove, the albums you could add sit below as chips you can tap, and a
 * composer row at the bottom types a new one. Every add and remove commits
 * IMMEDIATELY through onCommitTags (MediaGallery's optimistic commitTags:
 * local state first, the PUT in the background, reverted on failure) — there
 * is no Save button because there is nothing left to save.
 *
 * The chips render `parseTags(item)` from props, so the optimistic update
 * flows back through the items list rather than living in a second copy here.
 * `Favourites` shows but cannot be removed from this sheet: the heart owns it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { FAVOURITES_TAG, parseTags } from '../../../../utils/viewerFormat';
import ViewerSheet from './ViewerSheet';

const SYSTEM_TAGS = new Set(['All', FAVOURITES_TAG]);

/** Trim, drop empties, keep first occurrences (case-sensitive, like the server). */
export function mergeTags(current, additions) {
  const out = [...current];
  for (const raw of additions) {
    const t = String(raw || '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export default function TagsSheet({ item, suggestions = [], onCommitTags, onClose, theme }) {
  const tags = useMemo(() => parseTags(item), [item]);
  const [draft, setDraft] = useState('');
  const colors = theme?.colors || {};

  const commit = useCallback((next) => {
    if (!item?.id) return;
    onCommitTags?.(item.id, next);
  }, [item?.id, onCommitTags]);

  const add = useCallback((raw) => {
    const next = mergeTags(tags, Array.isArray(raw) ? raw : [raw]);
    setDraft('');
    if (next.length !== tags.length) commit(next);
  }, [tags, commit]);

  const remove = useCallback((tag) => {
    if (tag === FAVOURITES_TAG) return;
    commit(tags.filter((t) => t !== tag));
  }, [tags, commit]);

  const handleChange = useCallback((text) => {
    // A comma boxes what was typed, like the composer always did.
    if (text.includes(',')) {
      const parts = text.split(',').map((t) => t.trim()).filter(Boolean);
      const tail = text.endsWith(',') ? '' : parts.pop() || '';
      if (parts.length) add(parts);
      setDraft(tail);
      return;
    }
    setDraft(text);
  }, [add]);

  const submit = useCallback(() => {
    if (draft.trim()) add(draft);
  }, [draft, add]);

  const available = useMemo(
    () => suggestions.filter((s) => s && !SYSTEM_TAGS.has(s) && !tags.includes(s)),
    [suggestions, tags],
  );
  const canSend = draft.trim().length > 0;

  const composer = (
    <View style={[styles.composer, { borderTopColor: colors.border || 'rgba(255,255,255,0.12)' }]}>
      <TextInput
        style={[styles.input, { color: colors.textPrimary || '#fff', backgroundColor: colors.surface || 'rgba(255,255,255,0.08)' }]}
        value={draft}
        onChangeText={handleChange}
        onSubmitEditing={submit}
        placeholder="Add a tag…"
        placeholderTextColor={colors.textMuted || 'rgba(255,255,255,0.4)'}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit={false}
        accessibilityLabel="New tag"
        testID="tags-input"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add tag"
        testID="tags-send"
        style={({ pressed }) => [styles.send, pressed && styles.pressed]}
      >
        <Icon name="arrow-up-circle" size={32} color={canSend ? (colors.primary || '#3b82f6') : (colors.textMuted || 'rgba(255,255,255,0.3)')} />
      </Pressable>
    </View>
  );

  return (
    <ViewerSheet title="Tags" onClose={onClose} theme={theme} keyboard footer={composer} heightRatio={0.62} testID="tags-sheet">
      <Text style={[styles.section, { color: colors.textSecondary || 'rgba(255,255,255,0.6)' }]}>On this photo</Text>
      <View style={styles.wrap}>
        {tags.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted || 'rgba(255,255,255,0.4)' }]}>No tags yet</Text>
        )}
        {tags.map((tag) => {
          const locked = tag === FAVOURITES_TAG;
          return (
            <Pressable
              key={tag}
              onPress={() => remove(tag)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={locked ? tag : `Remove ${tag}`}
              testID={`tag-chip-${tag}`}
              style={({ pressed }) => [styles.chip, { backgroundColor: colors.primary || '#3b82f6' }, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, { color: colors.background || '#000' }]}>{tag}</Text>
              {!locked && <Icon name="close-circle" size={16} color={colors.background || '#000'} />}
            </Pressable>
          );
        })}
      </View>

      {available.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.textSecondary || 'rgba(255,255,255,0.6)' }]}>Add to album</Text>
          <View style={styles.wrap}>
            {available.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => add(tag)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${tag}`}
                testID={`tag-suggest-${tag}`}
                style={({ pressed }) => [styles.chip, styles.chipGhost, { borderColor: colors.border || 'rgba(255,255,255,0.2)' }, pressed && styles.pressed]}
              >
                <Icon name="plus" size={14} color={colors.textPrimary || '#fff'} />
                <Text style={[styles.chipText, { color: colors.textPrimary || '#fff' }]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ViewerSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 10,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  chipGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontSize: 15,
    textAlignVertical: 'center',
  },
  send: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
