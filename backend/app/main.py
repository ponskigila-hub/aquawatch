from __future__ import annotations

import os
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, HTTPException
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
