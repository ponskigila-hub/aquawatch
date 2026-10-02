export interface CelestialPosition { latitude: number; longitude: number; }
export interface CelestialSnapshot {
  sun: CelestialPosition;
  moon: CelestialPosition;
  moonIlluminationPercent: number;
  moonPhase: string;
  solarAltitudeDegrees: number;
  daylight: boolean;
}

const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (radiansValue: number) => radiansValue * 180 / Math.PI;
const wrap360 = (value: number) => ((value % 360) + 360) % 360;
const wrap180 = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

export function calculateCelestialSnapshot(at: Date, observer: { lat: number; lng: number } = { lat: 0, lng: 0 }): CelestialSnapshot {
  const jd = at.getTime() / 86400000 + 2440587.5;
  const days = jd - 2451545.0;
  const meanLongitude = wrap360(280.460 + 0.9856474 * days);
  const meanAnomaly = radians(wrap360(357.528 + 0.9856003 * days));
  const eclipticLongitude = radians(wrap360(meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)));
  const obliquity = radians(23.439 - 0.0000004 * days);
  const sunRa = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const sunDec = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const gmst = radians(wrap360(280.46061837 + 360.98564736629 * days));
  const sun = { latitude: degrees(sunDec), longitude: wrap180(degrees(sunRa - gmst)) };

  const node = radians(wrap360(125.1228 - 0.0529538083 * days));
  const inclination = radians(5.1454);
  const periapsis = radians(wrap360(318.0634 + 0.1643573223 * days));
  const eccentricity = 0.0549;
  const meanMoonAnomaly = radians(wrap360(115.3654 + 13.0649929509 * days));
  const eccentricAnomaly = meanMoonAnomaly + eccentricity * Math.sin(meanMoonAnomaly) * (1 + eccentricity * Math.cos(meanMoonAnomaly));
  const xOrbit = 60.2666 * (Math.cos(eccentricAnomaly) - eccentricity);
  const yOrbit = 60.2666 * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
  const trueAnomaly = Math.atan2(yOrbit, xOrbit);
  const radius = Math.hypot(xOrbit, yOrbit);
  const argument = trueAnomaly + periapsis;
  const xEcliptic = radius * (Math.cos(node) * Math.cos(argument) - Math.sin(node) * Math.sin(argument) * Math.cos(inclination));
  const yEcliptic = radius * (Math.sin(node) * Math.cos(argument) + Math.cos(node) * Math.sin(argument) * Math.cos(inclination));
  const zEcliptic = radius * Math.sin(argument) * Math.sin(inclination);
  const xEquatorial = xEcliptic;
  const yEquatorial = yEcliptic * Math.cos(obliquity) - zEcliptic * Math.sin(obliquity);
  const zEquatorial = yEcliptic * Math.sin(obliquity) + zEcliptic * Math.cos(obliquity);
  const moonRa = Math.atan2(yEquatorial, xEquatorial);
  const moonDec = Math.atan2(zEquatorial, Math.hypot(xEquatorial, yEquatorial));
  const moon = { latitude: degrees(moonDec), longitude: wrap180(degrees(moonRa - gmst)) };

  const ageDays = ((days + 4.5) % 29.530588853 + 29.530588853) % 29.530588853;
  const phaseFraction = ageDays / 29.530588853;
  const phaseIndex = Math.round(phaseFraction * 8) % 8;
  const phaseNames = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * phaseFraction)) * 50);

  const latitude = radians(observer.lat);
  const declination = sunDec;
  const hourAngle = radians(wrap180((at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600 - 12) * 15 + observer.lng));
  const solarAltitudeDegrees = degrees(Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)));
  return { sun, moon, moonIlluminationPercent: illumination, moonPhase: phaseNames[phaseIndex], solarAltitudeDegrees, daylight: solarAltitudeDegrees > -0.833 };
}
