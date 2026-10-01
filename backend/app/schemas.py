from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BoundingBox(BaseModel):
    """WGS84 bbox. Dateline-crossing boxes are intentionally unsupported."""

    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)

    @model_validator(mode="after")
    def check_order(self) -> "BoundingBox":
        if self.west >= self.east:
            raise ValueError("bbox.west must be less than bbox.east (dateline-crossing boxes are unsupported)")
        if self.south >= self.north:
            raise ValueError("bbox.south must be less than bbox.north")
        return self


class ForecastRequest(BaseModel):
    bbox: BoundingBox
    grid_width: int = Field(default=24, ge=4, le=64)
    grid_height: int = Field(default=14, ge=4, le=48)
    horizon_hours: int = Field(default=24, ge=1, le=240)
    variable: Literal["precipitation", "anomaly"] = "precipitation"
    # Optional row-major raster (H x W); values are normalized per request.
    spatial_data: list[list[float]] | None = None

    @model_validator(mode="after")
    def check_raster(self) -> "ForecastRequest":
        if self.spatial_data is not None:
            if len(self.spatial_data) != self.grid_height:
                raise ValueError("spatial_data row count must equal grid_height")
            for row in self.spatial_data:
                if len(row) != self.grid_width:
                    raise ValueError("each spatial_data row must equal grid_width")
                if any(not math.isfinite(value) for value in row):
                    raise ValueError("spatial_data values must all be finite")
        return self


class ForecastFeatureProperties(BaseModel):
    prediction: float = Field(ge=0, le=1)
    variable: str
    horizon_hours: int
    unit: str
    row: int
    column: int


class ForecastFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict
    properties: ForecastFeatureProperties


class ForecastMetadata(BaseModel):
    model_name: str
    model_status: str
    input_source: str
    variable: str
    horizon_hours: int
    grid_width: int
    grid_height: int
    prediction_unit: str
    warnings: list[str]


class ForecastResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[ForecastFeature]
    # Row-major values, aligned with rows north-to-south, for raster consumers.
    prediction_matrix: list[list[float]]
    metadata: ForecastMetadata
