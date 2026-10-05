import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, type Coordinates, type ScreenKey } from '../theme';
import { buildFeatureUrl, buildMapUrl } from '../services/webRoutes';

const titleFor: Partial<Record<ScreenKey, string>> = { 'air-quality': 'Air quality', history: 'History & climate', community: 'Community', tools: 'Data tools', hazards: 'Hazards', ocean: 'Ocean', forecast: 'Forecast' };
export function WebRouteScreen({ route, baseUrl, location, mode = '3d', refresh = 0 }: { route: ScreenKey; baseUrl: string; location: Coordinates; mode?: '2d' | '3d'; refresh?: number }) {
  const [loading, setLoading] = useState(true);
  const url = route === 'map' ? buildMapUrl(baseUrl, location, mode, refresh) : buildFeatureUrl(baseUrl, route, location);
  if (!url) return <View style={styles.setup}><Text style={styles.title}>{route === 'map' ? 'Connect the interactive globe' : `Open ${titleFor[route] ?? 'AquaWatch'}`}</Text><Text style={styles.detail}>Set your Expo Web app URL in More → Backend settings. Use the same computer's LAN IP (for example http://192.168.1.25:8080) or a public HTTPS web tunnel URL. The phone must be able to reach that address.</Text></View>;
  return <View style={styles.container}>
    <WebView key={url} source={{ uri: url }} javaScriptEnabled domStorageEnabled sharedCookiesEnabled originWhitelist={['http://*', 'https://*']} mixedContentMode="compatibility" androidLayerType="hardware" allowsInlineMediaPlayback setSupportMultipleWindows={false} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} startInLoadingState renderLoading={() => <View style={styles.loader}><ActivityIndicator color={colors.maya} /><Text style={styles.detail}>Loading {titleFor[route] ?? 'map'}…</Text></View>} onError={() => setLoading(false)} />
    {loading ? <View pointerEvents="none" style={styles.loadingMask}><ActivityIndicator color={colors.maya} /></View> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.deep }, setup: { flex: 1, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', padding: 28 }, title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }, detail: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 9 }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deep, gap: 10 }, loadingMask: { position: 'absolute', top: 20, right: 16, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102E4ADD' } });
