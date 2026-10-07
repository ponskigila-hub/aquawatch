import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { MetricTile, Panel, SectionTitle } from './Ui';
import { aqiDescription, compassDirection, uvDescription } from '../services/environmental';
import { colors, type AirQualitySnapshot, type WeatherSnapshot } from '../theme';

const integer = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? '—' : `${Math.round(value)}${unit}`;
const decimal = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}${unit}`;
const aqiColor = (aqi: number | null | undefined) => aqi == null ? colors.muted : aqi <= 50 ? colors.green : aqi <= 100 ? colors.amber : aqi <= 150 ? '#FF9B55' : colors.red;

export function WeatherMetrics({ weather, airQuality }: { weather: WeatherSnapshot; airQuality: AirQualitySnapshot | null }) {
  const direction = compassDirection(weather.windDirectionDeg);
  const wind = weather.windKph == null ? '—' : `${direction ? `${direction} · ` : ''}${decimal(weather.windKph)} km/h`;
  const uv = weather.uvIndex == null ? '—' : `${decimal(weather.uvIndex)} · ${uvDescription(weather.uvIndex)}`;
  return <>
    <SectionTitle title="Current weather details" detail="Live model estimates · local units" />
    <View style={styles.row}>
      <MetricTile icon={<Ionicons name="cloud-outline" size={17} color={colors.maya} />} label="Cloud cover" value={integer(weather.cloudCoverPct, '%')} tone={colors.maya} />
      <MetricTile icon={<Ionicons name="eye-outline" size={17} color={colors.cornflower} />} label="Visibility" value={decimal(weather.visibilityKm, ' km')} tone={colors.cornflower} />
    </View>
    <View style={styles.row}>
      <MetricTile icon={<Ionicons name="water-outline" size={17} color={colors.maya} />} label="Humidity" value={integer(weather.humidity, '%')} tone={colors.maya} />
      <MetricTile icon={<Ionicons name="speedometer-outline" size={17} color={colors.periwinkle} />} label="Pressure" value={integer(weather.pressureMb, ' mb')} tone={colors.periwinkle} />
    </View>
    <View style={styles.row}>
      <MetricTile icon={<Ionicons name="navigate-outline" size={17} color={colors.amber} />} label="Wind · direction & speed" value={wind} tone={colors.amber} />
      <MetricTile icon={<Ionicons name="flag-outline" size={17} color={colors.cornflower} />} label="Wind gust" value={decimal(weather.windGustKph, ' km/h')} tone={colors.cornflower} />
    </View>
    <View style={styles.row}>
      <MetricTile icon={<Ionicons name="sunny-outline" size={17} color={colors.amber} />} label="UV index" value={uv} tone={colors.amber} />
      <MetricTile icon={<Ionicons name="thermometer-outline" size={17} color={colors.periwinkle} />} label="Dew point" value={decimal(weather.dewPointC, ' °C')} tone={colors.periwinkle} />
    </View>
    <View style={styles.row}>
      <MetricTile icon={<Ionicons name="rainy-outline" size={17} color={colors.maya} />} label="Precipitation" value={decimal(weather.precipitationMm, ' mm')} tone={colors.maya} />
      <MetricTile icon={<Ionicons name="umbrella-outline" size={17} color={colors.cornflower} />} label="Rain today" value={decimal(weather.rainTodayMm, ' mm')} tone={colors.cornflower} />
    </View>
    <SectionTitle title="Air quality" detail="Open-Meteo modeled estimate · US AQI scale" />
    <Panel style={styles.aqiPanel}>
      <View style={styles.aqiTop}>
        <View style={[styles.aqiIcon, { backgroundColor: `${aqiColor(airQuality?.usAqi)}22` }]}><Ionicons name="leaf-outline" size={19} color={aqiColor(airQuality?.usAqi)} /></View>
        <View style={{ flex: 1 }}><Text style={styles.aqiTitle}>Air Quality Index (AQI)</Text><Text style={[styles.aqiDescription, { color: aqiColor(airQuality?.usAqi) }]}>{aqiDescription(airQuality?.usAqi)}</Text></View>
        <Text style={[styles.aqiValue, { color: aqiColor(airQuality?.usAqi) }]}>{integer(airQuality?.usAqi)}</Text>
      </View>
      <View style={styles.pollutants}>
        <Pollutant label="PM2.5" value={decimal(airQuality?.pm25, ' µg/m³')} />
        <Pollutant label="PM10" value={decimal(airQuality?.pm10, ' µg/m³')} />
        <Pollutant label="NO₂" value={decimal(airQuality?.nitrogenDioxide, ' µg/m³')} />
      </View>
      <Text style={styles.aqiFootnote}>{airQuality?.time ? `Updated ${new Date(airQuality.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} local time.` : 'Air-quality feed unavailable; retry when connected.'} AQI is an estimate, not a ground-monitor reading.</Text>
    </Panel>
  </>;
}

function Pollutant({ label, value }: { label: string; value: string }) {
  return <View style={styles.pollutant}><Text style={styles.pollutantLabel}>{label}</Text><Text numberOfLines={1} style={styles.pollutantValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  aqiPanel: { borderColor: '#44D19A44' },
  aqiTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  aqiIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  aqiTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  aqiDescription: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  aqiValue: { fontSize: 25, fontWeight: '900' },
  pollutants: { flexDirection: 'row', gap: 7, marginTop: 15 },
  pollutant: { flex: 1, padding: 9, borderRadius: 12, backgroundColor: '#FFFFFF08' },
  pollutantLabel: { color: colors.muted, fontSize: 10 },
  pollutantValue: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 4 },
  aqiFootnote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 11 },
});
