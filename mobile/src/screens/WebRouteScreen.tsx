import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, type Coordinates, type ScreenKey } from '../theme';
import { buildFeatureUrl, buildMapUrl } from '../services/webRoutes';

const titleFor: Partial<Record<ScreenKey, string>> = { 'air-quality': 'Air quality', history: 'History & climate', community: 'Community', tools: 'Data tools', hazards: 'Hazards', ocean: 'Ocean', forecast: 'Forecast' };
const displayHost = (base: string) => { try { return new URL(base).host; } catch { return base.replace(/^https?:\/\//, '').split('/')[0] || 'not configured'; } };

export function WebRouteScreen({ route, baseUrl, location, mode = '3d', refresh = 0, onMapFallback }: { route: ScreenKey; baseUrl: string; location: Coordinates; mode?: '2d' | '3d'; refresh?: number; onMapFallback?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const url = route === 'map' ? buildMapUrl(baseUrl, location, mode, refresh) : buildFeatureUrl(baseUrl, route, location);
  const retry = () => { setLoadError(''); setHttpStatus(null); setLoading(true); setAttempt((value) => value + 1); };

  if (!url) return <View style={styles.setup}><View style={styles.icon}><Ionicons name="globe-outline" size={22} color={colors.maya} /></View><Text style={styles.title}>{route === 'map' ? '3D globe needs a dashboard connection' : `Connect to open ${titleFor[route] ?? 'AquaWatch'}`}</Text><Text style={styles.detail}>Set your Expo Web app URL in More → Backend & dashboard connection. Use a reachable LAN IP address while on the same Wi-Fi, or use an HTTPS tunnel. The phone must be able to open that address.</Text>{onMapFallback ? <Pressable onPress={onMapFallback} style={styles.action}><Ionicons name="map-outline" size={17} color={colors.deep} /><Text style={styles.actionText}>Use the local 2D map</Text></Pressable> : null}</View>;

  if (loadError) return <View style={styles.setup}><View style={[styles.icon, { backgroundColor: '#F4B54422' }]}><Ionicons name="cloud-offline-outline" size={22} color={colors.amber} /></View><Text style={styles.title}>{route === 'map' ? '3D globe could not load' : `${titleFor[route] ?? 'Page'} could not load`}</Text><Text style={styles.detail}>{httpStatus ? `The dashboard returned HTTP ${httpStatus}.` : 'The phone could not reach the dashboard address.'} Check that the dashboard is running, the URL is correct, and your phone is allowed to reach it over Wi-Fi or HTTPS.</Text><Text selectable style={styles.host}>Dashboard: {displayHost(baseUrl)}</Text>{loadError ? <Text style={styles.errorDetail}>{loadError}</Text> : null}<View style={styles.actions}><Pressable onPress={retry} style={styles.action}><Ionicons name="refresh" size={16} color={colors.deep} /><Text style={styles.actionText}>Try again</Text></Pressable>{onMapFallback ? <Pressable onPress={onMapFallback} style={[styles.action, styles.secondary]}><Ionicons name="map-outline" size={16} color={colors.maya} /><Text style={[styles.actionText, styles.secondaryText]}>Use local 2D map</Text></Pressable> : null}</View></View>;

  return <View style={styles.container}>
    <WebView key={`${url}:${attempt}`} source={{ uri: url }} javaScriptEnabled domStorageEnabled sharedCookiesEnabled originWhitelist={['http://*', 'https://*']} mixedContentMode="compatibility" androidLayerType="hardware" allowsInlineMediaPlayback setSupportMultipleWindows={false} onLoadStart={() => { setLoading(true); setLoadError(''); }} onLoadEnd={() => setLoading(false)} onError={({ nativeEvent }) => { setLoading(false); setLoadError(nativeEvent.description || `Network error ${nativeEvent.code ?? ''}`.trim()); }} onHttpError={({ nativeEvent }) => { const path = url.split('?')[0]; if (nativeEvent.url?.startsWith(path) && nativeEvent.statusCode >= 400) { setHttpStatus(nativeEvent.statusCode); setLoadError(`Dashboard request failed with HTTP ${nativeEvent.statusCode}.`); } }} renderLoading={() => <View style={styles.loader}><ActivityIndicator color={colors.maya} /><Text style={styles.detail}>Loading {titleFor[route] ?? 'map'}…</Text></View>} renderError={() => <View style={styles.loader}><ActivityIndicator color={colors.maya} /><Text style={styles.detail}>Connecting to the AquaWatch dashboard…</Text></View>} />
    {loading ? <View pointerEvents="none" style={styles.loadingMask}><ActivityIndicator color={colors.maya} /></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.deep },
  setup: { flex: 1, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', padding: 26 },
  icon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#55C1FF20', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 9 },
  host: { color: colors.maya, fontSize: 11, textAlign: 'center', marginTop: 12 },
  errorDetail: { color: '#FFD6DC', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  action: { marginTop: 16, minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.maya },
  actionText: { color: colors.deep, fontSize: 12, fontWeight: '900' }, secondary: { backgroundColor: 'transparent', borderColor: '#55C1FF55', borderWidth: 1 }, secondaryText: { color: colors.maya },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deep, gap: 10 },
  loadingMask: { position: 'absolute', top: 20, right: 16, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102E4ADD' },
});
