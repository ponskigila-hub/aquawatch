export interface ForecastBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ForecastFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    prediction: number;
    variable: string;
    horizon_hours: number;
    unit: string;
    row: number;
    column: number;
  };
}

export interface ForecastResponse {
  type: 'FeatureCollection';
  features: ForecastFeature[];
  prediction_matrix: number[][];
  metadata: {
    model_name: string;
    model_status: string;
    input_source: string;
    variable: string;
    horizon_hours: number;
    grid_width: number;
    grid_height: number;
    prediction_unit: string;
    warnings: string[];
  };
}

export interface ForecastRequest {
  bbox: ForecastBBox;
  grid_width: number;
  grid_height: number;
  horizon_hours: number;
  variable: 'precipitation' | 'anomaly';
  spatial_data?: number[][];
}

export async function fetchForecast(request: ForecastRequest): Promise<ForecastResponse> {
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}/api/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.detail === 'string' ? body.detail : `Forecast request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<ForecastResponse>;
}
