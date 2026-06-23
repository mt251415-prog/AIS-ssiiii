import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Ship, 
  Map as MapIcon, 
  Database, 
  Cpu, 
  FileCode, 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  AlertTriangle, 
  Trash2, 
  Sliders, 
  CheckCircle, 
  Info, 
  Compass, 
  Navigation,
  Globe,
  ChevronRight,
  Sparkles,
  FileText,
  Copy,
  PlusCircle,
  Clock,
  Skull
} from 'lucide-react';
import { VESSEL_PRESETS, jsonToCsv, parseCsv } from './data';
import { AISPoint, PreparedFeature, PredictionResult, AnomalyRecord, VesselPreset } from './types';

export default function App() {
  // Config parameters controlled by users (re-computes ML & rules in real-time!)
  const [maxSpeedKts, setMaxSpeedKts] = useState<number>(40);
  const [lagSteps, setLagSteps] = useState<number>(2);
  const [xgboostEstimators, setXgboostEstimators] = useState<number>(100);
  const [anomalyCofThreshold, setAnomalyCofThreshold] = useState<number>(45);
  
  // Custom Data state
  const [selectedPresetMmsi, setSelectedPresetMmsi] = useState<string>("440123456");
  const [customCsvText, setCustomCsvText] = useState<string>("");
  const [useCustomData, setUseCustomData] = useState<boolean>(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null);
  
  // Radar/GIS Plotter Interaction state
  const [zoomLevel, setZoomLevel] = useState<number>(1.2);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<(AISPoint & { index: number; targetIdx?: number }) | null>(null);
  const [activeTab, setActiveTab] = useState<'radar' | 'features'>('radar');
  
  // Map Layer Toggles
  const [showRestrictedZone, setShowRestrictedZone] = useState<boolean>(true);
  const [showPredictedPath, setShowPredictedPath] = useState<boolean>(true);
  const [showRawDottedLine, setShowRawDottedLine] = useState<boolean>(true);
  const [mapCursorLatLng, setMapCursorLatLng] = useState<{ lat: number; lon: number } | null>(null);

  // Playback Animation States
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentPlayIdx, setCurrentPlayIdx] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // ms multiplier

  // Toast / System Audit logs
  const [systemLogs, setSystemLogs] = useState<string[]>(["[이벤트] AIS 감시 모니터링 시스템 부팅 완료 - 34°N, 129°E"]);

  // Grab active vessel dataset
  const currentVesselData = useMemo(() => {
    if (useCustomData) {
      const parsed = parseCsv(customCsvText);
      return {
        mmsi: "CUSTOM",
        name: "사용자 업로드 선박",
        type: "Custom Vessel Stream",
        description: "사용자가 수동으로 입력하거나 업로드한 AIS 정형 시계열 데이터셋입니다.",
        points: parsed
      };
    }
    const found = VESSEL_PRESETS.find(v => v.mmsi === selectedPresetMmsi);
    return found || VESSEL_PRESETS[0];
  }, [selectedPresetMmsi, useCustomData, customCsvText]);

  // Sync custom CSV textarea with preset when switched
  useEffect(() => {
    if (!useCustomData) {
      const preset = VESSEL_PRESETS.find(v => v.mmsi === selectedPresetMmsi);
      if (preset) {
        setCustomCsvText(jsonToCsv(preset.points));
      }
    }
  }, [selectedPresetMmsi, useCustomData]);

  // 1. Data Cleaning Stage (TypeScript Engine)
  const cleaningResult = useMemo(() => {
    const raw = currentVesselData.points;
    const removed: AISPoint[] = [];
    const cleaned: AISPoint[] = [];

    raw.forEach((p) => {
      // 1. Invalid coordinates checks
      const isLatValid = p.lat >= 30 && p.lat <= 40;
      const isLonValid = p.lon >= 120 && p.lon <= 135;
      // 2. Realistic Speed Over Ground checklist
      const isSpeedNormal = p.sog >= 0 && p.sog <= maxSpeedKts;

      if (isLatValid && isLonValid && isSpeedNormal) {
        cleaned.push({ ...p, isValid: true });
      } else {
        removed.push({ ...p, isValid: false });
      }
    });

    // Time-series sorting
    cleaned.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { cleaned, removed };
  }, [currentVesselData, maxSpeedKts]);

  // helper distance formula
  const getKmDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 2. Feature Engineering Logic (TypeScript Engine)
  const engineeredData = useMemo(() => {
    const { cleaned } = cleaningResult;
    const features: PreparedFeature[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const current = cleaned[i];
      const lag1 = i >= 1 ? cleaned[i - 1] : null;
      const lag2 = i >= 2 ? cleaned[i - 2] : null;

      const sog_diff = lag1 ? Number((current.sog - lag1.sog).toFixed(2)) : 0;
      const cog_raw_diff = lag1 ? current.cog - lag1.cog : 0;
      // COG wrapping to -180 to 180
      const cog_diff = lag1 ? Number((((cog_raw_diff + 180) % 360 + 360) % 360 - 180).toFixed(1)) : 0;
      
      const dist = lag1 ? Number(getKmDistance(current.lat, current.lon, lag1.lat, lag1.lon).toFixed(3)) : 0;

      features.push({
        mmsi: current.mmsi,
        timestamp: current.timestamp,
        lat: current.lat,
        lon: current.lon,
        sog: current.sog,
        cog: current.cog,
        lat_lag1: lag1 ? lag1.lat : null,
        lon_lag1: lag1 ? lag1.lon : null,
        lat_lag2: lag2 ? lag2.lat : null,
        lon_lag2: lag2 ? lag2.lon : null,
        sog_lag1: lag1 ? lag1.sog : null,
        sog_diff,
        cog_diff,
        distance_from_lag: dist
      });
    }

    return features;
  }, [cleaningResult]);

  // 3. Predictive Lookahead Engine (Simulates physics-based inertially-corrected neural prediction or LightGBM model)
  const predictionResults = useMemo(() => {
    const features = engineeredData;
    const predictions: PredictionResult[] = [];

    for (let i = 0; i < features.length - 1; i++) {
      const current = features[i];
      const nextActual = features[i + 1];

      // Physical kinematic dead reckoning vector
      // SOG conversion from knots to degrees per 5min
      // 1 knot = 0.514 m/s. 5min = 300sec. Dist = 154 meters per knot.
      // Lat degree = ~111.3 km. Lon degree = ~111.3 * cos(lat) km.
      const scaleKtsToLat = (154.2 / 111320); 
      const scaleKtsToLon = (154.2 / (111320 * Math.cos(current.lat * Math.PI / 180)));

      const rad = (current.cog * Math.PI) / 180;
      
      // Theoretical kinematic point
      const kinematicLat = current.lat + (current.sog * Math.cos(rad) * scaleKtsToLat);
      const kinematicLon = current.lon + (current.sog * Math.sin(rad) * scaleKtsToLon);

      // LightGBM / XGBoost correction simulation - learns vessel custom steering habits and lag adjustments
      // If there are previous lag values, it weights the direction inertia
      let regressedLat = kinematicLat;
      let regressedLon = kinematicLon;

      if (current.lat_lag1 && current.lon_lag1) {
        // Model extracts inertial momentum (t - (t-1)) weight
        const inertiaWeight = 0.12; 
        const momentumLat = current.lat - current.lat_lag1;
        const momentumLon = current.lon - current.lon_lag1;
        
        // Simulates modeling tree ensemble adjustments (including estimators count correction factor)
        const estimatorFactor = Math.min(1.2, xgboostEstimators / 100);
        regressedLat += (momentumLat * inertiaWeight * estimatorFactor);
        regressedLon += (momentumLon * inertiaWeight * estimatorFactor);
      }

      // Add a touch of natural water drift / wind error to avoid perfect cheat predictions
      const seaDriftLat = Math.sin(current.lon * 50) * 0.00015;
      const seaDriftLon = Math.cos(current.lat * 50) * 0.00018;

      const pred_lat = Number((regressedLat + seaDriftLat).toFixed(5));
      const pred_lon = Number((regressedLon + seaDriftLon).toFixed(5));

      // Coordinate offset error in meters
      const err_km = getKmDistance(nextActual.lat, nextActual.lon, pred_lat, pred_lon);
      const error_distance_m = Math.round(err_km * 1000);

      predictions.push({
        timestamp: nextActual.timestamp,
        actual_lat: nextActual.lat,
        actual_lon: nextActual.lon,
        pred_lat,
        pred_lon,
        error_distance_m
      });
    }

    return predictions;
  }, [engineeredData, xgboostEstimators]);

  // Busan Base Security Zone boundary definition to check geofence alarm range
  // Simple Box: Lat: 34.80 ~ 34.85, Lon: 129.48 ~ 129.53
  const isInsideRestrictedZone = (lat: number, lon: number) => {
    return lat >= 34.80 && lat <= 34.84 && lon >= 129.48 && lon <= 129.53;
  };

  // 4. Anomaly Monitoring Suite
  const anomaliesList = useMemo(() => {
    const list: AnomalyRecord[] = [];
    
    // Add noise points removed from preprocessing phase
    cleaningResult.removed.forEach((p, idx) => {
      list.push({
        timestamp: p.timestamp,
        mmsi: p.mmsi,
        lat: p.lat,
        lon: p.lon,
        type: 'NOISE_FILTERED',
        severity: 'low',
        message: `[MMSI: ${p.mmsi}] 비현실적인 기형 데이터 (${p.sog} kts) 전처리 필터로 감지 및 소거`
      });
    });

    // Check engineered sequence
    engineeredData.forEach((feat, index) => {
      // Alarm 1: SOG Sudden Accel/Decel Check
      if (feat.sog_diff !== null && Math.abs(feat.sog_diff) > 6.0) {
        list.push({
          timestamp: feat.timestamp,
          mmsi: feat.mmsi,
          lat: feat.lat,
          lon: feat.lon,
          type: 'SOG_SUDDEN',
          severity: Math.abs(feat.sog_diff) > 10 ? 'high' : 'medium',
          message: `[MMSI: ${feat.mmsi}] SOG 급변경 감지: 5분 새 ${feat.sog_diff} kts 변화`
        });
      }

      // Alarm 2: COG Sudden shift check
      if (feat.cog_diff !== null && Math.abs(feat.cog_diff) > anomalyCofThreshold) {
        list.push({
          timestamp: feat.timestamp,
          mmsi: feat.mmsi,
          lat: feat.lat,
          lon: feat.lon,
          type: 'COG_SUDDEN',
          severity: Math.abs(feat.cog_diff) > 75 ? 'high' : 'medium',
          message: `[MMSI: ${feat.mmsi}] 조타 방향 급회전 감지: COG ${feat.cog_diff}° 급변`
        });
      }

      // Alarm 3: Restricted Geofence Trespass checklist
      if (isInsideRestrictedZone(feat.lat, feat.lon)) {
        list.push({
          timestamp: feat.timestamp,
          mmsi: feat.mmsi,
          lat: feat.lat,
          lon: feat.lon,
          type: 'GEOFENCE_VIOLATION',
          severity: 'high',
          message: `[MMSI: ${feat.mmsi}] 대한민국 해군 해역 통제구역 진입 감지 (위경도: ${feat.lat}, ${feat.lon})`
        });
      }
    });

    // Alarm 4: Machine Learning predictive path error deviation check
    predictionResults.forEach((pred) => {
      if (pred.error_distance_m > 480) {
        list.push({
          timestamp: pred.timestamp,
          mmsi: currentVesselData.mmsi,
          lat: pred.actual_lat,
          lon: pred.actual_lon,
          type: '위험 구역 항로 이탈',
          severity: pred.error_distance_m > 900 ? 'high' : 'medium',
          message: `[MMSI: ${currentVesselData.mmsi}] 인공지능이 계산한 정상 범위를 벗어난 의심 기동 포착 (이격 거리: ${pred.error_distance_m}m)`
        });
      }
    });

    return list.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [cleaningResult, engineeredData, predictionResults, anomalyCofThreshold, currentVesselData.mmsi]);

  // Overall Statistics Metrics
  const summaryMetrics = useMemo(() => {
    const rawCount = currentVesselData.points.length;
    const cleanCount = cleaningResult.cleaned.length;
    const noiseCount = cleaningResult.removed.length;
    
    // Average Prediction Error
    const errors = predictionResults.map(p => p.error_distance_m);
    const avgPredictionError = errors.length > 0 ? Math.round(errors.reduce((sum, e) => sum + e, 0) / errors.length) : 0;
    
    // Safety score out of 100 based on anomalies severity
    let penalty = 0;
    anomaliesList.forEach(a => {
      if (a.severity === 'high') penalty += 18;
      else if (a.severity === 'medium') penalty += 8;
      else penalty += 2;
    });
    const safetyScore = Math.max(10, 100 - penalty);

    return {
      rawCount,
      cleanCount,
      noiseCount,
      avgPredictionError,
      safetyScore
    };
  }, [currentVesselData, cleaningResult, predictionResults, anomaliesList]);

  // Sync animation bounds
  useEffect(() => {
    if (currentPlayIdx >= cleaningResult.cleaned.length) {
      setCurrentPlayIdx(0);
    }
  }, [cleaningResult.cleaned]);

  // Playback Interval Control
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAnimating) {
      timer = setInterval(() => {
        setCurrentPlayIdx(prev => {
          if (prev >= cleaningResult.cleaned.length - 1) {
            setIsAnimating(false);
            setSystemLogs(l => [...l.slice(-15), `[알림] AIS 시나리오 모니터링 주행 재생 완료`]);
            return 0;
          }
          const nextIdx = prev + 1;
          
          // Generate a log on specific events during playback
          const point = cleaningResult.cleaned[nextIdx];
          const pointAnomalies = anomaliesList.filter(a => a.timestamp === point.timestamp);
          
          if (pointAnomalies.length > 0) {
            const worstAlert = pointAnomalies[0];
            const severityKo = worstAlert.severity === 'high' ? '🚨심각' : '⚠️경고';
            setSystemLogs(l => [...l.slice(-15), `[${severityKo}] ${worstAlert.message}`]);
          } else {
            setSystemLogs(l => [...l.slice(-15), `[관제] MMSI ${point.mmsi} 순차 모니터링 - Lat: ${point.lat.toFixed(3)}, Lon: ${point.lon.toFixed(3)} | SOG: ${point.sog} kts`]);
          }

          return nextIdx;
        });
      }, 3000 / playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAnimating, cleaningResult.cleaned, anomaliesList, playbackSpeed]);

  // Dynamic coordinates bounding box calculations for SVG Auto-fitting
  const mapBounds = useMemo(() => {
    const pts = currentVesselData.points;
    if (pts.length === 0) {
      return { minLat: 34.0, maxLat: 36.0, minLon: 128.0, maxLon: 130.0 };
    }
    const lats = pts.map(p => p.lat);
    const lons = pts.map(p => p.lon);
    
    // Add manual buffering to keep standard bounds consistent
    const minLat = Math.min(...lats) - 0.08;
    const maxLat = Math.max(...lats) + 0.08;
    const minLon = Math.min(...lons) - 0.08;
    const maxLon = Math.max(...lons) + 0.08;

    return { minLat, maxLat, minLon, maxLon };
  }, [currentVesselData]);

  // Convert Latitude / Longitude into beautiful SVG Cartographic coordinate space points (X: 0~100, Y: 0~100)
  const getSvgCoordinates = (lat: number, lon: number) => {
    const latRange = mapBounds.maxLat - mapBounds.minLat;
    const lonRange = mapBounds.maxLon - mapBounds.minLon;

    // Percentages mapping with inverted Latitude (since SVG Y proceeds downward)
    const x = ((lon - mapBounds.minLon) / lonRange) * 100;
    const y = (1 - (lat - mapBounds.minLat) / latRange) * 100;

    return {
      x: x * zoomLevel + panOffset.x,
      y: y * zoomLevel + panOffset.y
    };
  };

  // Pre-calculate SVG positions for original raw, cleaned, and predictions lists
  const svgLines = useMemo(() => {
    const rawSvg = currentVesselData.points.map(p => ({ ...p, ...getSvgCoordinates(p.lat, p.lon) }));
    const preproSvg = cleaningResult.cleaned.map((p, idx) => ({ ...p, ...getSvgCoordinates(p.lat, p.lon), index: idx }));
    const predSvg = predictionResults.map(p => ({
      ...p,
      actual: getSvgCoordinates(p.actual_lat, p.actual_lon),
      pred: getSvgCoordinates(p.pred_lat, p.pred_lon)
    }));

    return { rawSvg, preproSvg, predSvg };
  }, [currentVesselData.points, cleaningResult.cleaned, predictionResults, zoomLevel, panOffset, mapBounds]);

  // Busan region mock ports coordinates to lay beautifully as landmarks
  const landMarks = [
    { name: "BUSAN HARBOR (부산북항)", lat: 35.105, lon: 129.045 },
    { name: "YONGDO ISL. (영도)", lat: 35.071, lon: 129.068 },
    { name: "ORYUKDO KEYS (오륙도)", lat: 35.093, lon: 129.123 },
    { name: "GADEOK ISL. (가덕도)", lat: 35.020, lon: 128.835 },
    { name: "WEST CHANNEL (서해안 수로)", lat: 34.900, lon: 128.950 },
    { name: "TSUSHIMA PASS (대마도 수로)", lat: 34.580, lon: 129.650 },
  ];

  // Restricted polygon coordinates in SVG coords
  const restrictedAreaPointsStr = useMemo(() => {
    // Area corners
    const c1 = getSvgCoordinates(34.84, 129.48);
    const c2 = getSvgCoordinates(34.84, 129.53);
    const c3 = getSvgCoordinates(34.80, 129.53);
    const c4 = getSvgCoordinates(34.80, 129.48);
    return `${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}`;
  }, [zoomLevel, panOffset, mapBounds]);

  // Handle active file uploading parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCustomCsvText(text);
        setUseCustomData(true);
        setSystemLogs(l => [...l, `[업로드] 외부 CSV 파일 성공적으로 주입됨 (${file.name})`]);
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIndex(label);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const resetMapMatrix = () => {
    setZoomLevel(1.2);
    setPanOffset({ x: 0, y: 0 });
    setSystemLogs(l => [...l, `[관제] 관제 화면 스케일 중앙화 완료`]);
  };

  // Convert map canvas mouse position to actual geographic Latitude / Longitude
  const handleMapMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentX = (e.clientX - rect.left) / rect.width;
    const percentY = (e.clientY - rect.top) / rect.height;

    // Inverse Zooming/Panning
    const originalPercentX = (percentX * 100 - panOffset.x) / zoomLevel;
    const originalPercentY = (percentY * 100 - panOffset.y) / zoomLevel;

    const latRange = mapBounds.maxLat - mapBounds.minLat;
    const lonRange = mapBounds.maxLon - mapBounds.minLon;

    const lon = mapBounds.minLon + (originalPercentX / 100) * lonRange;
    const lat = mapBounds.maxLat - (originalPercentY / 100) * latRange;

    if (lat >= 30 && lat <= 40 && lon >= 120 && lon <= 135) {
      setMapCursorLatLng({ lat, lon });
    } else {
      setMapCursorLatLng(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-theme text-slate-100 font-sans flex flex-col antialiased selection:bg-accent-theme/30 selection:text-accent-theme">
      
      {/* HEADER SECTION WITH MARINE RADAR COMMAND HUD TITLE */}
      <header className="border-b border-border-theme bg-panel-theme px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded bg-accent-theme/5 border border-accent-theme/35 text-accent-theme">
            <span className="absolute inline-flex h-2 w-2 rounded bg-accent-theme animate-ping" />
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-accent-theme/10 text-accent-theme border border-accent-theme/30 font-bold uppercase tracking-wider">SYSTEM OPERATIONAL</span>
              <span className="text-xs font-mono text-slate-500">v3.42 - 산호초 보호 인공지능</span>
            </div>
            <h1 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2 mt-0.5">
              인공지능 기반 산호초 보호 및 해양 오염원 실시간 감시 시스템
            </h1>
          </div>
        </div>

        {/* TOP DASHBOARD COUNTER BADGES */}
        <div className="flex flex-wrap items-center gap-2.5 md:gap-4 md:ml-auto">
          <div className="px-3 py-1.5 rounded border border-border-theme bg-panel-theme flex items-center gap-2 min-w-[130px]">
            <Database className="w-4 h-4 text-accent-theme" />
            <div>
              <div className="text-[9px] text-slate-500 font-mono font-bold leading-none uppercase tracking-wider">AIS RAW RECORDS</div>
              <div className="text-xs font-bold text-white font-mono mt-0.5">{summaryMetrics.rawCount} <span className="text-[10px] font-normal text-slate-500">Pts</span></div>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded border border-border-theme bg-panel-theme flex items-center gap-2 min-w-[130px]">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[9px] text-slate-500 font-mono font-bold leading-none uppercase tracking-wider">PREPROCESSED</div>
              <div className="text-xs font-bold text-white font-mono mt-0.5">
                {summaryMetrics.cleanCount} <span className="text-[10px] text-emerald-400 font-normal">({Math.round((summaryMetrics.cleanCount/summaryMetrics.rawCount)*100) || 100}%)</span>
              </div>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded border border-red-950/45 bg-red-950/10 flex items-center gap-2 min-w-[130px]">
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            <div>
              <div className="text-[9px] text-rose-500/80 font-mono font-bold leading-none uppercase tracking-wider">ANOMALY DETECTED</div>
              <div className="text-xs font-bold text-rose-400 font-mono mt-0.5">{anomaliesList.length} <span className="text-[10px] font-normal text-rose-600/80">Alerts</span></div>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded border border-border-theme bg-panel-theme flex items-center gap-2 min-w-[130px]">
            <Cpu className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[9px] text-slate-500 font-mono font-bold leading-none uppercase tracking-wider">인공지능 경로 분석</div>
              <div className="text-xs font-bold text-white mt-0.5">
                정상 오차 범위: 300m 이내
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT GRID */}
      <div className="grow grid grid-cols-1 xl:grid-cols-12 overflow-hidden">
        
        {/* LEFT COLUMN: ACTIVE INTERACTIVE PIPELINE CONTROLLERS */}
        <section className="xl:col-span-3 border-r border-border-theme bg-bg-theme flex flex-col overflow-y-auto max-h-[calc(100vh-73px)] custom-scrollbar">
          
          {/* STEP 1: SELECT / UPLOAD AIS SCENARIO DATASETS */}
          <div className="p-4 border-b border-border-theme">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono font-bold bg-accent-theme text-bg-theme w-5 h-5 rounded flex items-center justify-center shadow-md">1</span>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-display">[1] 감시 대상 선박 선택</h2>
            </div>

            {/* PRESETS NAVIGATION ACCORDION */}
            <div className="space-y-1.5 mb-3.5">
              {VESSEL_PRESETS.map((vsel) => (
                <button
                  key={vsel.mmsi}
                  id={`preset-btn-${vsel.mmsi}`}
                  onClick={() => {
                    setSelectedPresetMmsi(vsel.mmsi);
                    setUseCustomData(false);
                    setCurrentPlayIdx(0);
                    setIsAnimating(false);
                    setSystemLogs(l => [...l, `[연동] 선박 프리셋 로드 - ${vsel.name} | MMSI: ${vsel.mmsi}`]);
                  }}
                  className={`w-full text-left p-2.5 rounded border transition-all flex items-center justify-between ${
                    !useCustomData && selectedPresetMmsi === vsel.mmsi
                      ? 'bg-panel-theme border-accent-theme text-white border-l-4 shadow-sm'
                      : 'bg-panel-theme/40 border-border-theme text-slate-400 hover:text-slate-200 hover:bg-panel-theme'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Ship className={`w-4 h-4 ${!useCustomData && selectedPresetMmsi === vsel.mmsi ? 'text-accent-theme' : 'text-slate-500'}`} />
                    <div className="truncate">
                      <div className="text-xs font-bold font-display truncate">{vsel.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">MMSI: {vsel.mmsi}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-55" />
                </button>
              ))}
            </div>

            {/* CUSTOM DATA SECTION */}
            <div className="p-2.5 rounded border border-border-theme bg-panel-theme/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <PlusCircle className="w-3 h-3 text-accent-theme" />
                  실제 CSV 주입구 (직접 업로드 / 붙여넣기)
                </span>
                {useCustomData && (
                  <span className="text-[9px] font-mono bg-accent-theme/10 text-accent-theme border border-accent-theme/20 px-1.5 py-0.5 rounded-sm font-bold">ACTIVE</span>
                )}
              </div>

              {/* CSV Upload tool */}
              <label className="flex items-center justify-center gap-2 w-full border border-dashed border-border-theme hover:border-accent-theme/40 hover:bg-panel-theme/50 p-2 rounded cursor-pointer text-xs font-mono text-slate-400 transition-all mb-2">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>로컬 CSV 파일 주입...</span>
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>

              {/* Switch to custom manually */}
              <button
                id="use-custom-csv-btn"
                onClick={() => {
                  setUseCustomData(true);
                  setSystemLogs(l => [...l, `[수동] 주입된 CSV 버퍼 데이터로 모니터링 전환 완료`]);
                }}
                className={`w-full py-1.5 px-3 rounded text-center text-xs font-semibold border transition-all font-mono tracking-wider ${
                  useCustomData 
                    ? 'bg-accent-theme/10 text-accent-theme border-accent-theme/40 font-bold'
                    : 'bg-panel-theme/40 hover:bg-panel-theme hover:text-white text-slate-400 border-border-theme'
                }`}
              >
                주입된 CSV 데이터 분석기 가동
              </button>
            </div>
          </div>

          {/* STEP 2: ML TUNING & OUTLIER SETTINGS SLIDERS */}
          <div className="p-4 border-b border-border-theme bg-panel-theme/10 mb-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-bold bg-accent-theme text-bg-theme w-5 h-5 rounded flex items-center justify-center shadow-md">2</span>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-display">지능형 오염 감시 알고리즘 설정</h2>
            </div>

            <div className="space-y-4">
              {/* SLIDER 1: SOG Noise Filter limit */}
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <Info className="w-3.5 h-3.5 text-accent-theme" />
                    전처리 단계: 비정상 데이터 필터링 속도 (최대 40노트)
                  </span>
                  <span className="font-mono text-accent-theme font-bold">{maxSpeedKts} kts</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="60"
                  value={maxSpeedKts}
                  onChange={(e) => {
                    setMaxSpeedKts(Number(e.target.value));
                    setSystemLogs(l => [...l, `[파라미터 변경] 최대 속도 필터 기준치: ${e.target.value}kts`]);
                  }}
                  className="w-full h-1.5 bg-border-theme rounded appearance-none cursor-pointer accent-accent-theme"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  지정 속력 {maxSpeedKts} kts를 초과하는 수치는 송수신 에러 및 비현실적인 기형 노이즈로 간주하고 여과 처리합니다.
                </p>
              </div>

              {/* SLIDER 2: Turn Rate COG Anomaly trigger */}
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    오염 의심 기준: 5분간 급격한 방향 전환 각도 (45°)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">±{anomalyCofThreshold}°</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={anomalyCofThreshold}
                  onChange={(e) => {
                    setAnomalyCofThreshold(Number(e.target.value));
                    setSystemLogs(l => [...l, `[파라미터 변경] 방향 급회전 기준각: ±${e.target.value}°`]);
                  }}
                  className="w-full h-1.5 bg-border-theme rounded appearance-none cursor-pointer accent-accent-theme"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  5분 동안 선박 항로 방향이 {anomalyCofThreshold}도 이상 급변경될 시 비정상 회운 기동으로 식별해 오염 가능성 경보를 울립니다.
                </p>
              </div>

              {/* SLIDER 3: ML History Lags used */}
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    인공지능이 참고할 과거 위치 기억 데이터 개수
                  </span>
                  <span className="font-mono text-slate-500 font-bold">{lagSteps}개 지점</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={lagSteps}
                  disabled
                  className="w-full h-1.5 bg-border-theme rounded appearance-none opacity-40 cursor-not-allowed accent-gray-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  직전 2회분(t-1, t-2) 선박 위치 이력을 실시간 인공지능이 기억하여 연속 운항 추적 알고리즘에 활용합니다.
                </p>
              </div>

              {/* SLIDER 4: XGBoost / LightGBM Estimators */}
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    인공지능 가상 탐색 경로 수 (정밀도)
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{xgboostEstimators} 조합</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="50"
                  value={xgboostEstimators}
                  onChange={(e) => {
                    setXgboostEstimators(Number(e.target.value));
                    setSystemLogs(l => [...l, `[파라미터 변경] 예측 시뮬레이션 탐색 규모: ${e.target.value}개`]);
                  }}
                  className="w-full h-1.5 bg-border-theme rounded appearance-none cursor-pointer accent-accent-theme"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  인공지능 시뮬레이션의 가상 예측 갈래 수를 정밀하게 조합하여, 굴곡이 불규칙한 해해안선 오차를 최소화합니다.
                </p>
              </div>
            </div>
          </div>

          {/* ACTIVE VESSEL INFO SUMMARY CARD */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/80 w-full select-none mt-auto">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              모니터링 대상 정보
            </h3>
            <div className="text-xs bg-slate-900/60 p-2 text-slate-300 rounded-lg border border-slate-900 space-y-1">
              <div className="font-bold text-slate-100">{currentVesselData.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">선종: {currentVesselData.type}</div>
              <div className="text-[10px] text-slate-400 font-mono">데이터 상태: {cleaningResult.removed.length > 0 ? `노이즈 ${cleaningResult.removed.length}건 정화됨` : "결측 정비 완료"}</div>
              <div className="text-[10px] text-slate-500 italic leading-relaxed py-1.5 border-t border-slate-800 mt-1.5">
                {currentVesselData.description}
              </div>
            </div>
          </div>

        </section>

        {/* CENTER COLUMN: GIS MAP PLOTTER & VISUAL METRIC CONTROL */}
        <main className="xl:col-span-9 bg-slate-950 flex flex-col min-h-0 overflow-y-auto xl:overflow-hidden max-h-[calc(100vh-73px)]">
          
          {/* VIEW / TAB SELECTION PANELS */}
          <div className="border-b border-slate-900 bg-slate-900/40 px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex bg-slate-950/80 border border-slate-800 p-0.5 rounded-lg w-full sm:w-auto">
              {/* TAB 1: GIS Radar plotter */}
              <button
                id="tab-radar"
                onClick={() => setActiveTab('radar')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold tracking-wider uppercase transition-all ${
                  activeTab === 'radar' 
                    ? 'bg-gradient-to-r from-teal-500/10 to-sky-500/10 border border-teal-500/30 text-teal-400' 
                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                선박 관제 레이더
              </button>

              {/* TAB 2: Features table proofing */}
              <button
                id="tab-features"
                onClick={() => setActiveTab('features')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold tracking-wider uppercase transition-all ${
                  activeTab === 'features' 
                    ? 'bg-gradient-to-r from-teal-500/10 to-sky-500/10 border border-teal-500/30 text-teal-400' 
                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                시계열 지연(Lag) 변수 검증기
              </button>
            </div>

            {/* MAP CONFIG CONTROLS (Only visible on radar tab) */}
            {activeTab === 'radar' && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showRestrictedZone} 
                    onChange={() => setShowRestrictedZone(!showRestrictedZone)} 
                    className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0 focus:ring-offset-0"
                  />
                  산호초 보호구역(Geofence) 경계 표시
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showPredictedPath} 
                    onChange={() => setShowPredictedPath(!showPredictedPath)} 
                    className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0 focus:ring-offset-0"
                  />
                  인공지능 안전 예측 경로 표시
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showRawDottedLine} 
                    onChange={() => setShowRawDottedLine(!showRawDottedLine)} 
                    className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0 focus:ring-offset-0"
                  />
                  노이즈 원천궤적 복구
                </label>
              </div>
            )}
          </div>

          <div className="grow flex flex-col min-h-0 overflow-y-auto xl:overflow-hidden select-none">
            {activeTab === 'radar' && (
              <div className="grow grid grid-cols-1 xl:grid-cols-4 min-h-0">
                {/* 1. INTERACTIVE MAPPING RADAR CONTAINER */}
                <div className="xl:col-span-3 flex flex-col relative bg-slate-950 border-b xl:border-b-0 xl:border-r border-slate-900 min-h-[460px] xl:min-h-0">
                  
                  {/* PLAYBACK & ANIMATION CONTROLLER FLOATER */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-2xl">
                    <button
                      id="play-simulation-btn"
                      onClick={() => {
                        setIsAnimating(!isAnimating);
                        setSystemLogs(l => [...l, isAnimating ? `[시뮬레이터] 주행 일시 정지` : `[시뮬레이터] 순차 이상 감시 실시간 재생 시작 (배속: ${playbackSpeed}x)`]);
                      }}
                      className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                        isAnimating 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                          : 'bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20'
                      }`}
                      title={isAnimating ? "일시정지" : "시나리오 재생"}
                    >
                      {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <button
                      id="reset-simulation-btn"
                      onClick={() => {
                        setCurrentPlayIdx(0);
                        setIsAnimating(false);
                        setSystemLogs(l => [...l, `[시뮬레이터] 관제 이력 인덱스 초기화`]);
                      }}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                      title="주행 초기화"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <span className="w-px h-6 bg-slate-800" />

                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold leading-none uppercase">실시간 항해 시뮬레이션 재생</span>
                      <span className="text-xs font-mono font-bold text-white mt-0.5">
                        {currentPlayIdx + 1 < 10 ? `0${currentPlayIdx + 1}` : currentPlayIdx + 1} / {cleaningResult.cleaned.length < 10 ? `0${cleaningResult.cleaned.length}` : cleaningResult.cleaned.length} Pts
                      </span>
                    </div>

                    <span className="w-px h-6 bg-slate-800" />

                    {/* Speeds Controls */}
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 4].map(s => (
                        <button
                          key={s}
                          onClick={() => setPlaybackSpeed(s)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                            playbackSpeed === s
                              ? 'bg-teal-500 text-slate-950 font-bold border-teal-400'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ZOOM / MOVEMENT CONTROL MODULE */}
                  <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg">
                    <button
                      onClick={() => setZoomLevel(z => Math.min(4, z + 0.2))}
                      className="w-8 h-8 flex items-center justify-center font-bold text-lg bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-all"
                      title="확대"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))}
                      className="w-8 h-8 flex items-center justify-center font-bold text-lg bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-all"
                      title="축소"
                    >
                      -
                    </button>
                    <button
                      onClick={resetMapMatrix}
                      className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-800 text-slate-400 rounded border border-slate-800 transition-all"
                      title="중앙 리셋"
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                  </div>

                  {/* MAP VIEWPORT CONTAINER SVG ELEMENT */}
                  <div className="grow w-full h-full min-h-[380px] select-none relative bg-slate-950 text-slate-100 flex items-center justify-center overflow-hidden">
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full cursor-crosshair"
                      onMouseMove={handleMapMouseMove}
                      onMouseLeave={() => setMapCursorLatLng(null)}
                    >
                      {/* Grid background lines */}
                      <g stroke="#1e293b" strokeWidth="0.08" strokeDasharray="3,3">
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`lh-${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} />
                        ))}
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`lv-${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" />
                        ))}
                      </g>

                      {/* Map coordinate axis markers */}
                      <g className="text-[2px] font-mono fill-slate-700 tracking-wider">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const lon = mapBounds.minLon + (i / 4) * (mapBounds.maxLon - mapBounds.minLon);
                          const lat = mapBounds.minLat + (i / 4) * (mapBounds.maxLat - mapBounds.minLat);
                          return (
                            <React.Fragment key={`axis-${i}`}>
                              <text x={i * 25 + 1} y="98">{lon.toFixed(2)}°E</text>
                              <text x="1" y={(1 - i / 4) * 96 + 3}>{lat.toFixed(2)}°N</text>
                            </React.Fragment>
                          );
                        })}
                      </g>

                      {/* LAND ISLAND MASSES (Simulated Korean Coast boundary layout mapping) */}
                      <path
                        d="M -10,30 Q 15,28 30,5 Q 40,-10 60,-10 C 70,5 82,2 96,-15 L 120,-10 L 120,120 L -10,120 Z"
                        fill="#091124"
                        stroke="#1e293b"
                        strokeWidth="0.3"
                        opacity="0.85"
                      />

                      {/* Dynamic Landmark Points */}
                      {landMarks.map((lm, idx) => {
                        const coords = getSvgCoordinates(lm.lat, lm.lon);
                        return (
                          <g key={`lm-${idx}`}>
                            <circle cx={coords.x} cy={coords.y} r="0.4" fill="#64748b" opacity="0.6" />
                            <text 
                              x={coords.x + 0.9} 
                              y={coords.y + 0.4} 
                              className="text-[1.8px] font-mono fill-slate-400 select-none pointer-events-none tracking-widest uppercase"
                            >
                              {lm.name}
                            </text>
                          </g>
                        );
                      })}

                      {/* MILITARY CLOSED GEOFENCED HIGH-RISK BOX ALARM REGION */}
                      {showRestrictedZone && (
                        <g>
                          <polygon
                            points={restrictedAreaPointsStr}
                            fill="rgba(239, 68, 68, 0.08)"
                            stroke="#ef4444"
                            strokeWidth="0.35"
                            strokeDasharray="1,1"
                          />
                          <text
                            x={getSvgCoordinates(34.82, 129.505).x}
                            y={getSvgCoordinates(34.82, 129.505).y}
                            textAnchor="middle"
                            className="text-[1.8px] font-semibold fill-red-400 font-display tracking-widest uppercase animate-pulse"
                          >
                            ⚠️ 부산통제구역 (훈련 해역)
                          </text>
                        </g>
                      )}

                      {/* CORAL REEF PROTECTED GEOFENCE - HAZARD AREA */}
                      {showRestrictedZone && (
                        <g>
                          <circle
                            cx={getSvgCoordinates(34.68, 129.04).x}
                            cy={getSvgCoordinates(34.68, 129.04).y}
                            r={5.5 * zoomLevel}
                            fill="rgba(244, 63, 94, 0.06)"
                            stroke="#f43f5e"
                            strokeWidth="0.3"
                            strokeDasharray="2,2"
                          />
                          <text
                            x={getSvgCoordinates(34.68, 129.04).x}
                            y={getSvgCoordinates(34.68, 129.04).y}
                            textAnchor="middle"
                            className="text-[1.8px] font-semibold fill-rose-400 font-display tracking-wide uppercase animate-pulse"
                          >
                            ⚠️ 산호초 보호 구역 (위험 지대)
                          </text>
                        </g>
                      )}

                      {/* 1. ORIGINAL RAW PATH TRAILS (DOTTED GRAY WITH HIGH TEMPERATURE DEVIATION) */}
                      {showRawDottedLine && (
                        <g>
                          <polyline
                            points={svgLines.rawSvg.map(p => `${p.x},${p.y}`).join(" ")}
                            fill="none"
                            stroke="#475569"
                            strokeWidth="0.25"
                            strokeDasharray="2,2"
                            opacity="0.7"
                          />
                          {svgLines.rawSvg.map((p, idx) => (
                            <circle
                              key={`raw-${idx}`}
                              cx={p.x}
                              cy={p.y}
                              r="0.55"
                              fill="#334155"
                              stroke="#64748b"
                              strokeWidth="0.1"
                              opacity="0.6"
                              className="cursor-pointer hover:scale-150 transition-transform"
                              onMouseEnter={() => setHoveredPoint({ ...p, index: idx })}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          ))}
                        </g>
                      )}

                      {/* 2. CHOSEN CLEAN PREPROCESSED PATH TRAILING (SOLID HIGHLIGHT CYAN) */}
                      <g>
                        <polyline
                          points={svgLines.preproSvg.map(p => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="0.45"
                        />
                        {svgLines.preproSvg.map((p, idx) => {
                          const isAnimatedPosition = idx === currentPlayIdx;
                          const hasLocalAnomaly = anomaliesList.some(a => a.timestamp === p.timestamp && a.type !== 'NOISE_FILTERED');
                          
                          return (
                            <g key={`clean-${idx}`}>
                              {/* Glowing pulsators for selected playback or local anomalies */}
                              {isAnimatedPosition && (
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="2"
                                  className="fill-teal-400/20 stroke-teal-300 stroke-[0.1] origin-center scale-150 animate-radar-ring"
                                />
                              )}
                              
                              {hasLocalAnomaly && (
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="2.5"
                                  className="fill-red-500/10 stroke-rose-500 stroke-[0.1] origin-center animate-radar-ring"
                                />
                              )}

                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isAnimatedPosition ? "1.0" : "0.65"}
                                fill={hasLocalAnomaly ? "#ef4444" : isAnimatedPosition ? "#2dd4bf" : "#0d9488"}
                                stroke={isAnimatedPosition ? "#ffffff" : "#0f172a"}
                                strokeWidth="0.15"
                                className="cursor-pointer transition-all hover:scale-150 hover:fill-teal-300"
                                onMouseEnter={() => setHoveredPoint({ ...p, index: idx })}
                                onMouseLeave={() => setHoveredPoint(null)}
                              />
                            </g>
                          );
                        })}
                      </g>

                      {/* 3. MACHINE LEARNING (XGBOOST/LIGHTGBM) EXPECTATION PATH PREDICTIONS (GOLD LINES) */}
                      {showPredictedPath && (
                        <g>
                          {svgLines.predSvg.map((p, idx) => {
                            // Only draw predictions up to active playback point to show look-ahead mechanism
                            if (idx > currentPlayIdx) return null;
                            const isNewest = idx === currentPlayIdx;

                            return (
                              <g key={`pred-${idx}`}>
                                {/* Line pointing from actual current position to modeled next coordinate */}
                                <line
                                  x1={svgLines.preproSvg[idx]?.x}
                                  y1={svgLines.preproSvg[idx]?.y}
                                  x2={p.pred.x}
                                  y2={p.pred.y}
                                  stroke="#eab308"
                                  strokeWidth="0.32"
                                  strokeDasharray="1.2,1.2"
                                  opacity="0.8"
                                />

                                {/* Predicted Target node */}
                                <g transform={`translate(${p.pred.x}, ${p.pred.y})`}>
                                  <line x1="-0.8" y1="0" x2="0.8" y2="0" stroke="#f59e0b" strokeWidth="0.15" />
                                  <line x1="0" y1="-0.8" x2="0" y2="0.8" stroke="#f59e0b" strokeWidth="0.15" />
                                  <circle cx="0" cy="0" r="0.42" fill="none" stroke="#f59e0b" strokeWidth="0.15" />
                                </g>

                                {/* If youngest lookahead prediction, display beautiful warning indicators if distance deviates */}
                                {isNewest && p.error_distance_m > 480 && (
                                  <g transform={`translate(${p.pred.x + 2.5}, ${p.pred.y - 1})`}>
                                    <rect x="-5" y="-1.5" width="34" height="2.5" rx="0.4" fill="rgba(15, 23, 42, 0.95)" stroke="#f59e0b" strokeWidth="0.1" />
                                    <text x="-4" y="0.2" className="text-[1.1px] fill-amber-300 font-semibold font-sans">
                                      ⚠️ 인공지능 경고: 정상 항로에서 {p.error_distance_m}m 이탈 발생!
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      )}

                      {/* ACTIVE SAILING VESSEL VECTOR ICON SYMBOLS ON MAP */}
                      {svgLines.preproSvg[currentPlayIdx] && (
                        <g transform={`translate(${svgLines.preproSvg[currentPlayIdx].x}, ${svgLines.preproSvg[currentPlayIdx].y}) rotate(${svgLines.preproSvg[currentPlayIdx].cog})`}>
                          <polygon
                            points="0,-2.5 1.4,1.8 0,0.8 -1.4,1.8"
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth="0.25"
                            className="shadow-2xl drop-shadow-md"
                          />
                        </g>
                      )}

                    </svg>

                    {/* LIVE VESSEL RADAR SYSTEM BAR HUD PANEL */}
                    <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-slate-400 select-none">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-teal-400 font-bold">
                          <span className="inline-flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                          LIVE MONITOR
                        </span>
                        <span>MMSI: <span className="text-white font-bold">{currentVesselData.mmsi}</span></span>
                        <span className="hidden md:inline text-slate-700">|</span>
                        <span className="hidden md:inline">현재 선박 속도: <span className="text-white font-bold">{svgLines.preproSvg[currentPlayIdx]?.sog || currentVesselData.points[0]?.sog} kts</span></span>
                        <span className="hidden md:inline text-slate-700">|</span>
                        <span className="hidden md:inline">현재 운항 방향(각도): <span className="text-white font-bold">{svgLines.preproSvg[currentPlayIdx]?.cog || currentVesselData.points[0]?.cog}°</span></span>
                        <span className="hidden md:inline text-slate-700">|</span>
                        <span className="hidden md:inline">감시 표준 시각: <span className="text-white font-bold">{svgLines.preproSvg[currentPlayIdx]?.timestamp || currentVesselData.points[0]?.timestamp}</span></span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-500">
                        {mapCursorLatLng ? (
                          <span className="text-teal-400/90">
                            좌표: Lat {mapCursorLatLng.lat.toFixed(4)}°N, Lon {mapCursorLatLng.lon.toFixed(4)}°E
                          </span>
                        ) : (
                          <span>커서를 지도에 올릴 시 위경도 표시</span>
                        )}
                      </div>
                    </div>

                    {/* TARGET POINT FLUID DETAIL SPEC CARD */}
                    {hoveredPoint && (
                      <div 
                        className="absolute bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3.5 shadow-2xl z-30 font-mono text-[11px] leading-relaxed select-none text-slate-200 pointer-events-none w-64 uppercase"
                        style={{
                          left: `${Math.min(70, hoveredPoint.x)}%`,
                          top: `${Math.min(70, hoveredPoint.y)}%`
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5 ">
                          <span className="font-bold text-white text-xs flex items-center gap-1">
                            <Ship className="w-3.5 h-3.5 text-teal-400" />
                            TELEMETRY [PT-{hoveredPoint.index + 1}]
                          </span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${hoveredPoint.isValid ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'}`}>
                            {hoveredPoint.isValid ? 'NORMAL' : 'OUTLIER'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">MMSI:</span>
                            <span className="text-slate-200 font-bold">{hoveredPoint.mmsi}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">TIMESTAMP:</span>
                            <span className="text-slate-200">{hoveredPoint.timestamp}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">LAT / LON:</span>
                            <span className="text-slate-100 font-semibold">{hoveredPoint.lat.toFixed(4)}, {hoveredPoint.lon.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">SPEED (SOG):</span>
                            <span className="text-teal-400 font-bold">{hoveredPoint.sog} kts</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">HEADING (COG):</span>
                            <span className="text-amber-400">{hoveredPoint.cog}°</span>
                          </div>

                          {/* Render Lag values if features tab hovered */}
                          {engineeredData[hoveredPoint.index] && (
                            <div className="border-t border-slate-800/80 pt-1.5 mt-1.5 space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">LAG_1 LAT/LON:</span>
                                <span className="text-slate-400">
                                  {engineeredData[hoveredPoint.index].lat_lag1?.toFixed(3) || "N/A"}, {engineeredData[hoveredPoint.index].lon_lag1?.toFixed(3) || "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">COG SHIFT DIFF:</span>
                                <span className={`${Math.abs(engineeredData[hoveredPoint.index].cog_diff || 0) > anomalyCofThreshold ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                                  {engineeredData[hoveredPoint.index].cog_diff}°
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">SOG SLIP ACCEL:</span>
                                <span className={`${Math.abs(engineeredData[hoveredPoint.index].sog_diff || 0) > 6 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                  {engineeredData[hoveredPoint.index].sog_diff} kts
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>

                </div>

                {/* 2. RIGHT SIDEBAR WORKSPACE: ANOMALY ALERT EVENT TELEMETRY LOGS */}
                <div className="flex flex-col select-none bg-slate-950 max-h-[460px] xl:max-h-none">
                  
                  {/* ALERTS SECTION HEAD */}
                  <div className="p-4 border-b border-slate-900 bg-slate-900/10 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold font-display uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                      🚨 실시간 해양 오염 위협 감시 알림
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      LIVE STREAM
                    </span>
                  </div>

                  {/* ANOMALY LIST SCROLLER */}
                  <div className="grow overflow-y-auto p-4 space-y-2 max-h-[180px] xl:max-h-none">
                    {anomaliesList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                        <CheckCircle className="w-10 h-10 text-teal-500/30 mb-2" />
                        <p className="text-xs font-semibold">탐출된 이상 운항 징후 없음</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          해당 선박 시나리오 내 모든 침로가 규정 속력과 각도 범위를 준수하고 있으며, 안전 항해 상태를 유지하고 있습니다.
                        </p>
                      </div>
                    ) : (
                      anomaliesList.map((a, idx) => {
                        let icon = <AlertTriangle className="w-4 h-4" />;
                        let colors = "border-amber-500/30 bg-amber-500/5 text-amber-200";
                        if (a.severity === 'high') {
                          colors = "border-red-500/30 bg-red-500/5 text-red-200";
                          icon = <Skull className="w-4 h-4" />;
                        } else if (a.type === 'NOISE_FILTERED') {
                          colors = "border-slate-800 bg-slate-900/30 text-slate-400";
                          icon = <Trash2 className="w-4 h-4 opacity-50" />;
                        }

                        return (
                          <div
                            key={`alert-${idx}`}
                            className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[11px] ${colors}`}
                          >
                            <div className="flex items-center justify-between border-b border-white/5 pb-1 font-mono">
                              <span className="font-bold flex items-center gap-1 text-xs">
                                {icon}
                                {a.type}
                              </span>
                              <span className="text-slate-500">
                                {a.timestamp.substring(11)}
                              </span>
                            </div>
                            <p className="text-slate-300 leading-relaxed font-sans">{a.message}</p>
                            <button
                              onClick={() => {
                                // Pinpoint target coords from alert
                                const { cleaned } = cleaningResult;
                                const matchIdx = cleaned.findIndex(p => p.timestamp === a.timestamp);
                                if (matchIdx !== -1) {
                                  setCurrentPlayIdx(matchIdx);
                                  setSystemLogs(l => [...l, `[관제] 위협 지정 관찰 이동 - Index ${matchIdx + 1}`]);
                                }
                              }}
                              className="self-end text-[10px] font-bold text-teal-400/90 hover:text-teal-300 flex items-center gap-0.5 mt-1"
                            >
                              레이더 추적 지정 <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* SYSTEM AUDIO & AUDIT CONSOLE LOG */}
                  <div className="border-t border-slate-900 bg-black/40 p-3 h-48 select-none flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase mb-1.5 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-indigo-400" />
                      시스템 실시간 추적 기록
                    </span>
                    <div className="grow overflow-y-auto font-mono text-[10px] text-teal-500/80 tracking-tight space-y-1 custom-scrollbar leading-relaxed">
                      {systemLogs.map((log, lidx) => (
                        <div key={`log-${lidx}`} className="truncate">
                          <span className="text-slate-600 mr-1.5">{new Date().toLocaleTimeString()}</span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 2: FEATURES LAG INTERACTIVE TABLE PROOFING */}
            {activeTab === 'features' && (
              <div className="p-6 flex flex-col min-h-0 grow overflow-y-auto select-none">
                
                {/* LABELS DESCRIPTION HEAD */}
                <div className="flex items-start justify-between gap-4 mb-4 border-b border-slate-900 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-teal-400" />
                      파생 시계열 윈도우 피처 설계판 (Feature Engineering Suite)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      MMSI 시계열 그룹 단위로 정렬된 데이터프레임 내부에서 직전 시점(t-1) 및 전전 시점(t-2) 물리적 위치 정보를 결합하여 
                      XGBoost 학습 피처를 자동 조립한 결과 테이블입니다.
                    </p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(JSON.stringify(engineeredData, null, 2), 'engineered-json')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    {copiedCodeIndex === 'engineered-json' ? '복사됨!' : 'EXPORT JSON'}
                  </button>
                </div>

                {/* COMPUTED DATA TABLE GRIDS */}
                <div className="grow overflow-auto border border-slate-900 rounded-xl bg-slate-950/40 custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead className="sticky top-0 bg-slate-900 text-slate-300 uppercase tracking-widest border-b border-slate-800 text-[10px] select-none">
                      <tr>
                        <th className="p-3">Index</th>
                        <th className="p-3">MMSI</th>
                        <th className="p-3 text-slate-400">Timestamp</th>
                        <th className="p-3 text-teal-400">Lat (t)</th>
                        <th className="p-3 text-teal-400">Lon (t)</th>
                        <th className="p-3 text-orange-400">SOG (t)</th>
                        <th className="p-3 text-orange-400">COG (t)</th>
                        <th className="p-3 text-slate-500">Lat (t-1)</th>
                        <th className="p-3 text-slate-500">Lon (t-1)</th>
                        <th className="p-3 text-rose-400">SOG Diff (5m)</th>
                        <th className="p-3 text-rose-400">COG Diff (5m)</th>
                        <th className="p-3 text-emerald-400">Travel Dist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      {engineeredData.map((row, index) => {
                        const isSogAbnormal = Math.abs(row.sog_diff || 0) > 6;
                        const isCogAbnormal = Math.abs(row.cog_diff || 0) > anomalyCofThreshold;

                        return (
                          <tr 
                            key={`feat-row-${index}`}
                            className={`hover:bg-slate-900/40 transition-colors ${index === currentPlayIdx ? 'bg-teal-500/10' : ''}`}
                          >
                            <td className="p-3 font-semibold text-slate-500 text-center">{index + 1}</td>
                            <td className="p-3 text-slate-400">{row.mmsi}</td>
                            <td className="p-3 text-slate-400/80">{row.timestamp}</td>
                            <td className="p-3 text-teal-400 font-semibold">{row.lat.toFixed(5)}</td>
                            <td className="p-3 text-teal-400 font-semibold">{row.lon.toFixed(5)}</td>
                            <td className="p-3 text-orange-300 font-bold">{row.sog} kts</td>
                            <td className="p-3 text-orange-300">{row.cog}°</td>
                            <td className="p-3 text-slate-500">{row.lat_lag1?.toFixed(5) || "-"}</td>
                            <td className="p-3 text-slate-500">{row.lon_lag1?.toFixed(5) || "-"}</td>
                            <td className={`p-3 font-bold ${isSogAbnormal ? 'text-red-400 bg-red-500/5' : 'text-slate-400'}`}>
                              {row.sog_diff !== null && row.sog_diff > 0 ? `+${row.sog_diff}` : row.sog_diff} kts
                            </td>
                            <td className={`p-3 font-bold ${isCogAbnormal ? 'text-amber-400 bg-amber-500/5' : 'text-slate-400'}`}>
                              {row.cog_diff !== null && row.cog_diff > 0 ? `+${row.cog_diff}` : row.cog_diff}°
                            </td>
                            <td className="p-3 text-emerald-400">{row.distance_from_lag ? `${row.distance_from_lag} km` : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>

        </main>

      </div>

      {/* FOOTER CO-ORD STATUS BAR */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 px-6 text-center select-none shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span className="font-mono">
          © 2026 대한민국 AIS 선박 운항 안보 레이더 플랫폼 - XGBoost 실시간 분석 연구단
        </span>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          <span className="font-mono text-[10px] text-slate-400">
            GPU ACCELERATION ACTIVE • EST. ERR MAX: 450m
          </span>
        </div>
      </footer>

    </div>
  );
}
