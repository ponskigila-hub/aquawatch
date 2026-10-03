# AquaWatch

**Global Flood, Marine & Rainfall Risk Monitoring**

AquaWatch is a global environmental-monitoring dashboard built with React, TypeScript, a 3D WebGL globe, and interactive 2D maps. It brings together public weather and environmental feeds in a user-friendly interface. The FastAPI/PyTorch forecasting endpoint is a **prototype only**; its current prediction head is not trained on weather observations and must not be used as an operational forecast or warning.

## Explore the platform

- **Overview (`/`)** — Browse global city weather, rainfall and river-flow estimates, local context, and reported events on the risk globe or 2D map. Search for a city to focus the display.
- **Forecast (`/forecast`)** — View the next 12 hours and select a future day for available hourly temperature, rain chance, wind, and humidity details.
- **Hazards (`/hazards`)** — Inspect recent USGS earthquakes and, when a server-side NASA FIRMS key is configured, satellite thermal detections. The interface does not provide official tsunami or wildfire warnings and does not model smoke dispersion.
- **Air quality (`/air-quality`)** — Compare modeled Open-Meteo air-quality estimates for common pollutants. These are model values, not ground monitors; Sentinel-5P satellite-column products are not connected.
- **Ocean (`/ocean`)** — Switch between an interactive 2D map and 3D globe; inspect global marine model samples, animated current/swell traces, hourly forecast steps through 72 hours, location search/coordinate pins, sparklines, threshold indicators, and GeoJSON/CSV exports. Daily NOAA OISST SST/anomaly fields are displayed as a continuous global raster.
- **History & climate (`/history`)** — Scrub recent daily weather, compare a selected day with 1991–2020 monthly averages, and replay dated positions only when NASA EONET provides an event track.
- **Community (`/community`)** — Save personal rainfall/wind thresholds and geotagged observations. Reports and thresholds are kept locally in the current browser; they are not a shared or verified reporting service.
- **Data tools (`/tools`)** — Explore calculated daylight and lunar context, record a short browser-generated WebM globe orbit, and export selected event/observation points by area as GeoJSON or CSV. GIS exports are point records, not GeoTIFF/NetCDF rasters.

## Marine data and interpretation

The ocean page obtains hourly wave, swell, period, and current estimates from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api). The continuous wave/swell/current colors are a display interpolation between those model samples, masked to NOAA ocean cells; they are **not** a NOAA-native wave raster or a navigational product. The full NOAA raster provides actual daily 0.25° sea-surface temperature and anomaly grid cells from the preliminary NCEI OISST v2.1 near-real-time feed. Its analysis date is shown in the inspector and may lag the current day; NOAA later replaces preliminary values with the final analysis. Anomalies use the product's 1971–2000 reference.

Marine status labels use informational thresholds only. A single-day SST anomaly does not establish a formal marine heatwave, which requires sustained percentile-based conditions. Wave/current values are model estimates, not buoy readings; follow official local warnings and marine safety advice.

Additional sources, fields, update timing, and known limitations are documented in [`docs/research/feature-data-sources.md`](./docs/research/feature-data-sources.md) and [`DATA_SOURCES.md`](./DATA_SOURCES.md).

## Other data and safety notes

- Weather and river-flow values are gridded model estimates, not local gauges. Flood labels are simple guides, not calibrated probabilities or official warnings.
- USGS earthquake records and NASA EONET events are distinct observations/catalog entries. An earthquake's tsunami flag does not replace an official tsunami advisory.
- NASA FIRMS access requires an API key configured only on the backend; thermal detections are not proof of a confirmed wildfire.
- Community pins remain on the current device/browser. They are unverified and are not transmitted to a central alert service.
- AquaWatch is for general awareness and research exploration. It is not an emergency-response service; follow local authorities for safety-critical decisions.

## Visual palette

The interface uses the supplied palette: **Soft Periwinkle** `#A682FF`, **Medium Slate Blue** `#715AFF`, **Cornflower Blue** `#5887FF`, **Maya Blue** `#55C1FF`, and **Deep Space Blue** `#102E4A`. Amber remains a weather-semantic accent; alert severities retain separate status colors.

## Run locally

### Frontend

```bash
pnpm install
pnpm dev -- --host 0.0.0.0 --port 8080
```

Open the Vite URL, normally `http://localhost:8080`.

### Optional FastAPI backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env                      # optional local configuration
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Vite proxies `/api` requests to the local backend. NOAA OISST point/raster endpoints work without a credential. The optional FIRMS layer requires a key from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/); set `NASA_FIRMS_MAP_KEY` in `backend/.env` and keep that file private. See [`backend/README.md`](./backend/README.md) for endpoint behavior, cache details, and configuration.

### Validate

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
cd backend && python -m pytest -q
```

## FastAPI/PyTorch prototype

- `GET /health` — backend health check.
- `POST /api/forecast` — accepts a WGS84 bounding box, grid size, forecast horizon, target, and optional input raster; returns a GeoJSON `FeatureCollection` and prediction matrix.
- `GET /api/hazards/fires` — bounded, server-side NASA FIRMS CSV-to-GeoJSON proxy (disabled until a key is configured).
- `GET /api/ocean/oisst?points=lat,lng;lat,lng` — NOAA SST/anomaly samples with the actual source timestamp.
- `GET /api/ocean/oisst/raster?metric=sst|anomaly` — full global NOAA daily raster as a transparent Web-Mercator PNG, with `X-Data-Time` and `X-Data-Source` headers.

The ResNet18 ImageNet weights initialize the current encoder, but the precipitation/anomaly output head is **not trained on weather observations**. Use a task-specific, independently validated checkpoint before treating the prototype output as a weather prediction.
