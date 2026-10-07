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
    assert response.json()["service"] == "auraguard-forecast"

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
    metadata = b'Attributes { String time_coverage_end "2026-10-01T12:00:00Z"; }'
    point_csv = (
        "time,zlev,latitude,longitude,sst,anom\n"
        "UTC,m,degrees_north,degrees_east,Celsius,Celsius\n"
        "2026-10-01T12:00:00Z,0.0,35.125,-149.875,23.17,0.36\n"
    ).encode()

    def fake_urlopen(request: object, timeout: int) -> BytesIO:
        url = request.full_url  # type: ignore[attr-defined]
        calls.append(url)
        return BytesIO(metadata if url.endswith(".das") else point_csv)

    monkeypatch.setattr(main, "urlopen", fake_urlopen)
    response = client.get("/api/ocean/oisst", params={"points": "35,-150"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "NOAA NCEI OISST v2.1 near-real-time analysis"
    assert body["time"] == "2026-10-01T12:00:00Z"
    assert body["points"][0]["sst_c"] == 23.17
    assert body["points"][0]["anomaly_c"] == 0.36
    assert body["points"][0]["grid_longitude"] == -149.875
    assert len(calls) == 2


def test_oisst_grid_coordinate_uses_wrapped_longitude_centres() -> None:
    assert main._oisst_grid_coordinate(35, -150) == (35.125, -149.875)
    assert main._oisst_grid_coordinate(0, 180) == (0.125, -179.875)


def test_oisst_raster_returns_png_with_source_date_and_caches(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "_OISST_RASTER_CACHE", {})
    timestamp = main.datetime(2026, 10, 1, 12, tzinfo=main.timezone.utc)
    variables: list[str] = []

    def fake_grid(variable: str, _timestamp: object) -> object:
        variables.append(variable)
        return main.np.full(main._OISST_GRID_SHAPE, 1.0, dtype=main.np.float32)

    monkeypatch.setattr(main, "_oisst_latest_timestamp", lambda: timestamp)
    monkeypatch.setattr(main, "_fetch_oisst_grid", fake_grid)
    response = client.get("/api/ocean/oisst/raster", params={"metric": "anomaly"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert response.headers["X-Data-Time"] == "2026-10-01T12:00:00Z"
    assert response.headers["X-Data-Source"] == "NOAA NCEI OISST v2.1 near-real-time analysis"
    assert variables == ["anom"]
    cached = client.get("/api/ocean/oisst/raster", params={"metric": "anomaly"})
    assert cached.content == response.content
    assert variables == ["anom"]
    assert client.get("/api/ocean/oisst/raster", params={"metric": "invalid"}).status_code == 422


def test_oisst_rejects_out_of_bounds_or_too_many_points(client: TestClient) -> None:
    assert client.get("/api/ocean/oisst", params={"points": "91,0"}).status_code == 422
    points = ";".join(f"{index},0" for index in range(25))
    assert client.get("/api/ocean/oisst", params={"points": points}).status_code == 422
