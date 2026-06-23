export interface AISPoint {
  mmsi: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog: number; // Speed Over Ground (knots)
  cog: number; // Course Over Ground (degrees)
  isValid?: boolean;
}

export interface PreparedFeature {
  mmsi: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  lat_lag1: number | null;
  lon_lag1: number | null;
  lat_lag2: number | null;
  lon_lag2: number | null;
  sog_lag1: number | null;
  sog_diff: number | null;
  cog_diff: number | null;
  distance_from_lag: number | null; // in km or deg units
}

export interface PredictionResult {
  timestamp: string;
  actual_lat: number;
  actual_lon: number;
  pred_lat: number;
  pred_lon: number;
  error_distance_m: number;
}

export interface AnomalyRecord {
  timestamp: string;
  mmsi: string;
  lat: number;
  lon: number;
  type: 'SOG_SUDDEN' | 'COG_SUDDEN' | 'DEVIATION_HIGH' | 'GEOFENCE_VIOLATION' | 'NOISE_FILTERED' | '위험 구역 항로 이탈';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface VesselPreset {
  mmsi: string;
  name: string;
  type: string;
  description: string;
  points: AISPoint[];
}
