# AquaWatch Forecast Backend

FastAPI + PyTorch prototype that accepts a WGS84 bounding box and optional row-major raster, runs a ResNet18-based dense inference model, and returns a GeoJSON `FeatureCollection` plus `prediction_matrix`.

> **Model limitation:** the included ResNet18 uses pretrained ImageNet encoder weights when available, but its weather heatmap head is not trained on meteorological observations. Without a task-specific checkpoint, the endpoint is a software/UI demo only. It does not provide validated precipitation forecasts or calibrated physical units. A synthetic sample field is generated when `spatial_data` is omitted.

## Setup

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate                 # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env                      # optional; edit the origins/checkpoint/FIRMS settings as needed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If you want a CPU-only PyTorch wheel, install torch and torchvision from the official CPU index before the remaining dependencies:

```bash
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install 'fastapi>=0.115,<1.0' 'uvicorn[standard]>=0.30,<1.0' 'pydantic>=2.7,<3.0' 'python-dotenv>=1.0,<2.0' 'numpy>=1.26,<3.0'
```

The first model initialization may download torchvision's standard ResNet18 ImageNet weights. Set `AQUAWATCH_DOWNLOAD_PRETRAINED=false` to avoid that in offline demo mode. The backend reads `.env` if `python-dotenv` is installed; alternatively export those variables in the terminal. The optional global fire/thermal layer requires a NASA FIRMS MAP_KEY: request one from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) and set `NASA_FIRMS_MAP_KEY` in `backend/.env`. Do not put the key in frontend code or commit the `.env` file. `NASA_FIRMS_SOURCE` defaults to `VIIRS_NOAA20_NRT`.

Run the API tests with `python -m pip install -r requirements-dev.txt && pytest` from `backend/`.

## API

- `GET /health` — liveness check
- `GET /docs` — interactive OpenAPI docs
- `POST /api/forecast` — inference
- `GET /api/hazards/fires?days=1` — global NASA FIRMS thermal detections as GeoJSON; `days` is limited to 1–5
- `GET /api/ocean/oisst?points=lat,lng;lat,lng` — up to 24 sampled NOAA NCEI OISST v2.1 near-real-time SST/anomaly locations; caches by point set for six hours and reports the source timestamp
- `GET /api/ocean/oisst/raster?metric=sst|anomaly` — global daily 0.25° NOAA grid as a transparent Web-Mercator PNG; the six-hour cached response includes `X-Data-Time` and `X-Data-Source` headers

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/forecast \\
  -H 'Content-Type: application/json' \\
  -d '{"bbox":{"west":105.8,"south":-7.2,"east":107.8,"north":-5.2},"grid_width":12,"grid_height":8,"horizon_hours":24,"variable":"precipitation"}'
```

Pass `spatial_data` as an `H x W` numeric matrix matching `grid_height` and `grid_width` to infer on a supplied weather raster; arrange raster rows north-to-south. Output features are GeoJSON `Point`s with `[longitude, latitude]` coordinates; `prediction_matrix` is row-major, with rows ordered north-to-south. Each prediction is normalized to `0..1`, not millimeters/hour. Lead time and target variable are supplied as decoder-conditioning channels, but do not make an untrained head predictive.

FIRMS values are satellite thermal detections, not confirmed ground fires. Some dots may reflect controlled burns, industrial heat sources, or false detections. The endpoint uses a backend proxy so the FIRMS key is never sent to the browser; it is unavailable until a valid key is configured. See the [NASA FIRMS API terms and docs](https://firms.modaps.eosdis.nasa.gov/api/area/).

OISST values are samples from NOAA's daily 0.25° gridded analysis, not buoy readings or an instantaneous sensor stream. The API uses the NOAA NCEI preliminary near-real-time OISST v2.1 ERDDAP stream (`ncdcOisst21NrtAgg_LonPM180`) and labels the actual source timestamp; the preliminary stream is typically available about a day after analysis and is replaced by the final product after roughly two weeks. The anomaly uses the product's 1971–2000 reference. Source: [NOAA NCEI OISST](https://www.ncei.noaa.gov/products/optimum-interpolation-sst) and [NOAA CoastWatch ERDDAP dataset](https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180.html).

For actual forecasting, fine-tune the same `ResNet18Heatmap` architecture on properly aligned, time-labelled gridded weather data, save its full model `state_dict`, then set `AQUAWATCH_MODEL_CHECKPOINT` to that file. Validate calibration, baselines, geographic generalization, and lead-time skill before using operationally.
