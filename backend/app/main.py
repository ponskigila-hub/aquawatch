from __future__ import annotations

import os
import csv
import io
import re
import struct
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from time import monotonic
import zlib
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .model import SpatialForecaster
from .schemas import (
    BoundingBox,
    ForecastFeature,
    ForecastFeatureProperties,
    ForecastMetadata,
    ForecastRequest,
    ForecastResponse,
)

load_dotenv()

DEFAULT_ORIGINS = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("AQUAWATCH_CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app = FastAPI(
    title="AquaWatch Forecast API",
    version="0.1.0",
    description="Prototype spatial raster inference endpoint. Forecast head requires task-specific training for operational use.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@lru_cache(maxsize=1)
def get_forecaster() -> SpatialForecaster:
    return SpatialForecaster()


def make_demo_field(bbox: BoundingBox, width: int, height: int, horizon_hours: int) -> np.ndarray:
    """Deterministic synthetic raster for an end-to-end UI demo, not weather data."""
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]
    # Center a smooth synthetic storm with small bbox/lead-time offsets so
    # different requested areas/leads produce visibly distinct sample fields.
    seed = int(abs(bbox.west * 11 + bbox.south * 7 + horizon_hours * 13)) % 97
    cx = 0.25 + (seed % 50) / 100.0
    cy = 0.20 + ((seed * 7) % 55) / 100.0
    sigma = 0.18 + (horizon_hours % 24) / 240.0
    storm = np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2.0 * sigma**2))
    background = 0.12 + 0.12 * np.sin((x * 2.3 + y * 1.7 + horizon_hours / 48.0) * np.pi) ** 2
    return np.clip(storm + background, 0.0, 1.0).astype(np.float32)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "aquawatch-forecast"}


@app.get("/api/hazards/fires")
def recent_thermal_detections(days: int = Query(default=1, ge=1, le=5)) -> dict[str, object]:
    """Proxy the public NASA FIRMS area CSV as GeoJSON without exposing its MAP_KEY."""
    map_key = os.getenv("NASA_FIRMS_MAP_KEY", "").strip()
    if not map_key:
        raise HTTPException(
            status_code=503,
            detail="NASA FIRMS is not configured. Set NASA_FIRMS_MAP_KEY in the backend environment.",
        )
    source = os.getenv("NASA_FIRMS_SOURCE", "VIIRS_NOAA20_NRT").strip()
    allowed_sources = {"VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"}
    if source not in allowed_sources:
        raise HTTPException(status_code=500, detail="NASA_FIRMS_SOURCE must be a supported near-real-time source.")

    # FIRMS places the key in the upstream path; it is only used by this server.
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/world/{days}"
    request = Request(url, headers={"Accept": "text/csv", "User-Agent": "AquaWatch environmental dashboard"})
    try:
        with urlopen(request, timeout=25) as response:
            csv_text = response.read(12_000_000).decode("utf-8-sig", errors="replace")
    except HTTPError as exc:
        # Do not forward the upstream URL or response body because the MAP_KEY is in the URL.
        status = 503 if exc.code in (401, 403, 429) else 502
        raise HTTPException(status_code=status, detail="NASA FIRMS could not provide thermal detections right now.") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise HTTPException(status_code=503, detail="NASA FIRMS is temporarily unreachable.") from exc

    try:
        rows = csv.DictReader(io.StringIO(csv_text))
        features = []
        for index, row in enumerate(rows):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (KeyError, TypeError, ValueError):
                continue
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue
            properties: dict[str, object] = {
                key: row.get(key) for key in ("acq_date", "acq_time", "satellite", "confidence")
            }
            for source_key, target_key in (("bright_ti4", "bright_ti4"), ("brightness", "brightness"), ("frp", "frp")):
                try:
                    properties[target_key] = float(row[source_key])
                except (KeyError, TypeError, ValueError):
                    pass
            stable_id = ":".join(str(row.get(key, "")) for key in ("satellite", "acq_date", "acq_time", "latitude", "longitude"))
            features.append({
                "type": "Feature",
                "id": stable_id or f"firms-{index}",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": properties,
            })
            if len(features) >= 50_000:
                break
    except (csv.Error, UnicodeError) as exc:
        raise HTTPException(status_code=502, detail="NASA FIRMS returned data in an unexpected format.") from exc

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "NASA FIRMS",
            "product": source,
            "days": days,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "url": "https://firms.modaps.eosdis.nasa.gov/",
        },
    }


_OISST_BASE = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180"
_OISST_CACHE: dict[tuple[tuple[float, float], ...], tuple[float, dict[str, object]]] = {}
_OISST_CACHE_LOCK = threading.Lock()


def _oisst_latest_timestamp() -> datetime:
    request = Request(_OISST_BASE + ".das", headers={"User-Agent": "AquaWatch environmental dashboard"})
    with urlopen(request, timeout=20) as response:
        metadata = response.read(1_000_000).decode("latin-1", errors="replace")
    match = re.search(r'time_coverage_end\s+"([^"]+)"', metadata)
    if not match:
        raise ValueError("NOAA ERDDAP did not report a time range.")
    return datetime.fromisoformat(match.group(1).replace("Z", "+00:00")).astimezone(timezone.utc)


def _oisst_grid_coordinate(latitude: float, longitude: float) -> tuple[float, float]:
    # The near-real-time global ERDDAP grid is on cell centers at 0.125°
    # through 179.875° east and -179.875° through 179.875° west.
    lat = -89.875 + round((latitude + 89.875) / 0.25) * 0.25
    normalized_longitude = ((longitude + 180) % 360) - 180
    longitude_index = max(0, min(1439, round((normalized_longitude + 179.875) / 0.25)))
    lon = -179.875 + longitude_index * 0.25
    return round(lat, 3), round(lon, 3)


def _fetch_oisst_cell(location: tuple[float, float], timestamp: datetime) -> dict[str, object]:
    latitude, longitude = location
    grid_lat, grid_lon = _oisst_grid_coordinate(latitude, longitude)
    time_value = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
    constraint = f"[({time_value})][(0.0)][({grid_lat})][({grid_lon})]"
    query = f"sst{constraint},anom{constraint}"
    url = _OISST_BASE + ".csv?" + quote(query, safe="():,.T-Z")
    request = Request(url, headers={"Accept": "text/csv", "User-Agent": "AquaWatch environmental dashboard"})
    with urlopen(request, timeout=20) as response:
        text = response.read(16_000).decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 3:
        raise ValueError("NOAA ERDDAP returned no point row.")
    # ERDDAP CSV includes a units row after its column header.
    values = dict(zip(rows[0], rows[2]))

    def numeric(name: str) -> float | None:
        try:
            value = float(values[name])
            return value if np.isfinite(value) else None
        except (KeyError, TypeError, ValueError):
            return None

    return {
        "id": f"oisst-{latitude:.3f}-{longitude:.3f}",
        "latitude": latitude,
        "longitude": longitude,
        "sst_c": numeric("sst"),
        "anomaly_c": numeric("anom"),
        "grid_latitude": grid_lat,
        "grid_longitude": grid_lon,
        "time": values.get("time", time_value),
    }


@app.get("/api/ocean/oisst")
def ocean_sst_points(points: str = Query(..., min_length=3, max_length=1200)) -> dict[str, object]:
    """Return sampled NOAA daily SST/anomalies for at most 24 lat,lng locations."""
    try:
        locations = []
        for item in points.split(";"):
            lat_text, lng_text = item.split(",", 1)
            latitude, longitude = float(lat_text), float(lng_text)
            if not (-89.8 <= latitude <= 89.8 and -180 <= longitude <= 180):
                raise ValueError("Coordinate is outside valid bounds.")
            locations.append((round(latitude, 3), round(longitude, 3)))
        if not locations or len(locations) > 24:
            raise ValueError("Request between 1 and 24 ocean locations.")
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Provide up to 24 locations as `lat,lng;lat,lng` in valid coordinates.")

    cache_key = tuple(locations)
    cached = _OISST_CACHE.get(cache_key)
    if cached and cached[0] > monotonic():
        return cached[1]
    with _OISST_CACHE_LOCK:
        cached = _OISST_CACHE.get(cache_key)
        if cached and cached[0] > monotonic():
            return cached[1]
        try:
            timestamp = _oisst_latest_timestamp()
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda location: _fetch_oisst_cell(location, timestamp), locations))
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, IndexError) as exc:
            raise HTTPException(status_code=503, detail="NOAA sea-surface temperature data is temporarily unavailable.") from exc
        result: dict[str, object] = {
            "source": "NOAA NCEI OISST v2.1 near-real-time analysis",
            "time": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "anomaly_baseline": "1971–2000",
            "units": {"sst": "°C", "anomaly": "°C"},
            "attribution": "NOAA National Centers for Environmental Information",
            "url": "https://www.ncei.noaa.gov/products/optimum-interpolation-sst",
            "points": results,
        }
        _OISST_CACHE[cache_key] = (monotonic() + 6 * 60 * 60, result)
        return result


_OISST_RASTER_CACHE: dict[str, tuple[float, str, bytes]] = {}
_OISST_RASTER_LOCK = threading.Lock()
_OISST_GRID_SHAPE = (720, 1440)


def _fetch_oisst_grid(variable: str, timestamp: datetime) -> np.ndarray:
    """Read the NOAA daily 0.25° field as a north-to-south-ready numeric grid."""
    if variable not in {"sst", "anom"}:
        raise ValueError("Unsupported NOAA OISST variable.")
    time_value = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
    query = f"{variable}[({time_value})][(0.0)][(-89.875):(89.875)][(-179.875):(179.875)]"
    request = Request(
        _OISST_BASE + ".csv?" + quote(query, safe="():,.T-Z"),
        headers={"Accept": "text/csv", "User-Agent": "AquaWatch environmental dashboard"},
    )
    grid = np.full(_OISST_GRID_SHAPE, np.nan, dtype=np.float32)
    with urlopen(request, timeout=90) as response:
        rows = csv.reader(io.TextIOWrapper(response, encoding="utf-8-sig", newline=""))
        next(rows, None)  # ERDDAP column headings
        next(rows, None)  # units row
        populated = 0
        for row in rows:
            if len(row) < 5:
                continue
            try:
                latitude, longitude, value = float(row[2]), float(row[3]), float(row[4])
            except (TypeError, ValueError):
                continue
            lat_index = round((latitude + 89.875) / 0.25)
            lon_index = round((longitude + 179.875) / 0.25)
            if 0 <= lat_index < 720 and 0 <= lon_index < 1440 and np.isfinite(value):
                grid[lat_index, lon_index] = value
                populated += 1
    if populated < 10_000:
        raise ValueError("NOAA OISST raster response contained too few valid grid cells.")
    return grid


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def _oisst_png(grid: np.ndarray, metric: str) -> bytes:
    """Color a NOAA grid into a transparent RGBA PNG suitable for Leaflet ImageOverlay."""
    if metric == "anomaly":
        low, high = -3.0, 3.0
        stops = [(-3, "55C1FF"), (-1.5, "5887FF"), (0, "A682FF"), (1, "F8D252"), (2, "F28C44"), (3, "DC4256")]
    else:
        low, high = 0.0, 32.0
        stops = [(0, "102E4A"), (8, "5887FF"), (16, "55C1FF"), (24, "F8D252"), (28, "F28C44"), (32, "DC4256")]
    # NOAA's coordinates run south-to-north across -180–180°. Resample
    # latitude rows into Web Mercator for alignment with the Leaflet basemap.
    height, width = _OISST_GRID_SHAPE
    mercator_y = np.pi * (1 - 2 * (np.arange(height, dtype=np.float32) + 0.5) / height)
    latitude = np.arctan(np.sinh(mercator_y)) * (180 / np.pi)
    latitude_indices = np.rint((latitude + 89.875) / 0.25).astype(np.int32)
    latitude_indices = np.clip(latitude_indices, 0, grid.shape[0] - 1)
    values = grid[latitude_indices, :]
    valid = np.isfinite(values)
    if metric == "anomaly":
        valid &= np.abs(values) <= 20.0
    else:
        valid &= (values >= -3.0) & (values <= 45.0)
    positions = np.asarray([item[0] for item in stops], dtype=np.float32)
    colours = np.asarray([[int(item[1][index:index + 2], 16) for index in (0, 2, 4)] for item in stops], dtype=np.float32)
    sample = np.clip(np.nan_to_num(values, nan=low), low, high)
    pixels = np.zeros((*values.shape, 4), dtype=np.uint8)
    for channel in range(3):
        pixels[..., channel] = np.interp(sample, positions, colours[:, channel]).astype(np.uint8)
    pixels[..., 3] = np.where(valid, 220, 0).astype(np.uint8)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # PNG filter: none
        raw.extend(row.tobytes())
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header) + _png_chunk(b"IDAT", zlib.compress(bytes(raw), 6)) + _png_chunk(b"IEND", b"")


@app.get("/api/ocean/oisst/raster")
def ocean_sst_raster(metric: str = Query(default="anomaly")) -> Response:
    """Return a daily NOAA OISST global raster as a transparent PNG map overlay."""
    if metric not in {"sst", "anomaly"}:
        raise HTTPException(status_code=422, detail="Choose metric=sst or metric=anomaly.")
    cached = _OISST_RASTER_CACHE.get(metric)
    if cached and cached[0] > monotonic():
        expiry, data_time, image = cached
    else:
        with _OISST_RASTER_LOCK:
            cached = _OISST_RASTER_CACHE.get(metric)
            if cached and cached[0] > monotonic():
                expiry, data_time, image = cached
            else:
                try:
                    timestamp = _oisst_latest_timestamp()
                    variable = "anom" if metric == "anomaly" else "sst"
                    image = _oisst_png(_fetch_oisst_grid(variable, timestamp), metric)
                except (HTTPError, URLError, TimeoutError, OSError, ValueError, IndexError) as exc:
                    raise HTTPException(status_code=503, detail="NOAA's global sea-surface raster is temporarily unavailable.") from exc
                data_time = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
                expiry = monotonic() + 6 * 60 * 60
                _OISST_RASTER_CACHE[metric] = (expiry, data_time, image)
    return Response(
        content=image,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=21600",
            "X-Data-Time": data_time,
            "X-Data-Source": "NOAA NCEI OISST v2.1 near-real-time analysis",
            "X-Data-Metric": metric,
        },
    )


@app.post("/api/forecast", response_model=ForecastResponse)
def create_forecast(request: ForecastRequest) -> ForecastResponse:
    input_source = "client_spatial_data" if request.spatial_data is not None else "synthetic_demo_field"
    if request.spatial_data is None:
        spatial_data = make_demo_field(
            request.bbox, request.grid_width, request.grid_height, request.horizon_hours
        )
    else:
        spatial_data = np.asarray(request.spatial_data, dtype=np.float32)

    try:
        forecaster = get_forecaster()
        matrix = forecaster.predict(
            spatial_data,
            horizon_hours=request.horizon_hours,
            variable=request.variable,
        )
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model inference unavailable: {type(exc).__name__}: {exc}") from exc

    bbox = request.bbox
    features: list[ForecastFeature] = []
    for row in range(request.grid_height):
        lat = bbox.north - (row + 0.5) * (bbox.north - bbox.south) / request.grid_height
        for column in range(request.grid_width):
            lng = bbox.west + (column + 0.5) * (bbox.east - bbox.west) / request.grid_width
            features.append(
                ForecastFeature(
                    geometry={"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                    properties=ForecastFeatureProperties(
                        prediction=round(float(matrix[row, column]), 5),
                        variable=request.variable,
                        horizon_hours=request.horizon_hours,
                        unit="normalized_0_to_1",
                        row=row,
                        column=column,
                    ),
                )
            )

    warnings: list[str] = []
    if not forecaster.checkpoint_loaded:
        warnings.append(
            "The ResNet18 spatial encoder may use ImageNet weights, but the precipitation/anomaly output head is not trained on weather observations. Values are illustrative only; do not use for warnings or decisions."
        )
    if input_source == "synthetic_demo_field":
        warnings.append("No raster was supplied; a synthetic sample field was generated to demonstrate the API and layer rendering.")
    if forecaster.load_warning:
        warnings.append(forecaster.load_warning)

    return ForecastResponse(
        features=features,
        prediction_matrix=[[round(float(value), 5) for value in row] for row in matrix],
        metadata=ForecastMetadata(
            model_name="ResNet18 spatial encoder + dense heatmap decoder",
            model_status=forecaster.model_status,
            input_source=input_source,
            variable=request.variable,
            horizon_hours=request.horizon_hours,
            grid_width=request.grid_width,
            grid_height=request.grid_height,
            prediction_unit="normalized_0_to_1 (not calibrated physical units)",
            warnings=warnings,
        ),
    )
