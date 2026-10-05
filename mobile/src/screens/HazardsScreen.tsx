import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchEarthquakes } from '../services/environmental';
import type { Earthquake } from '../theme';
import { colors } from '../theme';
import { Panel, SectionTitle } from '../components/Ui';

export function HazardsScreen({ onOpenFull }: { onOpenFull: () => void }) {
  const [items, setItems] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; fetchEarthquakes().then((result) => { if (active) setItems(result); }).catch(() => { if (active) setError('USGS earthquake feed is temporarily unavailable.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>LIVE NATURAL HAZARDS</Text><Text style={styles.title}>Earthquakes & events</Text><Text style={styles.subtitle}>Recent global earthquake reports from the USGS.</Text>
    <Pressable onPress={onOpenFull} style={styles.mapLink}><Ionicons name="map-outline" size={19} color={colors.deep} /><Text style={styles.mapLinkText}>Open full hazard map</Text><Ionicons name="arrow-forward" size={17} color={colors.deep} /></Pressable>
    <SectionTitle title="Earthquakes in the past 24 hours" detail={`${items.length} strongest reports shown · USGS`} />
    {loading ? <ActivityIndicator color={colors.maya} style={{ margin: 26 }} /> : null}
    {error ? <Panel><Text style={styles.subtitle}>{error}</Text></Panel> : null}
    {items.map((quake) => <Pressable key={quake.id} onPress={() => Linking.openURL(quake.url)}><Panel style={styles.quake}><View style={styles.mag}><Text style={styles.magText}>{quake.magnitude.toFixed(1)}</Text><Text style={styles.magLabel}>MAG</Text></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={styles.place}>{quake.place}</Text><Text style={styles.meta}>{new Date(quake.occurredAt).toLocaleString()} · {quake.depthKm.toFixed(0)} km deep</Text></View><Ionicons name="open-outline" size={17} color={colors.muted} /></Panel></Pressable>)}
    {!loading && !error && items.length === 0 ? <Panel><Text style={styles.subtitle}>No earthquake reports were returned by the source.</Text></Panel> : null}
    <Text style={styles.disclaimer}>USGS event records are not tsunami warnings. Follow official local emergency guidance. Thermal satellite detections require backend FIRMS configuration.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 28 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.maya, padding: 13, borderRadius: 15, marginVertical: 16 }, mapLinkText: { flex: 1, color: colors.deep, fontSize: 13, fontWeight: '800' }, quake: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, marginBottom: 8 }, mag: { width: 52, height: 52, backgroundColor: '#F4B54422', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, magText: { color: colors.amber, fontSize: 18, fontWeight: '900' }, magLabel: { color: colors.muted, fontSize: 8, letterSpacing: 1 }, place: { color: colors.text, fontSize: 13, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 10, marginTop: 5 }, disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 12 } });
