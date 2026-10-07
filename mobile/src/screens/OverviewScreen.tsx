import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAirQuality, fetchWeather, weatherDescription, weatherGlyph } from '../services/environmental';
import { colors, type AirQualitySnapshot, type Coordinates, type WeatherSnapshot } from '../theme';
import { Panel } from '../components/Ui';
import { WeatherMetrics } from '../components/WeatherMetrics';

const value = (number: number | null | undefined, suffix = '') => number === null || number === undefined ? '—' : `${Math.round(number)}${suffix}`;

export function OverviewScreen({ location, locationLabel, onOpenMap }: { location: Coordinates; locationLabel: string; onOpenMap: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const latitude = location.latitude;
  const longitude = location.longitude;

  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    const point = { latitude, longitude };
    fetchWeather(point).then((result) => { if (active) setWeather(result); })
      .catch(() => { if (active) setError('Live forecast could not be loaded. Check your internet connection and try again.'); })
      .finally(() => { if (active) setBusy(false); });
    fetchAirQuality(point).then((result) => { if (active) setAirQuality(result); }).catch(() => { if (active) setAirQuality(null); });
    return () => { active = false; };
  }, [latitude, longitude, refreshKey]);

  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => setRefreshKey((key) => key + 1)} tintColor={colors.maya} />}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>LOCAL WEATHER</Text><Text style={styles.location}>{locationLabel}</Text><Text style={styles.coordinate}>{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°</Text></View><Ionicons name="navigate-circle" size={34} color={colors.maya} /></View>
    <Panel style={styles.hero}>
      <View style={styles.heroTop}><View><Text style={styles.heroLabel}>Current conditions</Text><Text style={styles.heroPlace}>{locationLabel}</Text></View><Text style={styles.glyph}>{weatherGlyph(weather?.weatherCode ?? null)}</Text></View>
      {busy && !weather ? <ActivityIndicator color={colors.maya} style={{ marginVertical: 28 }} /> : error && !weather ? <Text style={styles.error}>{error}</Text> : <>
        <View style={styles.temperatureRow}><Text style={styles.temperature}>{value(weather?.temperatureC, '°')}</Text><View style={styles.condition}><Text style={styles.conditionText}>{weatherDescription(weather?.weatherCode ?? null)}</Text><Text style={styles.heroHint}>Feels like {value(weather?.feelsLikeC, '°')} · High {value(weather?.highC, '°')} / Low {value(weather?.lowC, '°')}</Text></View></View>
        <Text style={styles.heroHint}>{weather?.time ? `Model update ${new Date(weather.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Pull down to refresh` : 'Weather estimates · pull down to refresh'}</Text>
      </>}
    </Panel>
    {weather ? <WeatherMetrics weather={weather} airQuality={airQuality} /> : null}
    <Pressable accessibilityRole="button" onPress={onOpenMap}>
      <Panel style={styles.mapCta}><View style={{ flex: 1 }}><Text style={styles.mapTitle}>Explore the live risk map</Text><Text style={styles.heroHint}>Open the local map or switch to the 3D globe.</Text></View><Ionicons name="arrow-forward-circle" size={30} color={colors.maya} /></Panel>
    </Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.disclaimer}>Weather and air-quality values are model estimates, not official warnings or ground-monitor readings.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  eyebrow: { color: colors.maya, letterSpacing: 1.6, fontSize: 10, fontWeight: '800' },
  location: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  coordinate: { color: colors.muted, fontSize: 11, marginTop: 3 },
  hero: { padding: 18, backgroundColor: '#173B5B', borderColor: '#55C1FF33' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: colors.muted, fontSize: 12 }, heroPlace: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 4 }, glyph: { color: colors.amber, fontSize: 40 },
  temperatureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 6 },
  temperature: { color: colors.text, fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  condition: { flex: 1 }, conditionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  heroHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  mapCta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }, mapTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  error: { color: '#FFD6DC', fontSize: 12, lineHeight: 18, marginVertical: 8 }, disclaimer: { color: colors.muted, fontSize: 10, marginTop: 10, textAlign: 'center', lineHeight: 16 },
});
