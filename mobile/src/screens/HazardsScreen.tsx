import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNearbyEarthquakes, fetchNearbyEonetEvents } from '../services/environmental';
import type { Coordinates, Earthquake, NearbyEonetEvent } from '../theme';
import { colors } from '../theme';
import { Panel, SectionTitle } from '../components/Ui';

const distance = (km: number) => km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
const eventDate = (value: string) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Date not reported';

export function HazardsScreen({ location, locationLabel, onOpenFull }: { location: Coordinates; locationLabel: string; onOpenFull: () => void }) {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [events, setEvents] = useState<NearbyEonetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [quakeError, setQuakeError] = useState('');
  const [eventError, setEventError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const latitude = location.latitude;
  const longitude = location.longitude;

  useEffect(() => {
    let active = true;
    setLoading(true); setQuakeError(''); setEventError('');
    const point = { latitude, longitude };
    fetchNearbyEarthquakes(point).then((items) => { if (active) setEarthquakes(items); }).catch(() => { if (active) setQuakeError('The USGS earthquake catalogue is temporarily unavailable.'); });
    fetchNearbyEonetEvents(point).then((items) => { if (active) setEvents(items); }).catch(() => { if (active) setEventError('NASA natural-event data is temporarily unavailable.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [latitude, longitude, refreshKey]);

  const open = useCallback((url: string) => { void Linking.openURL(url).catch(() => undefined); }, []);
  const tsunamiEvents = earthquakes.filter((quake) => quake.tsunamiRelated);

  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshKey((key) => key + 1)} tintColor={colors.maya} />}>
    <Text style={styles.eyebrow}>LOCAL DISASTER WATCH</Text><Text style={styles.title}>Hazards near you</Text><Text style={styles.subtitle}>{locationLabel} · {latitude.toFixed(2)}°, {longitude.toFixed(2)}°</Text>
    <View style={styles.summaryRow}><Panel style={styles.summary}><Ionicons name="pulse-outline" color={colors.amber} size={18} /><Text style={styles.summaryValue}>{earthquakes.length}</Text><Text style={styles.summaryLabel}>earthquakes within 500 km · 7 days</Text></Panel><Panel style={styles.summary}><Ionicons name="earth-outline" color={colors.periwinkle} size={18} /><Text style={styles.summaryValue}>{events.length}</Text><Text style={styles.summaryLabel}>tracked events within 1,000 km</Text></Panel></View>
    <Pressable onPress={onOpenFull} style={styles.mapLink}><Ionicons name="map-outline" size={19} color={colors.deep} /><Text style={styles.mapLinkText}>Open full hazard map</Text><Ionicons name="arrow-forward" size={17} color={colors.deep} /></Pressable>

    <SectionTitle title="Nearby earthquakes" detail="USGS catalogue · within 500 km in the past 7 days" />
    {loading && earthquakes.length === 0 ? <ActivityIndicator color={colors.maya} style={{ margin: 20 }} /> : null}
    {quakeError ? <Panel><Text style={styles.subtitle}>{quakeError}</Text></Panel> : null}
    {earthquakes.map((quake) => <QuakeRow key={quake.id} quake={quake} onPress={() => open(quake.url)} />)}
    {!loading && !quakeError && earthquakes.length === 0 ? <Panel style={styles.empty}><Ionicons name="checkmark-circle-outline" size={23} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.emptyTitle}>No recent earthquakes found nearby</Text><Text style={styles.meta}>No USGS catalogue events within 500 km for this 7-day search.</Text></View></Panel> : null}

    <SectionTitle title="Tsunami-related records" detail="An earthquake catalogue flag is not an active tsunami warning" />
    {tsunamiEvents.length ? tsunamiEvents.map((quake) => <Pressable key={`tsunami-${quake.id}`} onPress={() => open(quake.url)}><Panel style={styles.tsunami}><Ionicons name="warning-outline" size={19} color={colors.amber} /><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{quake.place}</Text><Text style={styles.meta}>M{quake.magnitude.toFixed(1)} · {distance(quake.distanceKm ?? 0)} · USGS tsunami field marked</Text></View><Ionicons name="open-outline" size={16} color={colors.muted} /></Panel></Pressable>) : <Panel><Text style={styles.meta}>No nearby earthquakes in this result are marked tsunami-related by USGS. This is not a tsunami safety clearance.</Text></Panel>}
    <Pressable onPress={() => open('https://www.tsunami.gov/')} style={styles.officialLink}><Ionicons name="shield-checkmark-outline" size={17} color={colors.maya} /><Text style={styles.officialText}>Check official tsunami bulletins</Text><Ionicons name="open-outline" size={15} color={colors.maya} /></Pressable>

    <SectionTitle title="Other tracked natural events" detail="NASA EONET open events within 1,000 km · includes landslides when catalogued" />
    {eventError ? <Panel><Text style={styles.subtitle}>{eventError}</Text></Panel> : null}
    {events.map((event) => <Pressable key={event.id} onPress={() => open(event.url)}><Panel style={styles.event}><View style={styles.categoryIcon}><Ionicons name={iconFor(event.category)} size={18} color={colors.maya} /></View><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.meta}>{event.category} · {distance(event.distanceKm)} away · {eventDate(event.occurredAt)}</Text></View><Ionicons name="open-outline" size={16} color={colors.muted} /></Panel></Pressable>)}
    {!loading && !eventError && events.length === 0 ? <Panel><Text style={styles.meta}>No open NASA EONET events were returned within 1,000 km. This feed does not cover every local emergency; check local authorities for current conditions.</Text></Panel> : null}
    {loading ? <ActivityIndicator color={colors.maya} style={{ margin: 12 }} /> : null}
    <Text style={styles.disclaimer}>USGS earthquake records and NASA EONET reports are informational, not emergency alerts. Tsunami warnings come from official authorities. Local landslide, flood, storm or wildfire conditions may not appear here.</Text>
  </ScrollView>;
}

function QuakeRow({ quake, onPress }: { quake: Earthquake; onPress: () => void }) {
  return <Pressable onPress={onPress}><Panel style={styles.quake}><View style={styles.mag}><Text style={styles.magText}>{quake.magnitude.toFixed(1)}</Text><Text style={styles.magLabel}>MAG</Text></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={styles.place}>{quake.place}</Text><Text style={styles.meta}>{distance(quake.distanceKm ?? 0)} · {quake.depthKm.toFixed(0)} km deep · {new Date(quake.occurredAt).toLocaleDateString()}</Text>{quake.tsunamiRelated ? <Text style={styles.flag}>USGS tsunami-related record</Text> : null}</View><Ionicons name="open-outline" size={17} color={colors.muted} /></Panel></Pressable>;
}

function iconFor(category: string): React.ComponentProps<typeof Ionicons>['name'] {
  const label = category.toLowerCase();
  if (label.includes('landslide')) return 'trail-sign-outline';
  if (label.includes('flood')) return 'water-outline';
  if (label.includes('storm')) return 'thunderstorm-outline';
  if (label.includes('fire')) return 'flame-outline';
  if (label.includes('volcano')) return 'flame';
  return 'alert-circle-outline';
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, summary: { flex: 1, padding: 12, marginBottom: 0, minHeight: 100 }, summaryValue: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 7 }, summaryLabel: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.maya, padding: 13, borderRadius: 15, marginVertical: 16 }, mapLinkText: { flex: 1, color: colors.deep, fontSize: 13, fontWeight: '800' },
  quake: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, marginBottom: 8 }, mag: { width: 49, height: 49, backgroundColor: '#F4B54422', borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, magText: { color: colors.amber, fontSize: 17, fontWeight: '900' }, magLabel: { color: colors.muted, fontSize: 8, letterSpacing: 1 }, place: { color: colors.text, fontSize: 12, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, flag: { color: colors.amber, fontSize: 9, fontWeight: '700', marginTop: 4 },
  tsunami: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 }, event: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8 }, eventTitle: { color: colors.text, fontSize: 12, fontWeight: '700' }, categoryIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#55C1FF20', alignItems: 'center', justifyContent: 'center' },
  officialLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 13, borderColor: '#55C1FF55', borderWidth: 1, marginTop: 8 }, officialText: { color: colors.maya, fontSize: 11, fontWeight: '800' }, empty: { flexDirection: 'row', alignItems: 'center', gap: 10 }, emptyTitle: { color: colors.text, fontSize: 12, fontWeight: '700' }, disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
