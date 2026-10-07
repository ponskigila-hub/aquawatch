import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type AppUpdateBannerProps = {
  message: string;
  progress: number | null;
  isDownloading: boolean;
  onDismiss: () => void;
};

export function AppUpdateBanner({ message, progress, isDownloading, onDismiss }: AppUpdateBannerProps) {
  const percent = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <View style={styles.row}>
        {isDownloading ? <ActivityIndicator size="small" color={colors.maya} /> : <Ionicons name="cloud-download-outline" size={17} color={colors.maya} />}
        <Text accessibilityRole="text" numberOfLines={2} style={styles.message}>
          {isDownloading && percent !== null ? `Downloading AuraGuard update · ${percent}%` : message}
        </Text>
        {!isDownloading ? (
          <Pressable accessibilityLabel="Dismiss update status" hitSlop={8} onPress={onDismiss} style={styles.close}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {isDownloading ? (
        <View accessibilityRole="progressbar" accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }} style={styles.track}>
          {percent === null ? <View style={styles.indeterminate} /> : <View style={[styles.fill, { width: `${percent}%` }]} />}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#173B59', borderBottomWidth: 1, borderBottomColor: colors.line, gap: 7 },
  row: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  close: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#FFFFFF20' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.maya },
  indeterminate: { width: '36%', height: '100%', borderRadius: 2, backgroundColor: colors.maya },
});
