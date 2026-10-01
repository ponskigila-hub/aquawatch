# AquaWatch

Global flood & rainfall risk monitoring — currently tracking Jakarta, Indonesia, with live global disaster data and the ability to check any city in the world.

A dashboard for visualizing flood risk: an interactive 3D globe (or 2D map) showing district-level risk, live NASA disaster events worldwide, rainfall/water-level trends, and a searchable live weather lookup for any city on Earth.

## Features

- **Interactive 3D risk globe** — built with `react-globe.gl`/Three.js. Drag to rotate, scroll to zoom, click a district for details. Auto-rotates when idle.
- **2D map fallback** — a classic Leaflet map showing the same data. The app automatically switches to it when you zoom in close on the globe, since flat maps read better than a 3D sphere at street/district scale.
- **Live global disaster feed** — flood and severe-storm events worldwide, pulled from NASA's [EONET](https://eonet.gsfc.nasa.gov/) API, shown as pulsing markers on both the globe and map.
- **Search any city, worldwide** — type a city name to fly the globe/map there and see its *real, live* rainfall and temperature, powered by [Open-Meteo](https://open-meteo.com) (free, no API key required).
- **District detail pages** — each Jakarta district has its own page with a risk-tinted hero banner, key metrics (with hover tooltips explaining what each number means and where it notionally comes from), 7-day rainfall/water-level trend charts, and risk-appropriate safety recommendations.
- **Dashboard insights** — automatically-generated callouts for the highest-risk district, the safest district, and the week-over-week rainfall trend.
- **Recent alerts & district status** — scrollable alert feed and a sortable-by-risk district list, each linking to its detail page.
- **Dark mode** — full light/dark theming via `next-themes`, toggleable from the header.
- **Responsive** — works down to mobile widths; heavy 3D/map components are lazy-loaded so they don't bloat the initial bundle.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Routing | React Router |
| Data fetching / caching | TanStack Query |
| 3D globe | `react-globe.gl` (Three.js / `three-globe`) |
| 2D map | Leaflet |
| Charts | Recharts |
| Live weather + geocoding | [Open-Meteo](https://open-meteo.com) (no key needed) |
| Live disaster data | [NASA EONET](https://eonet.gsfc.nasa.gov/) (no key needed) |

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

### Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # locally serve the production build
npm run lint      # run eslint
```

## Project structure

```
public/
  globe/                  # bundled Earth textures for the 3D globe (no external CDN dependency)
src/
  components/
    RiskGlobe.tsx          # 3D globe view
    RiskMap2D.tsx           # 2D Leaflet map view
    CitySearch.tsx          # debounced worldwide city search (Open-Meteo geocoding)
    StatsOverview.tsx        # top-row stat cards
    InsightsPanel.tsx        # auto-generated dashboard callouts
    AlertList.tsx / DistrictStats.tsx
    RainfallChart.tsx / WaterLevelChart.tsx / TrendChart.tsx
    RiskBadge.tsx, ThemeToggle.tsx, ThemeProvider.tsx
  pages/
    Index.tsx               # main dashboard
    DistrictDetail.tsx        # per-district detail page
  lib/
    eonet.ts                # NASA EONET client
    openMeteo.ts              # Open-Meteo geocoding + weather client
  data/
    mockData.ts              # Jakarta district mock data, alerts, safety tips
  types/
    flood.ts                # shared TypeScript types
```

## Data sources

- **Jakarta district data** (rainfall, water level, risk level, descriptions) — currently **mocked**, for demonstration. There's no public real-time API for Jakarta-specific flood sensor data, so these values are static sample data rather than live readings.
- **Searched cities** — **live**, via Open-Meteo's free geocoding and forecast APIs. No API key required.
- **Global disaster markers** — **live**, via NASA EONET's public events API. No API key required.

### Swapping in a different weather provider

If you'd rather use a paid/alternative weather API instead of Open-Meteo:

- **OpenWeatherMap** — free tier available, key from [openweathermap.org/api](https://openweathermap.org/api)
- **WeatherAPI.com** — free tier available, key from [weatherapi.com](https://www.weatherapi.com/)

Both would replace the fetch calls in `src/lib/openMeteo.ts`.

## Known limitations

- Jakarta's 5 districts sit only a few kilometers apart. On the 3D globe, their markers are sized to avoid overlapping, but at extreme zoom they'll still read as a tight cluster rather than being spread far apart — this is a hard geographic constraint of representing real, close-together points as individual circles. The auto-handoff to the 2D map at close zoom keeps them legible in practice.
- The 3D globe's Earth texture and the 2D map's tiles both require network access at runtime (bundled texture files for the globe itself, but the map tiles come from OpenStreetMap).
- `react-globe.gl` pulls in Three.js, which is a large dependency. It's lazy-loaded so it only affects the dashboard page's bundle, not the whole app.

## Deployment

This is a static Vite app — `npm run build` outputs plain HTML/JS/CSS to `dist/`, deployable to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host.


## AI forecast prototype (FastAPI + PyTorch)

This repository is a **Vite + React 18 + TypeScript** client (not Next.js). The dashboard-level view state lives in `src/pages/Index.tsx`; `RiskGlobe` and `RiskMap2D` own their local visualization state. TanStack Query caches the existing external data: NASA EONET flood/storm events in `src/lib/eonet.ts` and Open-Meteo geocoding/current weather in `src/lib/openMeteo.ts`. EONET markers and current district/weather values are rendered as globe/map markers; Jakarta district values and charts are currently sample/mock data (`src/data/mockData.ts`). The globe uses `react-globe.gl`/Three.js; the alternative map uses Leaflet.

A new `backend/` service provides `POST /api/forecast`. The globe's **AI forecast · 24h** control requests a small bbox grid and renders the response's GeoJSON point features as a new WebGL marker layer. In development, Vite proxies `/api` to FastAPI on port `8000`; CORS is also configured for the local Vite origins.

> **Important model caveat:** this is an inference and rendering scaffold, not a scientifically validated weather forecast. ResNet18 ImageNet weights initialize the visual encoder when available, but the precipitation/anomaly heatmap head is not trained on weather observations. With no fine-tuned checkpoint, outputs are illustrative normalized values only—not mm/hr, warnings, or decision support. If no input raster is submitted, the API creates a synthetic sample field. See `backend/README.md` for the intended training/checkpoint path.

### Run both services in VS Code

Open the extracted project folder in VS Code and use two integrated terminals:

**Terminal 1 — FastAPI/PyTorch** (first-time setup):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env                      # optional
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Vite frontend:**

```bash
npm install
npm run dev
```

Open the Vite URL (`http://localhost:8080` in this project). FastAPI docs are at `http://127.0.0.1:8000/docs`; `GET /health` is a quick availability check. The first model initialization may download torchvision ResNet18 pretrained weights; set `AQUAWATCH_DOWNLOAD_PRETRAINED=false` in `backend/.env` for offline demo mode. To call a separately hosted backend, set `VITE_API_URL` for the frontend build/dev environment and configure `AQUAWATCH_CORS_ORIGINS` on the backend.

### Forecast API contract

Example request:

```json
{
  "bbox": { "west": 105.8, "south": -7.2, "east": 107.8, "north": -5.2 },
  "grid_width": 16,
  "grid_height": 10,
  "horizon_hours": 24,
  "variable": "precipitation"
}
```

Optional `spatial_data` is a numeric matrix with exactly `grid_height` rows and `grid_width` columns (ordered north-to-south). The response is a GeoJSON `FeatureCollection`; each `Point` has `[longitude, latitude]` coordinates and prediction metadata. The additional `prediction_matrix` is row-major (north to south). Inputs are bounded and validated by Pydantic; output values are normalized `0..1`. Lead time and target variable are decoder inputs, but the default model is untrained and its output is only illustrative. See `backend/README.md` for curl and checkpoint configuration details.
