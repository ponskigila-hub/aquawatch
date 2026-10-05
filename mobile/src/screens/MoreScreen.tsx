import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkBackend } from '../services/environmental';
import { api } from '../services/api';
import { colors, type ScreenKey } from '../theme';
import { Panel } from '../components/Ui';

const features: Array<{ key: ScreenKey; title: string; detail: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'hazards', title: 'Hazards', detail: 'USGS earthquakes and reported event map', icon: 'warning-outline' },
  { key: 'air-quality', title: 'Air quality', detail: 'Global air metrics and source notes', icon: 'leaf-outline' },
  { key: 'history', title: 'History & climate', detail: 'Historical archive and climate baseline', icon: 'time-outline' },
  { key: 'community', title: 'Community', detail: 'Local reports and personal risk thresholds', icon: 'people-outline' },
  { key: 'tools', title: 'Data tools', detail: 'Solar view, GIS export, and orbit recording', icon: 'construct-outline' },
];

export function MoreScreen({ apiUrl, webUrl, onSave, onNavigate }: { apiUrl: string; webUrl: string; onSave: (apiUrl: string, webUrl: string) => Promise<void>; onNavigate: (screen: ScreenKey) => void }) {
  const [apiInput, setApiInput] = useState(apiUrl);
  const [webInput, setWebInput] = useState(webUrl);
  const [saving, setSaving] = useState(false);
  const [apiStatus, setApiStatus] = useState('Checking backend…');
  const [online, setOnline] = useState(false);
  useEffect(() => { setApiInput(apiUrl); setWebInput(webUrl); }, [apiUrl, webUrl]);
  useEffect(() => { let active = true; checkBackend().then((result) => { if (active) { setApiStatus(result.message); setOnline(result.online); } }); return () => { active = false; }; }, [apiUrl]);
  const save = async () => {
    setSaving(true);
    try { await onSave(apiInput.trim(), webInput.trim()); Alert.alert('Settings saved', 'The app will use these URLs for API requests and embedded web pages.'); }
    catch { Alert.alert('Could not save settings', 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>AQUAWATCH</Text><Text style={styles.title}>Explore features</Text><Text style={styles.subtitle}>More environmental tools from your desktop dashboard.</Text>
    {features.map((item) => <Pressable key={item.key} onPress={() => onNavigate(item.key)}><Panel style={styles.feature}><View style={styles.icon}><Ionicons name={item.icon} size={19} color={colors.maya} /></View><View style={{ flex: 1 }}><Text style={styles.featureTitle}>{item.title}</Text><Text style={styles.featureDetail}>{item.detail}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Panel></Pressable>)}
    <Text style={styles.settingsTitle}>Backend & dashboard connection</Text>
    <Panel>
      <View style={styles.statusRow}><View style={[styles.dot, { backgroundColor: online ? colors.green : colors.amber }]} /><Text style={styles.statusText}>{apiStatus}</Text></View>
      <Text style={styles.fieldLabel}>FastAPI base URL</Text><TextInput value={apiInput} onChangeText={setApiInput} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.25:8000" placeholderTextColor="#B7C6DA77" style={styles.input} />
      <Text style={styles.fieldLabel}>Web dashboard URL</Text><TextInput value={webInput} onChangeText={setWebInput} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.25:8080" placeholderTextColor="#B7C6DA77" style={styles.input} />
      <Pressable disabled={saving} onPress={save} style={styles.save}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save connection'}</Text></Pressable>
      <Text style={styles.help}>Use the same computer’s LAN IPv4 while on the same Wi‑Fi, or use your own HTTPS Dev Tunnel/ngrok addresses. The API and website may use different URLs. Saved URLs stay in this app’s local preferences; no credentials belong here.</Text>
    </Panel>
    <Text style={styles.small}>AquaWatch · environmental awareness, not official emergency response.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 25 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.6, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, marginBottom: 15 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, marginBottom: 8 }, icon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#55C1FF1F' }, featureTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, featureDetail: { color: colors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 }, settingsTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 10, marginBottom: 9 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 }, dot: { width: 8, height: 8, borderRadius: 4 }, statusText: { color: colors.muted, fontSize: 11 }, fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 6 }, input: { backgroundColor: '#102E4A', borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, fontSize: 12 }, save: { backgroundColor: colors.maya, alignItems: 'center', borderRadius: 12, paddingVertical: 12, marginTop: 13 }, saveText: { color: colors.deep, fontWeight: '900', fontSize: 12 }, help: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 11 }, small: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 15 } });
