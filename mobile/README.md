# AquaWatch Mobile (Expo)

A mobile-first Expo companion for the existing AquaWatch web dashboard and FastAPI backend. Native screens provide local weather, a 12-hour/7-day forecast, recent USGS earthquakes, marine conditions, and a location-centered map. The existing web app remains available in responsive WebViews for the full ocean map, hazards, air-quality, climate-history, community, and GIS tools.

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

The dashboard WebView opens `/mobile-map?lat=…&lng=…&mode=3d` for the shared globe, or existing routes such as `/history` and `/community` for the full feature pages. The mobile route is a map-only view with 2D/3D selection and uses the Expo device position passed in the URL.

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

At verification, `npm audit` reported 20 high and 8 moderate advisories in the mobile dependency tree. The forced automated remediation proposes downgrading Expo to 44 or React Native to 0.72, which is incompatible with this SDK 57 app; I did not apply that breaking downgrade. Re-run the audit as compatible Expo/React Native patches are released, and resolve these advisories before any public or production release.

## What the app requests / data boundaries

- Foreground location only: held in native memory for weather/map focus; there is no background tracking or automatic location history. Coordinates are sent in requests to Open-Meteo and the configured FastAPI/dashboard URLs; embedded page URLs include them to keep the shared location in sync.
- Existing Community alert rules and observations are saved in the embedded page's local browser storage only when the user explicitly creates them; the native app does not upload them.
- Public external sources: Open-Meteo weather/marine endpoints and the USGS past-day earthquake GeoJSON feed.
- Configured private FastAPI: backend health and the existing NOAA OISST point endpoint (daily SST/anomaly). NASA FIRMS access remains server-side and requires the optional backend key.
- Full existing pages are rendered inside Expo's WebView and therefore require a reachable `EXPO_PUBLIC_WEB_APP_URL`.
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
