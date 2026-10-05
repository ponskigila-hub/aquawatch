import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchMarine, fetchOisst } from '../services/environmental';
import { api } from '../services/api';
import type { Coordinates, MarineSnapshot } from '../theme';
import { colors } from '../theme';
import { MetricTile, Panel, SectionTitle } from '../components/Ui';

const value = (number: number | null | undefined, unit: string) => number === null || number === undefined ? '—' : `${number.toFixed(1)} ${unit}`;
export function OceanScreen({ location, onOpenFull }: { location: Coordinates; onOpenFull: () => void }) {
  const [marine, setMarine] = useState<MarineSnapshot | null>(null);
  const [sst, setSst] = useState<MarineSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [marineError, setMarineError] = useState('');
  const [sstMessage, setSstMessage] = useState('');
  const latitude = location.latitude;
  const longitude = location.longitude;
  useEffect(() => {
    let active = true; setLoading(true); setMarineError('');
    const point = { latitude, longitude };
    Promise.allSettled([fetchMarine(point), fetchOisst(point)]).then(([waveResult, sstResult]) => {
      if (!active) return;
      if (waveResult.status === 'fulfilled') setMarine(waveResult.value); else { setMarine(null); setMarineError('Wave/current forecast is not available for this position (for example, inland locations).'); }
      if (sstResult.status === 'fulfilled' && sstResult.value) { setSst(sstResult.value); setSstMessage(''); }
      else { setSst(null); setSstMessage(api.defaults.baseURL ? 'NOAA SST could not be loaded from the configured API.' : 'Set an API URL in More to enable NOAA SST samples.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [latitude, longitude]);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MARINE CONDITIONS</Text><Text style={styles.title}>Ocean near you</Text><Text style={styles.subtitle}>Live model samples near {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°.</Text>
    {loading ? <ActivityIndicator color={colors.maya} style={{ margin: 20 }} /> : null}
    <SectionTitle title="Marine forecast" detail="Open-Meteo model · current sample and local forecast time" />
    {marine ? <>
      <View style={styles.row}><MetricTile icon={<Ionicons name="water-outline" size={17} color={colors.maya} />} label="Wave height" value={value(marine.waveHeightM, 'm')} tone={colors.maya} /><MetricTile icon={<Ionicons name="water" size={17} color={colors.cornflower} />} label="Swell" value={value(marine.swellHeightM, 'm')} tone={colors.cornflower} /></View>
      <View style={styles.row}><MetricTile icon={<Ionicons name="navigate-outline" size={17} color={colors.periwinkle} />} label="Current speed" value={value(marine.currentKmh, 'km/h')} tone={colors.periwinkle} /><MetricTile icon={<Ionicons name="compass-outline" size={17} color={colors.amber} />} label="Wave direction" value={marine.waveDirection === null ? '—' : `${Math.round(marine.waveDirection)}°`} tone={colors.amber} /></View>
    </> : <Panel><Text style={styles.subtitle}>{marineError || 'Marine conditions are unavailable.'}</Text></Panel>}
    <SectionTitle title="Sea-surface temperature" detail="Daily NOAA analysis · served through your FastAPI backend" />
    {sst ? <Panel style={styles.sst}><View style={styles.rowBetween}><View><Text style={styles.muted}>Sea-surface temperature</Text><Text style={styles.big}>{value(sst.seaSurfaceC, '°C')}</Text></View><View style={styles.anomalyBadge}><Text style={styles.anomaly}>{sst.anomalyC == null ? '—' : `${sst.anomalyC > 0 ? '+' : ''}${sst.anomalyC.toFixed(1)}°`}</Text><Text style={styles.muted}>anomaly</Text></View></View><Text style={styles.caption}>NOAA source date: {sst.sstDate || 'not reported'} · ocean sample only</Text></Panel> : <Panel><Text style={styles.subtitle}>{sstMessage}</Text></Panel>}
    <Text style={styles.disclaimer}>Wave and current values are model estimates, not buoy readings. Temperature at an inland device location may be unavailable. Not for navigation or official marine warnings.</Text>
    <Pressable accessibilityRole="button" onPress={onOpenFull} style={styles.fullMap}><Ionicons name="globe-outline" size={17} color={colors.deep} /><Text style={styles.fullMapText}>Open interactive ocean map</Text><Ionicons name="arrow-forward" size={16} color={colors.deep} /></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 28 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, row: { flexDirection: 'row', gap: 9, marginBottom: 9 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sst: { borderColor: '#A682FF55' }, muted: { color: colors.muted, fontSize: 11 }, big: { color: colors.text, fontSize: 29, fontWeight: '900', marginTop: 4 }, anomalyBadge: { alignItems: 'center', backgroundColor: '#A682FF1E', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14 }, anomaly: { color: colors.periwinkle, fontSize: 16, fontWeight: '800' }, caption: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 13 }, disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 12 }, fullMap: { marginTop: 14, minHeight: 48, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.maya, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, fullMapText: { color: colors.deep, fontSize: 12, fontWeight: '900' } });
