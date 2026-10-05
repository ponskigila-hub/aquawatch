import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { ForecastScreen } from './src/screens/ForecastScreen';
import { HazardsScreen } from './src/screens/HazardsScreen';
import { OceanScreen } from './src/screens/OceanScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { MapScreen } from './src/screens/MapScreen';
import { WebRouteScreen } from './src/screens/WebRouteScreen';
import { useDeviceLocation } from './src/hooks/useDeviceLocation';
import { envApiBaseUrl, envWebAppBaseUrl, setApiBaseUrl, normalizeBaseUrl } from './src/services/api';
import { colors, type ScreenKey } from './src/theme';

const API_STORAGE_KEY = '@aquawatch/mobile-api-url';
const WEB_STORAGE_KEY = '@aquawatch/mobile-web-url';
const titles: Record<ScreenKey, string> = {
  overview: 'Overview', map: 'Global map', forecast: 'Forecast', hazards: 'Hazards', 'hazards-web': 'Hazard map', ocean: 'Ocean', 'ocean-web': 'Ocean explorer', more: 'More features',
  'air-quality': 'Air quality', history: 'History & climate', community: 'Community', tools: 'Data tools',
};
const tabs: Array<{ key: ScreenKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'overview', label: 'Overview', icon: 'home-outline' },
  { key: 'map', label: 'Map', icon: 'globe-outline' },
  { key: 'forecast', label: 'Forecast', icon: 'cloudy-outline' },
  { key: 'ocean', label: 'Ocean', icon: 'water-outline' },
  { key: 'more', label: 'More', icon: 'grid-outline' },
];

function AppShell() {
  const { location, usingDeviceLocation, status, requestLocation } = useDeviceLocation();
  const [screen, setScreen] = useState<ScreenKey>('overview');
  const [apiUrl, setApiUrl] = useState(envApiBaseUrl);
  const [webUrl, setWebUrl] = useState(envWebAppBaseUrl);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.multiGet([API_STORAGE_KEY, WEB_STORAGE_KEY]).then((values) => {
      if (!active) return;
      const storedApi = values[0]?.[1];
      const storedWeb = values[1]?.[1];
      const nextApi = storedApi !== null && storedApi !== undefined ? storedApi : envApiBaseUrl;
      const nextWeb = storedWeb !== null && storedWeb !== undefined ? storedWeb : envWebAppBaseUrl;
      setApiUrl(nextApi); setWebUrl(nextWeb); setApiBaseUrl(nextApi); setConfigReady(true);
    }).catch(() => { if (active) { setApiBaseUrl(envApiBaseUrl); setConfigReady(true); } });
    return () => { active = false; };
  }, []);

  const locationLabel = useMemo(() => status === 'loading' ? 'Finding your location…' : usingDeviceLocation ? 'Your location' : 'Jakarta fallback', [status, usingDeviceLocation]);
  const saveSettings = async (apiInput: string, webInput: string) => {
    const nextApi = normalizeBaseUrl(apiInput);
    const nextWeb = normalizeBaseUrl(webInput);
    await AsyncStorage.multiSet([[API_STORAGE_KEY, nextApi], [WEB_STORAGE_KEY, nextWeb]]);
    setApiBaseUrl(nextApi); setApiUrl(nextApi); setWebUrl(nextWeb);
  };
  const currentTab = ['air-quality', 'history', 'community', 'tools', 'hazards', 'hazards-web'].includes(screen) ? 'more' : screen === 'ocean-web' ? 'ocean' : screen;

  let content;
  if (screen === 'overview') content = <OverviewScreen location={location} locationLabel={locationLabel} onOpenMap={() => setScreen('map')} />;
  else if (screen === 'map') content = <MapScreen location={location} locationLabel={locationLabel} webUrl={configReady ? webUrl : ''} />;
  else if (screen === 'forecast') content = <ForecastScreen location={location} locationLabel={locationLabel} />;
  else if (screen === 'hazards') content = <HazardsScreen onOpenFull={() => setScreen('hazards-web')} />;
  else if (screen === 'ocean') content = <OceanScreen location={location} onOpenFull={() => setScreen('ocean-web')} />;
  else if (screen === 'ocean-web') content = <WebRouteScreen route="ocean" baseUrl={webUrl} location={location} />;
  else if (screen === 'more') content = <MoreScreen apiUrl={apiUrl} webUrl={webUrl} onSave={saveSettings} onNavigate={(next) => setScreen(next)} />;
  else if (screen === 'hazards-web') content = <WebRouteScreen route="hazards" baseUrl={webUrl} location={location} />;
  else content = <WebRouteScreen route={screen} baseUrl={webUrl} location={location} />;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <View style={styles.brandMark}><Ionicons name="water" color={colors.deep} size={20} /></View>
      <View style={{ flex: 1 }}><Text style={styles.brand}>AquaWatch</Text><Text style={styles.tagline}>{titles[screen] ?? 'Global environmental monitoring'}</Text></View>
      <Pressable accessibilityLabel="Refresh device location" onPress={() => void requestLocation()} style={styles.locationPill}><Ionicons name={usingDeviceLocation ? 'navigate' : 'location-outline'} size={13} color={usingDeviceLocation ? colors.green : colors.amber} /><Text numberOfLines={1} style={styles.locationPillText}>{status === 'loading' ? 'Locating' : usingDeviceLocation ? 'Near me' : 'Jakarta'}</Text></Pressable>
    </View>
    <View style={styles.body}>
      {!configReady && screen !== 'overview' && screen !== 'forecast' && screen !== 'hazards' && screen !== 'ocean' ? <View style={styles.configWait}><ActivityIndicator color={colors.maya} /><Text style={styles.helper}>Loading connection settings…</Text></View> : content}
    </View>
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const selected = currentTab === tab.key;
        return <Pressable key={tab.key} onPress={() => setScreen(tab.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected }}>
          <View style={[styles.tabIcon, selected && styles.tabIconActive]}><Ionicons name={tab.icon} size={19} color={selected ? colors.maya : colors.muted} /></View>
          <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><BottomSheetModalProvider><AppShell /></BottomSheetModalProvider></SafeAreaProvider></GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.deep },
  header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.deep, borderBottomColor: colors.line, borderBottomWidth: 1 },
  brandMark: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.maya, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 14, fontWeight: '900' }, tagline: { color: colors.muted, fontSize: 10, marginTop: 2 },
  locationPill: { maxWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#FFFFFF0D', borderColor: colors.line, borderWidth: 1, borderRadius: 18 },
  locationPillText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  body: { flex: 1, backgroundColor: colors.deep },
  tabBar: { minHeight: 59, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, backgroundColor: '#102E4A' },
  tab: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { height: 28, minWidth: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, tabIconActive: { backgroundColor: '#55C1FF1C' },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' }, tabLabelActive: { color: colors.maya, fontWeight: '800' },
  configWait: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, helper: { color: colors.muted, fontSize: 12 },
});
