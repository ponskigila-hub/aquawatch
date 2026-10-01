import os

# Keep CI/offline test runs deterministic and avoid downloading model weights.
os.environ.setdefault("AQUAWATCH_DOWNLOAD_PRETRAINED", "false")

import pytest
from fastapi.testclient import TestClient

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
