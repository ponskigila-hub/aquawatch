import os
from io import BytesIO

# Keep CI/offline test runs deterministic and avoid downloading model weights.
os.environ.setdefault("AQUAWATCH_DOWNLOAD_PRETRAINED", "false")

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_health_and_cors(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    preflight = client.options(
        "/api/forecast",
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:8080"


def test_rejects_inconsistent_spatial_data(client: TestClient) -> None:
    response = client.post(
        "/api/forecast",
        json={
            "bbox": {"west": 105, "south": -7, "east": 107, "north": -5},
            "grid_width": 4,
            "grid_height": 4,
            "spatial_data": [[0, 1, 2, 3]],
        },
    )
    assert response.status_code == 422


def test_returns_geojson_and_prediction_matrix(client: TestClient) -> None:
    response = client.post(
        "/api/forecast",
        json={
            "bbox": {"west": 105, "south": -7, "east": 107, "north": -5},
            "grid_width": 4,
            "grid_height": 4,
            "horizon_hours": 24,
            "variable": "precipitation",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 16
    assert body["features"][0]["geometry"] == {
        "type": "Point",
        "coordinates": [105.25, -5.25],
    }
    assert len(body["prediction_matrix"]) == 4
    assert all(len(row) == 4 for row in body["prediction_matrix"])
    assert body["metadata"]["input_source"] == "synthetic_demo_field"
    assert body["metadata"]["warnings"]


def test_firms_layer_explains_missing_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NASA_FIRMS_MAP_KEY", raising=False)
    response = client.get("/api/hazards/fires")
    assert response.status_code == 503
    assert "NASA_FIRMS_MAP_KEY" in response.json()["detail"]


def test_firms_csv_is_converted_to_geojson_without_exposing_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("NASA_FIRMS_MAP_KEY", "test-map-key")
    csv_body = (
        "latitude,longitude,bright_ti4,confidence,frp,acq_date,acq_time,satellite\n"
        "-10.25,120.5,330.4,nominal,4.2,2026-10-01,1234,VIIRS_SNPP\n"
    ).encode()
    monkeypatch.setattr(main, "urlopen", lambda request, timeout: BytesIO(csv_body))
    response = client.get("/api/hazards/fires?days=2")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "FeatureCollection"
    assert body["features"][0]["geometry"]["coordinates"] == [120.5, -10.25]
    assert body["features"][0]["properties"]["frp"] == 4.2
    assert "test-map-key" not in response.text
    assert body["metadata"]["product"] == "VIIRS_NOAA20_NRT"


def test_oisst_proxy_returns_sst_and_anomaly_with_source_time(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "_OISST_CACHE", {})
    calls: list[str] = []
    metadata = b'Attributes { time { Float64 actual_range 1.78956e+9, 1.78956e+9; } }'
    point_csv = (
        "time,depth,latitude,longitude,sst,anom\n"
        "UTC,m,degrees_north,degrees_east,Celsius,Celsius\n"
        "2026-09-16T12:00:00Z,0.0,35.125,210.125,23.17,0.36\n"
    ).encode()

    def fake_urlopen(request: object, timeout: int) -> BytesIO:
        url = request.full_url  # type: ignore[attr-defined]
        calls.append(url)
        return BytesIO(metadata if url.endswith(".das") else point_csv)

    monkeypatch.setattr(main, "urlopen", fake_urlopen)
    response = client.get("/api/ocean/oisst", params={"points": "35,-150"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "NOAA NCEI OISST v2.1"
    assert body["time"] == "2026-09-16T12:00:00Z"
    assert body["points"][0]["sst_c"] == 23.17
    assert body["points"][0]["anomaly_c"] == 0.36
    assert body["points"][0]["grid_longitude"] == 210.125
    assert len(calls) == 2


def test_oisst_rejects_out_of_bounds_or_too_many_points(client: TestClient) -> None:
    assert client.get("/api/ocean/oisst", params={"points": "91,0"}).status_code == 422
    points = ";".join(f"{index},0" for index in range(25))
    assert client.get("/api/ocean/oisst", params={"points": points}).status_code == 422
