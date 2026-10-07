import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, type Coordinates, type Earthquake, type NearbyEonetEvent } from '../theme';
import { fetchNearbyEarthquakes, fetchNearbyEonetEvents, searchLocation } from '../services/environmental';
import { WebRouteScreen } from './WebRouteScreen';

interface MapPoint { latitude: number; longitude: number; }

function buildLocalMapHtml(center: MapPoint, earthquakes: Earthquake[], events: NearbyEonetEvent[]) {
  const payload = JSON.stringify({
    center,
    earthquakes: earthquakes.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ lat: item.latitude, lng: item.longitude, magnitude: item.magnitude, place: item.place, depth: item.depthKm, tsunami: item.tsunamiRelated })),
    events: events.map((item) => ({ lat: item.latitude, lng: item.longitude, title: item.title, category: item.category, distance: item.distanceKm })),
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="color-scheme" content="dark">
<link id="leaflet-css" rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{box-sizing:border-box}html,body,#map{height:100%;width:100%;padding:0;margin:0;background:#102e4a;font-family:system-ui,-apple-system,sans-serif}.leaflet-container{background:#102e4a}.leaflet-control-attribution{font-size:9px!important;background:#102e4ad9!important;color:#eaf4ff!important}.leaflet-control-attribution a{color:#55c1ff!important}.leaflet-control-zoom a{background:#102e4a!important;color:#f6f7ff!important;border-color:#ffffff35!important}.pin{width:20px;height:20px;border:3px solid white;border-radius:50%;background:#55c1ff;box-shadow:0 0 0 7px #55c1ff55,0 2px 9px #00152d}.status{position:absolute;z-index:1000;top:42%;left:9%;right:9%;padding:14px;border-radius:15px;background:#102e4aee;border:1px solid #ffffff30;color:#f6f7ff;text-align:center;font-size:13px;line-height:1.5}.popup{color:#102e4a;font:13px system-ui;line-height:1.4}.popup small{color:#536b7d}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#f6f7ff}
</style></head><body>
<div id="map"></div><div id="status" class="status">Loading map tiles…</div>
<script>window.AW_DATA=${payload};</script>
<script>
(function(){
  var status=document.getElementById('status');
  function notify(message){try{window.ReactNativeWebView.postMessage(message)}catch(e){}}
  function report(message){status.style.display='block';status.textContent=message;notify('map-error:'+message)}
  function esc(value){return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function init(){
    if(!window.L){report('Map renderer could not be loaded. Check your internet connection and tap Reload.');return}
    try{
      var data=window.AW_DATA;
      var map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([data.center.latitude,data.center.longitude],8);
      var tileFailures=0,hasTile=false;
      var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
      tiles.on('tileerror',function(){tileFailures++;if(tileFailures>=3&&!hasTile)report('OpenStreetMap tiles are unavailable. Check your phone internet connection and tap Reload.')});
      tiles.on('tileload',function(){if(!hasTile){hasTile=true;status.style.display='none';notify('map-ready')}});
      tiles.addTo(map);
      var pin=L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[20,20],iconAnchor:[10,10]});
      L.marker([data.center.latitude,data.center.longitude],{icon:pin,zIndexOffset:1000}).addTo(map).bindPopup('<b>Your selected location</b>');
      data.earthquakes.forEach(function(q){
        var color=q.magnitude>=5?'#ff7180':q.magnitude>=3?'#f4b544':'#5887ff';
        var marker=L.circleMarker([q.lat,q.lng],{radius:Math.max(5,Math.min(13,4+q.magnitude*1.2)),color:color,fillColor:color,fillOpacity:.75,weight:2}).addTo(map);
        marker.bindPopup('<div class="popup"><b>M'+Number(q.magnitude).toFixed(1)+' earthquake</b><br>'+esc(q.place)+'<br><small>'+Number(q.depth).toFixed(0)+' km deep'+(q.tsunami?' · USGS tsunami-related flag':'')+'</small></div>');
      });
      data.events.forEach(function(event){
        var marker=L.circleMarker([event.lat,event.lng],{radius:7,color:'#a682ff',fillColor:'#a682ff',fillOpacity:.78,weight:2}).addTo(map);
        marker.bindPopup('<div class="popup"><b>'+esc(event.title)+'</b><br>'+esc(event.category)+'<br><small>'+Math.round(event.distance)+' km away</small></div>');
      });
      setTimeout(function(){map.invalidateSize()},300);
      window.awRecenter=function(){map.setView([window.AW_DATA.center.latitude,window.AW_DATA.center.longitude],8)};
    }catch(e){report('The map could not start. Tap Reload to try again.')}
  }
  var css=document.getElementById('leaflet-css');
  css.onerror=function(){css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'};
  function load(index){
    var urls=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'];
    var script=document.createElement('script');script.src=urls[index];script.onload=init;
    script.onerror=function(){if(index+1<urls.length)load(index+1);else report('Could not download the map library. Check your phone internet connection and tap Reload.')};
    document.head.appendChild(script);
  }
  load(0);
})();
</script></body></html>`;
}

export function MapScreen({ location, locationLabel, webUrl }: { location: Coordinates; locationLabel: string; webUrl: string }) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [searched, setSearched] = useState<(Coordinates & { name: string }) | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [events, setEvents] = useState<NearbyEonetEvent[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapMessage, setMapMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const webView = useRef<WebView>(null);
  const center = searched ?? location;
  const mapLatitude = center.latitude;
  const mapLongitude = center.longitude;
  const centerLabel = searched?.name ?? locationLabel;

  useEffect(() => {
    let active = true;
    setMapState('loading'); setMapMessage(''); setLoadingRisks(true); setEarthquakes([]); setEvents([]);
    const point = { latitude: mapLatitude, longitude: mapLongitude };
    fetchNearbyEarthquakes(point).then((items) => { if (active) setEarthquakes(items); }).catch(() => { if (active) setEarthquakes([]); });
    fetchNearbyEonetEvents(point).then((items) => { if (active) setEvents(items); }).catch(() => { if (active) setEvents([]); }).finally(() => { if (active) setLoadingRisks(false); });
    return () => { active = false; };
  }, [mapLatitude, mapLongitude, refreshKey]);

  const html = useMemo(() => buildLocalMapHtml({ latitude: mapLatitude, longitude: mapLongitude }, earthquakes, events), [mapLatitude, mapLongitude, earthquakes, events]);
  const doSearch = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true); setSearchError('');
    try { const result = await searchLocation(term); setSearched(result); setMode('2d'); }
    catch { setSearchError('Place not found. Try a city name or check your connection.'); }
    finally { setSearching(false); }
  };
  const onMapMessage = (event: WebViewMessageEvent) => {
    const message = event.nativeEvent.data;
    if (message === 'map-ready') { setMapState('ready'); setMapMessage(''); }
    else if (message.startsWith('map-error:')) { setMapState('error'); setMapMessage(message.slice(10)); }
  };
  const recenter = () => { setSearched(null); setMapState('loading'); setRefreshKey((key) => key + 1); };

  return <View style={styles.root}>
    {mode === '2d' ? <WebView key={`${mapLatitude.toFixed(4)}:${mapLongitude.toFixed(4)}:${refreshKey}:${earthquakes.length}:${events.length}`} ref={webView} source={{ html, baseUrl: 'https://aqua-watch.local/' }} javaScriptEnabled domStorageEnabled originWhitelist={['http://*', 'https://*']} mixedContentMode="always" setSupportMultipleWindows={false} onMessage={onMapMessage} onError={({ nativeEvent }) => { setMapState('error'); setMapMessage(nativeEvent.description || 'Map view failed to load. Check your network.'); }} renderLoading={() => <View style={styles.mapLoading}><ActivityIndicator color={colors.maya} /><Text style={styles.helper}>Opening map…</Text></View>} startInLoadingState /> : <WebRouteScreen route="map" baseUrl={webUrl} location={center} mode="3d" refresh={refreshKey} onMapFallback={() => setMode('2d')} />}
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.topCard}>
        <View style={styles.searchRow}><Ionicons name="search-outline" size={17} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void doSearch()} returnKeyType="search" placeholder="Search a city or place" placeholderTextColor="#B7C6DA99" style={styles.searchInput} accessibilityLabel="Search a city or place" /><Pressable disabled={searching} onPress={() => void doSearch()} accessibilityRole="button" accessibilityLabel="Search map"><Ionicons name={searching ? 'hourglass-outline' : 'arrow-forward-circle'} size={25} color={colors.maya} /></Pressable></View>
        {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
        <View style={styles.locationLine}><Ionicons name="location" size={13} color={colors.maya} /><Text numberOfLines={1} style={styles.locationText}>{centerLabel} · {center.latitude.toFixed(2)}°, {center.longitude.toFixed(2)}°</Text></View>
      </View>
      <View style={styles.controls}><Pressable onPress={() => setMode('2d')} style={[styles.control, mode === '2d' && styles.controlActive]}><Ionicons name="map-outline" size={15} color={mode === '2d' ? colors.deep : colors.text} /><Text style={[styles.controlText, mode === '2d' && styles.controlTextActive]}>2D map</Text></Pressable><Pressable onPress={() => setMode('3d')} style={[styles.control, mode === '3d' && styles.controlActive]}><Ionicons name="globe-outline" size={15} color={mode === '3d' ? colors.deep : colors.text} /><Text style={[styles.controlText, mode === '3d' && styles.controlTextActive]}>3D globe</Text></Pressable><Pressable accessibilityLabel="Center on my location" onPress={recenter} style={styles.iconControl}><Ionicons name="locate-outline" size={18} color={colors.text} /></Pressable><Pressable accessibilityLabel="Reload map" onPress={() => { setMapState('loading'); setRefreshKey((key) => key + 1); }} style={styles.iconControl}><Ionicons name="refresh" size={17} color={colors.text} /></Pressable></View>
      {mode === '2d' && mapState === 'loading' ? <View pointerEvents="none" style={styles.statusPill}><ActivityIndicator color={colors.maya} size="small" /><Text style={styles.statusText}>{loadingRisks ? 'Loading nearby risk markers…' : 'Loading map…'}</Text></View> : null}
      {mode === '2d' && mapState === 'error' ? <View style={styles.errorPill}><Ionicons name="cloud-offline-outline" size={15} color={colors.amber} /><Text style={styles.errorText}>{mapMessage || 'Map tiles are unavailable. Check internet and reload.'}</Text><Pressable onPress={() => setRefreshKey((key) => key + 1)}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
      {mode === '2d' ? <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: colors.maya }]} /><Text style={styles.legendText}>You</Text><View style={[styles.legendDot, { backgroundColor: colors.amber }]} /><Text style={styles.legendText}>Earthquake</Text><View style={[styles.legendDot, { backgroundColor: colors.periwinkle }]} /><Text style={styles.legendText}>NASA event</Text></View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deep }, overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingTop: 9, paddingBottom: 10 },
  topCard: { marginHorizontal: 10, backgroundColor: '#102E4AEF', borderColor: '#FFFFFF24', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }, searchRow: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: colors.text, fontSize: 12, paddingVertical: 5 }, searchError: { color: '#FFD6DC', fontSize: 10, paddingVertical: 5 }, locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4, paddingTop: 6 }, locationText: { color: colors.muted, fontSize: 10, flex: 1 },
  controls: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: 8, marginRight: 10, gap: 6 }, control: { minHeight: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 13, backgroundColor: '#102E4AEF', borderWidth: 1, borderColor: '#FFFFFF30' }, controlActive: { backgroundColor: colors.maya, borderColor: colors.maya }, controlText: { color: colors.text, fontSize: 10, fontWeight: '800' }, controlTextActive: { color: colors.deep }, iconControl: { width: 37, height: 36, borderRadius: 13, backgroundColor: '#102E4AEF', borderWidth: 1, borderColor: '#FFFFFF30', alignItems: 'center', justifyContent: 'center' },
  legend: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 15, backgroundColor: '#102E4AEF', borderWidth: 1, borderColor: '#FFFFFF20', paddingHorizontal: 10, paddingVertical: 7 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { color: colors.text, fontSize: 9, marginRight: 4 },
  statusPill: { position: 'absolute', top: 113, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: '#102E4AEF' }, statusText: { color: colors.text, fontSize: 10 }, errorPill: { position: 'absolute', top: 110, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 13, backgroundColor: '#102E4AF2', borderColor: '#F4B54466', borderWidth: 1 }, errorText: { color: colors.text, fontSize: 10, lineHeight: 15, flex: 1 }, retry: { color: colors.maya, fontSize: 10, fontWeight: '900' }, mapLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.deep }, helper: { color: colors.muted, fontSize: 11 },
});
