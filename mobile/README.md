# AquaWatch Mobile (Expo)

A mobile-first Expo companion for the existing AquaWatch web dashboard and FastAPI backend. Native weather screens include cloud cover, visibility, humidity, pressure, wind direction/speed, gusts, UV, dew point, precipitation, modeled AQI and pollutant samples. Forecast sections are Now, Hourly, Daily, and Sun & Moon. The primary hazard screen shows nearby USGS earthquakes and tsunami-related catalogue flags plus nearby open NASA EONET events, including landslides when catalogued. The default interactive 2D map uses OpenStreetMap and nearby risk markers without depending on the local dashboard URL; the optional 3D globe and full feature pages still use responsive WebViews.

## Requirements

- Node.js 22 or newer and npm.
- Expo Go on a physical phone for quick development, or an EAS development/preview build for device testing.
- For LAN access, phone and development computer must be on the same Wi-Fi; allow incoming connections to the development ports in the host firewall.
- The Expo Go QR connects the phone to Metro. Separately, the phone must be able to reach the dashboard and backend URLs below.

## Configure API and dashboard addresses

Copy `.env.example` to `.env`, then replace the example IP with the computer's LAN IPv4 address:

```bash
cp .env.example .env
```

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.25:8080
```

These `EXPO_PUBLIC_` values are build-time public URLs, **not secrets**. Never put API keys or credentials in them. `More → Backend & dashboard connection` can also save runtime URLs on this installation. The saved runtime setting overrides the build-time default for convenience. The Android config allows cleartext HTTP for local development; use HTTPS URLs for public or production services.

If using HTTPS tunnels (Dev Tunnels, ngrok, etc.), set the two values to the matching reachable addresses, for example:

```dotenv
EXPO_PUBLIC_API_URL=https://your-api-tunnel.ngrok-free.app
EXPO_PUBLIC_WEB_APP_URL=https://your-web-tunnel.ngrok-free.app
```

Open the FastAPI and Vite processes on the host, binding both to `0.0.0.0` where necessary. From the computer, discover its local IPv4 address with `ip addr` (Linux), `ipconfig` (Windows), or Network settings (macOS). Do not use `localhost` or `127.0.0.1` in a phone build: those addresses refer to the phone itself. In Vite, allow the LAN hostname in `server.allowedHosts` if the browser rejects it. Keep the web server and API on separate URLs/ports as shown.

The native 2D map is independent of the dashboard server and centers on the device's starting position. It fetches OpenStreetMap tiles plus live nearby USGS earthquakes (500 km, 7 days) and open NASA EONET events (within 1,000 km); a city search uses Open-Meteo geocoding. Internet access is still needed to download the map library, map tiles, search results, and live data. The optional 3D globe opens `/mobile-map?lat=…&lng=…&mode=3d` inside a WebView, while the remaining full feature pages use routes such as `/history` and `/community`. If the dashboard is unreachable, the map offers an explicit local 2D fallback and a retry message instead of Android's blank WebView error page.

## Run with Expo Go

From this folder:

```bash
npm install
npx expo start
```

Scan the QR code in Expo Go. If LAN discovery is blocked, use `npx expo start --tunnel` (this tunnels Metro only; configure `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_APP_URL` separately if your phone cannot reach those services over Wi-Fi). The first run asks for foreground location access. If denied, the app falls back to the same Jakarta coordinates as the web dashboard; the native location hook holds the active position in memory and does not create an automatic location history.

Useful checks:

```bash
npx expo-doctor
npx tsc --noEmit
```

## EAS builds

Sign in once with Expo, then configure this project on the EAS account:

```bash
npx eas-cli login
npx eas-cli build:configure
```

EAS's Android preview profile creates an installable APK (not the Play Store AAB):

```bash
npx eas-cli build -p android --profile preview
```

The build URL can be opened on an Android device to install the APK. The first `build:configure` run links this app to your Expo account and writes the account-specific EAS project ID into the app configuration.

For iOS, use a registered-device internal build or a development client as appropriate to the Apple signing setup:

```bash
npx eas-cli build -p ios --profile development
# or, after configuring an eligible registered-device profile:
npx eas-cli build -p ios --profile preview
```

An iOS device install requires Apple's signing/provisioning setup through EAS. A simulator build is an alternative for local UI checks where an iOS simulator is available. Local iOS builds require macOS; the current Linux sandbox cannot build or install an iOS app.

## Dependency audit note

At verification after aligning Expo to `~57.0.27`, `npm audit` reported 19 high and 8 moderate advisories in the mobile dependency tree. I did not apply automated breaking downgrades that would de-align Expo/React Native from SDK 57. Review the current advisory paths and resolve them with compatible SDK updates before any public or production release.

## What the app requests / data boundaries

- Foreground location only: held in native memory for weather/map focus; there is no background tracking or automatic location history. Depending on the screen, coordinates are sent to Open-Meteo (weather/AQI), USGS (nearby earthquake query), NASA EONET (nearby-event filtering), and, when opened, the configured FastAPI/dashboard URL. The 2D map asks OpenStreetMap for the visible tile area, which can reveal an approximate map viewport to its tile service. Embedded page URLs include coordinates so the shared location stays in sync.
- Map place searches send the submitted place name to Open-Meteo geocoding. A searched map center is held only for that screen session; it does not replace the device location or persist as a location history.
- Existing Community alert rules and observations are saved in the embedded page's local browser storage only when the user explicitly creates them; the native app does not upload them.
- Public external sources: Open-Meteo forecast and air-quality endpoints, Open-Meteo geocoding, the USGS earthquake catalogue, NASA EONET open events, and OpenStreetMap map tiles. Weather/AQI, EONET and earthquake data are estimates/catalogue reports and may not cover every local incident.
- AQI is returned on the US AQI scale alongside PM2.5, PM10 and NO₂ estimates. UV labels use standard index ranges. Moon phase/illumination is calculated from the forecast date; this weather feed does not supply moonrise or moonset.
- Configured private FastAPI: backend health and the existing NOAA OISST point endpoint (daily SST/anomaly). NASA FIRMS access remains server-side and requires the optional backend key.
- The 3D globe and full existing pages are rendered inside Expo's WebView and require a reachable `EXPO_PUBLIC_WEB_APP_URL`; the default 2D OpenStreetMap view does not.
- These are environmental-awareness tools, not official emergency warnings or navigation advice.

## Palette

Soft Periwinkle `#A682FF`, Medium Slate Blue `#715AFF`, Cornflower Blue `#5887FF`, Maya Blue `#55C1FF`, and Deep Space Blue `#102E4A`; weather/risk cues add semantic amber, green, and red.

## Official references

- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo APK builds](https://docs.expo.dev/build-reference/apk/)
- [Expo build properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)
- [Expo splash screen configuration](https://docs.expo.dev/versions/latest/sdk/splash-screen/)
- [React Native WebView reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md)
