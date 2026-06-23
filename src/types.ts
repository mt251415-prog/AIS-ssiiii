export interface AISPoint {
  mmsi: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog: number; // Speed (knots)
  cog: number; // Course (degrees)
  heading?: number; // Heading (degrees)
  vesselName?: string;
  callSign?: string;
  lengthTop?: number;
  lengthBottom?: number;
  lengthLeft?: number;
  lengthRight?: number;
  originalRow: Record<string, string>;
}

export interface ColumnMapping {
  mmsi: string | null;
  timestamp: string | null;
  lat: string | null;
  lon: string | null;
  sog: string | null;
  cog: string | null;
  heading: string | null;
  vesselName: string | null;
  callSign: string | null;
  lengthTop: string | null;
  lengthBottom: string | null;
  lengthLeft: string | null;
  lengthRight: string | null;
}

export interface PreparedFeature {
  mmsi: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  heading?: number;
  lat_lag1: number | null;
  lon_lag1: number | null;
  lat_lag2: number | null;
  lon_lag2: number | null;
  sog_diff: number | null;
  cog_diff: number | null;
}

export interface PredictionResult {
  timestamp: string;
  actual_lat: number;
  actual_lon: number;
  pred_lat: number;
  pred_lon: number;
  error_distance_m: number;
}

export interface QualityIssue {
  rowIdx: number;
  mmsi: string;
  timestamp: string;
  column: string;
  value: string;
  issueType: 'MISSING' | 'LIMIT_EXCEEDED' | 'UNREALISTIC' | 'ABSENT_COORDINATE' | 'OUT_OF_RANGE';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface DiagnosticResult {
  isPredictable: boolean;
  totalRecords: number;
  totalVessels: number;
  mappedColumns: { key: string; header: string }[];
  missingRequiredColumns: string[];
  qualityScore: number;
  issues: QualityIssue[];
  missingVesselNameCount: number;
  missingCallSignCount: number;
  missingImoCount: number;
  sogAnomalyCount: number;
  cogAnomalyCount: number;
  headingAnomalyCount: number;
  sizeAnomalyCount: number;
}

export interface VesselPreset {
  mmsi: string;
  name: string;
  type: string;
  description: string;
  points: {
    mmsi: string;
    timestamp: string;
    lat: number;
    lon: number;
    sog: number;
    cog: number;
    originalRow: Record<string, string>;
  }[];
}
