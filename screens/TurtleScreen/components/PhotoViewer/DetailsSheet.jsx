/**
 * DetailsSheet — the swipe-up metadata page: when it was taken, the file, its
 * size and resolution, its type, and its tags (read-only here, with a button
 * that hands over to the tags sheet). Translucent black with white text, so
 * it reads as part of the viewer; the shell hides the chrome while it is up.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { formatBytes } from '../../../../utils/statsFormat';
import { formatViewerResolution, formatViewerTimestamp, parseTags } from '../../../../utils/viewerFormat';
import ViewerSheet, { sheetColors } from './ViewerSheet';

function Row({ icon, label, value, colors }) {
  if (!value) return null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

export default function DetailsSheet({ item, onEditTags, onClose, theme, dark = true }) {
  const colors = sheetColors(theme, dark);
  const tags = useMemo(() => parseTags(item), [item]);
  const isVideo = item?.type === 'video';
  const sizeText = useMemo(() => {
    const res = formatViewerResolution(item);
    const bytes = item?.size > 0 ? formatBytes(item.size) : '';
    return [res, bytes].filter(Boolean).join(' · ');
  }, [item]);

  return (
    <ViewerSheet title="Details" onClose={onClose} theme={theme} dark={dark} heightRatio={0.55} testID="details-sheet">
      <Row icon="calendar-clock" label="Taken" value={formatViewerTimestamp(item)} colors={colors} />
      <Row icon="file-outline" label="File" value={item?.filename} colors={colors} />
      <Row icon={isVideo ? 'video-outline' : 'image-size-select-large'} label="Size" value={sizeText} colors={colors} />
      <Row icon={isVideo ? 'movie-outline' : 'image-outline'} label="Type" value={isVideo ? 'Video' : 'Photo'} colors={colors} />

      <View style={styles.tagsHeader}>
        <Text style={[styles.section, { color: colors.textSecondary }]}>Tags</Text>
        <Pressable
          onPress={onEditTags}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit tags"
          testID="details-edit-tags"
          style={({ pressed }) => [styles.editTags, pressed && styles.pressed]}
        >
          <Icon name="tag-plus" size={16} color={colors.primary} />
          <Text style={[styles.editTagsText, { color: colors.primary }]}>Edit tags</Text>
        </Pressable>
      </View>
      <View style={styles.wrap}>
        {tags.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No tags</Text>
        )}
        {tags.map((tag) => (
          <View key={tag} style={[styles.chip, { backgroundColor: colors.chip }]}>
            <Text style={[styles.chipText, { color: colors.chipText }]} numberOfLines={1}>{tag}</Text>
          </View>
        ))}
      </View>
    </ViewerSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    marginLeft: 12,
    flex: 1,
  },
  label: {
    fontSize: 12,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  editTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editTagsText: {
    fontSize: 14,
    fontWeight: '600',
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '100%',
    flexShrink: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
