# AquaWatch

A global rainfall and river-flow dashboard built with React, TypeScript, a 3D globe, and a 2D map. It shows live weather estimates for cities around the world, with a separate, easy-to-read seven-day forecast.

## What you can do

- Explore weather in **more than 100 cities across many countries** on either map. Select a marker to see current conditions, temperature, today’s high and low, rain chance, wind, and humidity.
- Search for a city to update the dashboard, nearby-area list, alerts, and forecast. Clear the search to return to Jakarta.
- Check today’s area-average rainfall and nearby river flow, plus a seven-day view of rain, temperature, rain chance, and river-flow estimates.
- See the next **12 hours** in the local-weather timeline. On **Forecast**, select any day to open its available hourly details—temperature, conditions, rain chance, wind, and humidity.
- Switch between a light sky-gradient theme and a deep-blue night theme; weather icons and subtle rain, sun, cloud, or snow motion follow the forecast.
- See flood and storm reports from NASA on the maps. These reports are separate from weather estimates.

## Forecast and flood-risk wording

The forecast page combines current and daily weather from [Open-Meteo](https://open-meteo.com/en/docs) with daily nearby river-flow estimates from the [Open-Meteo Global Flood API](https://open-meteo.com/en/docs/flood-api). City and local-area values are averages where shown.

The **Low / Watch / High flood-risk estimate** is a simple rain-based guide for planning. It is **not** a calibrated flood probability or an official warning. Follow local emergency services for safety advice. River flow is shown in m³/s; it is not measured water height.

See [`DATA_SOURCES.md`](./DATA_SOURCES.md) for coverage and data limitations.

## Run in VS Code

Open the project in VS Code and start two integrated terminals.

**Terminal 1 — optional FastAPI/PyTorch prototype:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env                      # optional
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**

```bash
npm install
npm run dev
```

Open the Vite URL (`http://localhost:8080` in this project). FastAPI docs are at `http://127.0.0.1:8000/docs`; `GET /health` checks the optional backend.

### PyTorch endpoint prototype

The backend's `POST /api/forecast` accepts a WGS84 bounding box, grid size, forecast horizon, target, and optional input raster. It returns a GeoJSON `FeatureCollection` and a prediction matrix. The web forecast page now uses live weather and river-flow forecast data instead of presenting this untrained model output as a real forecast.

The ResNet18 ImageNet weights initialize the encoder, but the precipitation/anomaly output head is **not trained on weather observations**. Use a task-specific checkpoint before treating the prototype's output as a weather prediction. See [`backend/README.md`](./backend/README.md) for endpoint setup and examples.
