import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, type Coordinates } from '../theme';
import { WebRouteScreen } from './WebRouteScreen';

export function MapScreen({ location, locationLabel, webUrl }: { location: Coordinates; locationLabel: string; webUrl: string }) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [refresh, setRefresh] = useState(0);
  const snapPoints = useMemo(() => [78, '35%', '66%'], []);
  return <View style={styles.root}>
    <WebRouteScreen route="map" baseUrl={webUrl} location={location} mode={mode} refresh={refresh} />
    <View style={styles.floating}>
      <Pressable accessibilityLabel={`Switch to ${mode === '3d' ? '2D map' : '3D globe'}`} style={styles.floatButton} onPress={() => setMode((current) => current === '3d' ? '2d' : '3d')}><Ionicons name={mode === '3d' ? 'map-outline' : 'globe-outline'} size={20} color={colors.text} /><Text style={styles.floatLabel}>{mode === '3d' ? '2D' : '3D'}</Text></Pressable>
      <Pressable accessibilityLabel="Recenter map on my position" style={styles.floatButton} onPress={() => setRefresh((value) => value + 1)}><Ionicons name="locate-outline" size={20} color={colors.text} /></Pressable>
    </View>
    <BottomSheet index={0} snapPoints={snapPoints} enablePanDownToClose={false} backgroundStyle={styles.sheet} handleIndicatorStyle={styles.handle} backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={1} disappearsOnIndex={0} opacity={0.22} />}>
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.sheetHeader}><View style={styles.pin}><Ionicons name="location" size={17} color={colors.maya} /></View><View style={{ flex: 1 }}><Text style={styles.sheetTitle}>{locationLabel}</Text><Text style={styles.sheetHint}>{location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}° · device location</Text></View><View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View></View>
        <View style={styles.divider} />
        <Text style={styles.quickTitle}>Map controls</Text>
        <View style={styles.quickRow}><QuickAction icon="globe-outline" title="3D globe" selected={mode === '3d'} onPress={() => setMode('3d')} /><QuickAction icon="map-outline" title="2D map" selected={mode === '2d'} onPress={() => setMode('2d')} /><QuickAction icon="locate-outline" title="Recenter" onPress={() => setRefresh((value) => value + 1)} /></View>
        <Text style={styles.footer}>Map data and source attribution are shown in the globe. Use the search box on the map to jump to a place.</Text>
      </BottomSheetView>
    </BottomSheet>
  </View>;
}
function QuickAction({ icon, title, selected, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; selected?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.quickAction, selected && styles.quickActionSelected]}><Ionicons name={icon} size={20} color={selected ? colors.maya : colors.muted} /><Text style={[styles.quickActionText, selected && { color: colors.text }]}>{title}</Text></Pressable>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.deep }, floating: { position: 'absolute', top: 16, right: 15, zIndex: 5, gap: 9 }, floatButton: { minWidth: 45, height: 45, borderRadius: 16, paddingHorizontal: 9, backgroundColor: '#102E4AEF', borderColor: '#FFFFFF30', borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }, floatLabel: { color: colors.text, fontSize: 10, fontWeight: '800' }, sheet: { backgroundColor: colors.deepRaised, borderColor: '#FFFFFF22', borderWidth: 1 }, handle: { backgroundColor: '#B7C6DA88', width: 42 }, sheetContent: { paddingHorizontal: 18, paddingBottom: 30 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 }, pin: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#55C1FF22', alignItems: 'center', justifyContent: 'center' }, sheetTitle: { color: colors.text, fontWeight: '800', fontSize: 14 }, sheetHint: { color: colors.muted, fontSize: 10, marginTop: 4 }, live: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#44D19A1F', borderRadius: 20 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }, liveText: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 13 }, quickTitle: { color: colors.text, fontWeight: '700', fontSize: 12 }, quickRow: { flexDirection: 'row', gap: 8, marginTop: 10 }, quickAction: { flex: 1, minHeight: 62, backgroundColor: '#FFFFFF08', borderColor: colors.line, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 4 }, quickActionSelected: { backgroundColor: '#55C1FF18', borderColor: '#55C1FF55' }, quickActionText: { color: colors.muted, fontSize: 10, fontWeight: '700' }, footer: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 11 } });
