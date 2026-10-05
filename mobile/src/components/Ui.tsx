import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text>{detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}</View>;
}

export function MetricTile({ icon, label, value, tone = colors.maya }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${tone}22` }]}>{icon}</View><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>;
}

export function LoadingState({ message = 'Loading live data…' }: { message?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.maya} /><Text style={styles.helper}>{message}</Text></View>;
}

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.error}><Text style={styles.errorTitle}>{title}</Text>{detail ? <Text style={styles.helper}>{detail}</Text> : null}</View>;
}

export function SmallLabel({ children }: PropsWithChildren) {
  return <Text style={styles.smallLabel}>{children}</Text>;
}

export function FeatureRow({ icon, title, detail }: { icon: ReactNode; title: string; detail?: string }) {
  return <View style={styles.featureRow}><View style={styles.featureIcon}>{icon}</View><View style={{ flex: 1 }}><Text style={styles.featureTitle}>{title}</Text>{detail ? <Text style={styles.helper}>{detail}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.deepRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12 },
  sectionTitle: { marginTop: 4, marginBottom: 12 },
  sectionHeading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sectionDetail: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  metric: { flex: 1, minWidth: 104, backgroundColor: colors.deepRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 13, minHeight: 106 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 5 },
  loading: { minHeight: 108, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { backgroundColor: '#422A3A', borderColor: '#FF718055', borderWidth: 1, borderRadius: 14, padding: 13, marginVertical: 8 },
  errorTitle: { color: '#FFD6DC', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  smallLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  featureIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5887FF22' },
  featureTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
});
