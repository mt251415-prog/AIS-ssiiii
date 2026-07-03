import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileCheck, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Terminal, 
  Settings, 
  LayoutDashboard, 
  Code, 
  Download, 
  Info, 
  Copy, 
  Check, 
  Database, 
  Compass, 
  Activity, 
  Sliders, 
  Eye, 
  HelpCircle,
  Clock,
  Shield,
  LifeBuoy
} from 'lucide-react';
import { AISPoint, ColumnMapping, DiagnosticResult, QualityIssue, PreparedFeature, PredictionResult } from './types';
import { parseCsv, autoDetectColumns, performDiagnostic, generatePythonCode, SAMPLE_A_TRACK, SAMPLE_B_STRUCT_ONLY, jsonToCsv } from './data';

export default function App() {
  // 상태 관리
  const [csvText, setCsvText] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    mmsi: null, timestamp: null, lat: null, lon: null, sog: null, cog: null, heading: null,
    vesselName: null, callSign: null, lengthTop: null, lengthBottom: null, lengthLeft: null, lengthRight: null
  });
  const [encoding, setEncoding] = useState<string>('AUTO');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  
  // 제어 파라미터 슬라이더
  const [maxSpeedKts, setMaxSpeedKts] = useState<number>(40);
  const [anomalyCofThreshold, setAnomalyCofThreshold] = useState<number>(45);
  
  // 진단 결과
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  
  // 모드 A전용 상태 (항로 예측 및 시뮬레이션용)
  const [selectedMmsi, setSelectedMmsi] = useState<string>('');
  const [simulationPoints, setSimulationPoints] = useState<AISPoint[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [currentPlayIdx, setCurrentPlayIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1000); // ms
  const [showRestrictedZone, setShowRestrictedZone] = useState<boolean>(true);
  const [showPredictedPath, setShowPredictedPath] = useState<boolean>(true);
  const [showGpsNoise, setShowGpsNoise] = useState<boolean>(true);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // 현재 탭 ("dashboard" | "code")
  const [activeTab, setActiveTab] = useState<'dashboard' | 'code'>('dashboard');
  
  // 콘솔 로그 수집
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // 실시간 타이머
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        setCurrentTimeStr(now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST');
      } catch (err) {
        try {
          setCurrentTimeStr(now.toLocaleString('ko-KR') + ' KST');
        } catch (err2) {
          setCurrentTimeStr(now.toString() + ' KST');
        }
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 로그 함수
  const logToConsole = (msg: string) => {
    let time = '';
    try {
      time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    } catch (err) {
      try {
        time = new Date().toLocaleTimeString();
      } catch (err2) {
        time = new Date().toISOString().substring(11, 19);
      }
    }
    setConsoleLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // 초기 실행 시 가본 데모 A 로드
  useEffect(() => {
    loadDemoA();
  }, []);

  // 타이머 기반 시뮬레이션 진행
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && simulationPoints.length > 0) {
      timer = setInterval(() => {
        setCurrentPlayIdx(prev => {
          if (prev >= simulationPoints.length - 1) {
            logToConsole("🎯 시뮬레이션 한 척의 항로 재현 루프를 모두 가동 완료했습니다.");
            return 0; // 루프 재생
          }
          return prev + 1;
        });
      }, playSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, simulationPoints, playSpeed]);

  // 가용 샘플 적재
  const loadDemoA = () => {
    logToConsole("⚡ [샘플 로드] 모드 A (항로 예측 가능 시뮬레이션용 데이터) 적용 중...");
    
    // 데이터 구조 가공
    const flatRows: Record<string, string>[] = [];
    SAMPLE_A_TRACK.forEach(v => {
      v.points.forEach(p => {
        flatRows.push({
          "선박번호": v.mmsi,
          "수신시각": p.timestamp,
          "위도": String(p.lat),
          "경도": String(p.lon),
          "속도": String(p.sog),
          "선수방위": String(p.cog),
          "선박명": v.name,
          "선박길이_상": "45",
          "선박길이_하": "45"
        });
      });
    });

    const headersList = ["선박번호", "수신시각", "위도", "경도", "속도", "선수방위", "선박명", "선박길이_상", "선박길이_하"];
    const rowsList = flatRows.map(obj => headersList.map(h => obj[h] || ''));

    setFileName("sample_coast_trajectory_predictive.csv");
    setHeaders(headersList);
    setParsedRows(rowsList);
    
    const mapping = autoDetectColumns(headersList);
    setColumnMapping(mapping);

    const diagnostics = performDiagnostic(headersList, rowsList, mapping, maxSpeedKts);
    setDiagnostic(diagnostics);

    // MMSI 목록 생성 및 첫 선박 콕 짚기
    const mmsis = Array.from(new Set(flatRows.map(r => r["선박번호"])));
    setSelectedMmsi(mmsis[0]);
    setCurrentPlayIdx(0);
    setIsPlaying(false);

    logToConsole(`✅ [지도 가동] 총 ${mmsis.length}척의 연속 궤적 인식 성공. 경로 분석 엔진 구동.`);
  };

  const loadDemoB = () => {
    logToConsole("⚠️ [샘플 로드] 모드 B (위측 좌표 누락 및 한국어 제원 다수 기형 이상 플래그 데이터) 적용 중...");
    
    const headersList = ["선박번호", "선박명", "선박식별번호(IMO)", "호출부호", "선박길이_상", "선박길이_하", "선박길이_좌", "선박길이_우", "수신시각", "속도", "선수방위", "헤딩"];
    const rowsList = SAMPLE_B_STRUCT_ONLY.map(obj => headersList.map(h => obj[h] || ''));

    setFileName("korea_vessel_profiles_no_coords.csv");
    setHeaders(headersList);
    setParsedRows(rowsList);

    const mapping = autoDetectColumns(headersList);
    setColumnMapping(mapping);

    const diagnostics = performDiagnostic(headersList, rowsList, mapping, maxSpeedKts);
    setDiagnostic(diagnostics);

    // 모드 B는 시뮬레이션용 데이터 없음
    setSimulationPoints([]);
    setPredictions([]);
    setSelectedMmsi('');
    logToConsole("🚫 [분석 알림] 위치(경위도) 정보 부재 확정. 모드 B 대시보드로 즉시 자동 시뮬레이션 전환 완료.");
  };

  // CSV 파싱 실행
  const processCsvFile = (text: string, name: string) => {
    try {
      const rows = parseCsv(text);
      if (rows.length < 2) {
        throw new Error("처리할 수 있는 데이터 열이 부족합니다. 최소 헤더 1행 및 데이터 1행이 필요합니다.");
      }
      
      const fileHeaders = rows[0];
      const dataRows = rows.slice(1);

      setFileName(name);
      setHeaders(fileHeaders);
      setParsedRows(dataRows);

      const mapping = autoDetectColumns(fileHeaders);
      setColumnMapping(mapping);

      const diagnostics = performDiagnostic(fileHeaders, dataRows, mapping, maxSpeedKts);
      setDiagnostic(diagnostics);

      // 모드 선택
      if (diagnostics.isPredictable) {
        const mmsiIdx = fileHeaders.indexOf(mapping.mmsi || '');
        const uniqueMmsis = Array.from(new Set(dataRows.map(r => r[mmsiIdx]).filter(Boolean)));
        if (uniqueMmsis.length > 0) {
          setSelectedMmsi(uniqueMmsis[0]);
        }
        logToConsole(`📂 [성공] 항로 예측 조건 충족! ${uniqueMmsis.length}척 선적 로드.`);
      } else {
        setSelectedMmsi('');
        setSimulationPoints([]);
        setPredictions([]);
        logToConsole("📂 [주의] 위치 컬럼 미식별 혹은 결손 발견. 모드 B 정적 상태 정밀 진단 검사를 진행합니다.");
      }

    } catch (e: any) {
      logToConsole(`❌ [파싱 실패]: ${e.message}`);
    }
  };

  // 인코딩 적용 로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    readAndDecode(file);
  };

  const readAndDecode = (file: File) => {
    const reader = new FileReader();
    
    // 자동 감지 시, EUC-KR에 한글 파괴 여부 검사 로직 적용
    if (encoding === 'AUTO') {
      reader.onload = (evt) => {
        const resultBuffer = (evt.target?.result as ArrayBuffer) || new ArrayBuffer(0);
        const arr = new Uint8Array(resultBuffer);
        // 간단한 한글 깨짐 분석을 통해 인코딩 매핑 분기
        let guessedEncoding = 'utf-8';
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === 0xBC && arr[i+1] === 0xAD) { // "선" 이라는 글자 CP949 바이트 매핑 확인용 등
            guessedEncoding = 'windows-949';
            break;
          }
          // 한글 뷰어로 공통 검사 코드 바이트가 있는지
          if (arr[i] >= 0x81 && arr[i] <= 0xFE && arr[i+1] >= 0x41 && arr[i+1] <= 0xFE) {
            if (!(arr[i] >= 0xC0 && arr[i] <= 0xDF && arr[i+1] >= 0x80 && arr[i+1] <= 0xBF)) {
              guessedEncoding = 'windows-949';
            }
          }
        }
        
        let textDecoder: TextDecoder;
        try {
          textDecoder = new TextDecoder(guessedEncoding);
        } catch (err) {
          try {
            textDecoder = new TextDecoder(guessedEncoding === 'windows-949' ? 'euc-kr' : 'utf-8');
          } catch (err2) {
            textDecoder = new TextDecoder('utf-8');
          }
        }
        const decodedText = textDecoder.decode(arr);
        logToConsole(`📂 [파일 로드] ${file.name} - 인코딩 자동 감지: ${guessedEncoding.toUpperCase()}`);
        processCsvFile(decodedText, file.name);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        logToConsole(`📂 [파일 로드] ${file.name} - 사용자 지정 인코딩: ${encoding}`);
        processCsvFile(text, file.name);
      };
      reader.readAsText(file, encoding);
    }
  };

  // 드롭 앤 드롭 지원
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readAndDecode(file);
    }
  };

  // 슬라이더 변경 시 동적 실시간 진단 재검침
  useEffect(() => {
    if (headers.length > 0 && parsedRows.length > 0) {
      const diagnostics = performDiagnostic(headers, parsedRows, columnMapping, maxSpeedKts);
      setDiagnostic(diagnostics);
    }
  }, [maxSpeedKts]);

  // 선택 MMSI 변경 혹은 컬럼 변경 시 모드 A 예측 시뮬레이션 계산
  useEffect(() => {
    if (!diagnostic || !diagnostic.isPredictable || !selectedMmsi) return;

    const mmsiIdx = headers.indexOf(columnMapping.mmsi || '');
    const timeIdx = headers.indexOf(columnMapping.timestamp || '');
    const latIdx = headers.indexOf(columnMapping.lat || '');
    const lonIdx = headers.indexOf(columnMapping.lon || '');
    const sogIdx = headers.indexOf(columnMapping.sog || '');
    const cogIdx = headers.indexOf(columnMapping.cog || '');

    // 1. 해당 선박 데이터 필터링
    const vRows = parsedRows.filter(row => row[mmsiIdx] === selectedMmsi);
    
    // 2. 시간순 정렬
    const points: AISPoint[] = vRows.map((row, rIdx) => {
      const latVal = parseFloat(row[latIdx]) || 0;
      const lonVal = parseFloat(row[lonIdx]) || 0;
      const sogVal = parseFloat(row[sogIdx]) || 0;
      const cogVal = parseFloat(row[cogIdx]) || 0;
      
      const originalRow: Record<string, string> = {};
      headers.forEach((h, idx) => { originalRow[h] = row[idx]; });

      return {
        mmsi: selectedMmsi,
        timestamp: row[timeIdx] || 'N/A',
        lat: latVal,
        lon: lonVal,
        sog: sogVal,
        cog: cogVal,
        originalRow
      };
    });

    const sortedPoints = points.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (!isNaN(tA) && !isNaN(tB)) {
        return tA - tB;
      }
      return (a.timestamp || '').localeCompare(b.timestamp || '');
    });

    setSimulationPoints(sortedPoints);

    // 3. 관제 시뮬레이션 연산 (2차 물리 관성 예측 보간 모델링)
    const computedPreds: PredictionResult[] = [];
    sortedPoints.forEach((p, idx) => {
      if (idx === 0) {
        computedPreds.push({
          timestamp: p.timestamp,
          actual_lat: p.lat,
          actual_lon: p.lon,
          pred_lat: p.lat,
          pred_lon: p.lon,
          error_distance_m: 0
        });
      } else if (idx === 1) {
        // 단일 직전 값 등속 가정
        const prev = sortedPoints[idx - 1];
        computedPreds.push({
          timestamp: p.timestamp,
          actual_lat: p.lat,
          actual_lon: p.lon,
          pred_lat: prev.lat,
          pred_lon: prev.lon,
          error_distance_m: Math.round(getDistanceMeter(p.lat, p.lon, prev.lat, prev.lon))
        });
      } else {
        // t-1, t-2 기반 2차 가속 자율예측
        const prev1 = sortedPoints[idx - 1];
        const prev2 = sortedPoints[idx - 2];
        const predLat = prev1.lat + (prev1.lat - prev2.lat);
        const predLon = prev1.lon + (prev1.lon - prev2.lon);
        const err = Math.round(getDistanceMeter(p.lat, p.lon, predLat, predLon));

        computedPreds.push({
          timestamp: p.timestamp,
          actual_lat: p.lat,
          actual_lon: p.lon,
          pred_lat: predLat,
          pred_lon: predLon,
          error_distance_m: err
        });
      }
    });

    setPredictions(computedPreds);
    setCurrentPlayIdx(0);

  }, [selectedMmsi, parsedRows, headers, columnMapping, maxSpeedKts]);

  // 경위도 기반 거리 연산 미터 환산 함수 (하버사인 식)
  function getDistanceMeter(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // 지구 반경
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 맵 드래그(팬) 지원
  const handleMapMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    setViewport({
      ...viewport,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMapMouseUp = () => {
    setDragStart(null);
  };

  const handleZoom = (factor: number) => {
    setViewport(v => ({ ...v, scale: Math.max(0.5, Math.min(8, v.scale * factor)) }));
  };

  const handleResetMap = () => {
    setViewport({ scale: 1, x: 0, y: 0 });
    logToConsole("🗺️ 지도 줌 레벨 및 중심 뷰포트를 초기화했습니다.");
  };

  // 파이썬 내보내기 복사 기능
  const copyPythonCode = (codeText: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(codeText);
        setCopiedCode(true);
        logToConsole("📋 [클립보드] 파이썬 고등 분석 7단계 템플릿 코드를 클립보드에 기록 복사했습니다.");
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        throw new Error("클립보드 API가 비활성화 상태이거나 해당 브라우저에서 차단되었습니다.");
      }
    } catch (err: any) {
      logToConsole(`⚠️ [클립보드 차단] 보안성(sandbox/API제한) 문제로 자동 복사가 차단되었습니다. 코드 본문을 직접 수동 복사하세요: ${err.message}`);
    }
  };

  // 보호구역 침범 및 급격한 항로 이탈 진단
  const activePred = predictions[currentPlayIdx];
  const activePoint = simulationPoints[currentPlayIdx];
  const isDeviationAlert = activePred?.error_distance_m > 480;

  // 산호초 보호 구역 진입 통계
  const reefCenter = { lat: 34.68, lon: 129.04 };
  const getIsNearReef = (lat: number, lon: number) => {
    return getDistanceMeter(lat, lon, reefCenter.lat, reefCenter.lon) < 6000; // 6km 이내 경보용 버퍼
  };

  const currentDistanceToReef = activePoint ? Math.round(getDistanceMeter(activePoint.lat, activePoint.lon, reefCenter.lat, reefCenter.lon)) : 0;
  const isInsideReefForbidden = !!activePoint && currentDistanceToReef < 3000; // 3km 이내 무단 침범 한계선

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col font-sans antialiased selection:bg-teal-500/30 selection:text-teal-900">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center border border-teal-200 shadow-inner">
            <Shield className="w-5 h-5 text-teal-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded leading-none">AIS WATCHDOG</span>
              <span className="text-[10px] font-mono text-slate-400">{currentTimeStr}</span>
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight font-display">
              AIS CSV 진단 및 선박 이상값 감시 시뮬레이터
            </h1>
          </div>
        </div>

        {/* TOP CONTROLS */}
        <div className="flex flex-wrap items-center gap-3 mt-3 md:mt-0">
          <div className="px-3 py-1.5 rounded text-xs font-semibold tracking-wide flex items-center gap-1.5 bg-teal-600 text-white font-bold shadow">
            <LayoutDashboard className="w-3.5 h-3.5" />
            관제 및 품질 분석 판넬
          </div>
        </div>
      </header>

      {/* CORE WRAPPER */}
      <main className="grow flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COMPONENT: CONTROL RAIL */}
        <div className="w-full lg:w-[380px] bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0 divide-y divide-slate-100 custom-scrollbar">
          
          {/* SEC 1: CSV FILE INFUSION */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-teal-600 text-white w-5 h-5 rounded flex items-center justify-center">1</span>
                <span className="text-xs font-bold text-slate-800">선박 AIS CSV 주입</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">ENCODING SUPPORT</span>
            </div>

            {/* DRAG ZONE */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-teal-400 hover:bg-slate-50'}`}
              onClick={() => document.getElementById('vessel-file-upload')?.click()}
            >
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-700">내 로컬 AIS CSV 파일 업로드</p>
              <p className="text-[10px] text-slate-400 mt-1">드래그 앤 드롭 또는 클릭하여 찾아보기</p>
              <input 
                id="vessel-file-upload" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>

            {/* ENCODING SETTER & FILE STAT */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">인코딩 처리 형식</label>
                <select 
                  value={encoding} 
                  onChange={(e) => {
                    setEncoding(e.target.value);
                    logToConsole(`⚙️ 기본 인코딩 설정을 [${e.target.value}] 로 전환했습니다. 다음 업로드 시 강제 적용됩니다.`);
                  }}
                  className="w-full text-xs font-mono bg-slate-50 text-slate-800 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 focus:outline-none"
                >
                  <option value="AUTO">자동 판독 (추천)</option>
                  <option value="windows-949">CP949 (한국공공제원)</option>
                  <option value="utf-8">UTF-8 (공통 규격)</option>
                  <option value="euc-kr">EUC-KR (한글 표준)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">임계 속도 필터 범위</label>
                <select 
                  value={maxSpeedKts} 
                  onChange={(e) => setMaxSpeedKts(Number(e.target.value))}
                  className="w-full text-xs font-mono bg-slate-50 text-slate-700 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 focus:outline-none"
                >
                  <option value="15">Max 15 kts</option>
                  <option value="30">Max 30 kts</option>
                  <option value="40">Max 40 kts (기본)</option>
                  <option value="60">Max 60 kts</option>
                </select>
              </div>
            </div>

            {fileName && (
              <div className="bg-slate-100 rounded px-3 py-2 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="text-[10px] font-mono text-slate-700 truncate" title={fileName}>
                    {fileName}
                  </span>
                </div>
                <span className="text-[9px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                  {parsedRows.length + 1} Rows
                </span>
              </div>
            )}

            {/* PRE-CONSTRUCTED DEMO TRIGGER */}
            <div className="space-y-1.5 pt-1">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">웹 프리패키지 테스트 샘플 적재</span>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={loadDemoA} 
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded text-xs flex flex-col justify-between transition-colors group"
                >
                  <span className="font-semibold text-teal-600 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-teal-600" />
                    샘플 A 로드 (항로 예측 모드)
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5 group-hover:text-slate-700 transition-colors">
                    연속 위경도 좌표 포함 및 지오펜스 무단 선회 감시
                  </span>
                </button>
                <button 
                  onClick={loadDemoB} 
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded text-xs flex flex-col justify-between transition-colors group"
                >
                  <span className="font-semibold text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    샘플 B 로드 (제원 이상치 감시 모드)
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5 group-hover:text-slate-700 transition-colors">
                    위경도가 유실된 한국어 컬럼 제원 전용 이상값 감시
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* SEC 2: DIAGNOSTIC RECAP METRICS */}
          {diagnostic && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold bg-teal-600 text-white w-5 h-5 rounded flex items-center justify-center">2</span>
                <span className="text-xs font-bold text-slate-800">CSV 품질 구조 진단 파악</span>
              </div>

              {/* INTEGRITY SCORE CARD WITH DONUT */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 flex items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">종합 데이터 신뢰 점수</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono tracking-tight text-slate-800">{diagnostic.qualityScore}</span>
                    <span className="text-xs text-slate-400">/ 100 점</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">
                    {diagnostic.qualityScore >= 85 ? '🟢 정교한 예측 연산이 가능한 청정 세정 등급입니다.' :
                     diagnostic.qualityScore >= 60 ? '🟡 누락치와 무수신 에러 가공이 다수 필요합니다.' :
                     '🔴 위경도가 누락되었거나 비정상 극값이 심각하게 많습니다.'}
                  </p>
                </div>

                {/* SVG DONUT CHART */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={
                        diagnostic.qualityScore >= 85 ? 'text-teal-600' :
                        diagnostic.qualityScore >= 60 ? 'text-amber-500' :
                        'text-rose-500'
                      }
                      strokeWidth="3.5"
                      strokeDasharray={`${diagnostic.qualityScore}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-slate-700">
                    {diagnostic.qualityScore}%
                  </div>
                </div>
              </div>

              {/* AUTOMATIC MODE ROUTER PANEL */}
              <div className={`p-3 rounded border text-xs leading-relaxed ${
                diagnostic.isPredictable 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-850' 
                  : 'bg-amber-50 border-amber-200 text-amber-850'
              }`}>
                <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                  {diagnostic.isPredictable ? (
                    <>
                      <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                      [모드 A] 항로 예측 가능 모드 구동
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      [모드 B] 예측제약 데이터 품질 모드 분기
                    </>
                  )}
                </div>
                {diagnostic.isPredictable ? (
                  "데이터상 필수 선박고유키와 위경도 물리 좌표가 모두 식별되었습니다. 관치 궤적 및 2차 관성 보간 자율예측 경보 시스템이 완벽하게 가동됩니다."
                ) : (
                  "위치 경위도 컬럼이 누락되었거나 일관된 데이터 셋이 유실되어 항로 예측 불가로 판정되었습니다. 대신 한국 AIS 무수신에 대표적으로 기록된 한글 이상치 모니터 감시를 구동합니다."
                )}
              </div>

              {/* RECOGNIZED CHANNELS */}
              <div className="space-y-1.5">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">자동 맵핑 성공한 수집 칼럼 ({diagnostic.mappedColumns.length}개)</span>
                <div className="flex flex-wrap gap-1">
                  {diagnostic.mappedColumns.map(col => (
                    <span key={col.key} className="text-[9px] font-mono bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded leading-none">
                      {col.key} → {col.header}
                    </span>
                  ))}
                  {diagnostic.missingRequiredColumns.map(col => (
                    <span key={col} className="text-[9px] font-mono bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded leading-none flex items-center gap-0.5">
                      ❌ {col} 누락
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COMPONENT: MAIN VIEW STRETCH */}
        <div className="grow bg-slate-50 flex flex-col overflow-y-auto relative custom-scrollbar">
          
          {true && (
            <>
              {!diagnostic ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 h-[600px] text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600 mb-3 mx-auto"></div>
                  <p className="text-xs text-slate-500">선박 항로 레이더 전처리 데이터를 분석 중입니다...</p>
                </div>
              ) : diagnostic.isPredictable ? (
                // ==========================================
                // [MODE A] PREDICTABLE TRACK FORECASTER
                // ==========================================
                <div className="p-6 space-y-6">
                  
                  {/* METRIC RIBBON */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold leading-none block">총 식별 실선 선박량</span>
                      <span className="text-2xl font-bold text-slate-800 mt-1.5 block font-mono">{diagnostic.totalVessels} 척</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold leading-none block">시계열 연속 행 수</span>
                      <span className="text-2xl font-bold text-teal-600 mt-1.5 block font-mono">{diagnostic.totalRecords} 행</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold leading-none block">급선회 판단 기준</span>
                      <span className="text-2xl font-bold text-amber-600 mt-1.5 block font-mono">±{anomalyCofThreshold}° / 5m</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold leading-none block">산호초 구역 안전 한계</span>
                      <span className="text-2xl font-bold text-rose-600 mt-1.5 block font-mono">기본 3.0 km</span>
                    </div>
                  </div>

                  {/* VESSEL SELECTION DROP-ACCORDION */}
                  <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display mb-1">실시간 교신 추적 선박 선택</h3>
                        <p className="text-[11px] text-slate-500">데이터셋 내 연속 궤적이 온전히 식별된 다음 선박 중 모의 시뮬레이션을 가동할 대상 지정</p>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <select 
                          value={selectedMmsi} 
                          onChange={(e) => {
                            setSelectedMmsi(e.target.value);
                            logToConsole(`선택 선박을 [MMSI: ${e.target.value}] 대상으로 교환하여 관제 지오펜스를 정비합니다.`);
                          }}
                          className="text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded px-3 py-2 focus:border-teal-500 font-mono focus:outline-none min-w-[200px]"
                        >
                          {Array.from(new Set(parsedRows.map((_, rIdx) => {
                            const isMmapped = headers.indexOf(columnMapping.mmsi || '');
                            return isMmapped !== -1 ? parsedRows[rIdx][isMmapped] : null;
                          }).filter(Boolean))).map(m => (
                            <option key={m} value={m}>MMSI: {m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* RADAR MAP STAGE GRID & SIM PLAYBACK */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* RADAR MAP VIEWPORT */}
                    <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[520px] shadow-sm">
                      
                      {/* VIEWPORT CONTROLLER BAR */}
                      <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center border-b border-slate-200 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-teal-400" />
                          해양 지오펜스 관제 실황 지도
                        </span>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1 cursor-pointer select-none text-[11px]">
                            <input 
                              type="checkbox" 
                              checked={showRestrictedZone} 
                              onChange={() => setShowRestrictedZone(!showRestrictedZone)}
                              className="rounded border-slate-300 bg-slate-50 text-teal-600 w-3.5 h-3.5"
                            />
                            산호초 보호구역 표시
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer select-none text-[11px]">
                            <input 
                              type="checkbox" 
                              checked={showPredictedPath} 
                              onChange={() => setShowPredictedPath(!showPredictedPath)}
                              className="rounded border-slate-300 bg-slate-50 text-teal-600 w-3.5 h-3.5"
                            />
                            예측 항로 표시
                          </label>
                          <div className="h-4 w-px bg-slate-200" />
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleZoom(1.2)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded flex items-center justify-center text-xs shadow-sm">+</button>
                            <button onClick={() => handleZoom(0.8)} className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded flex items-center justify-center text-sm shadow-sm">-</button>
                            <button onClick={handleResetMap} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded ml-1 shadow-sm">리셋</button>
                          </div>
                        </div>
                      </div>

                      {/* CANVAS FIELD */}
                      <div 
                        ref={mapRef}
                        className="grow relative overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing select-none"
                        onMouseDown={handleMapMouseDown}
                        onMouseMove={handleMapMouseMove}
                        onMouseUp={handleMapMouseUp}
                        onMouseLeave={handleMapMouseUp}
                      >
                        {/* ABSOLUTE RADAR NOISE BG EFFECTS */}
                        <div className="absolute inset-0 bg-radial-grid opacity-5" />
                        
                        {/* MINI LEGEND */}
                        <div className="absolute bottom-4 left-4 bg-white/95 border border-slate-200 shadow rounded p-2.5 space-y-1.5 z-10 text-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-0.5 bg-emerald-500 block" />
                            <span className="text-slate-700">실시간 실제 수신 경로</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-0.5 bg-dashed-amber block" style={{ borderBottom: '1px dashed #d97706' }} />
                            <span className="text-slate-700">물리 관성 안전 예측 경로</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-rose-500/10 border border-rose-500/40 block" />
                            <span className="text-slate-700">산호초 생태 환경 보호 구역</span>
                          </div>
                        </div>

                        {/* MAP DRAW STAGE BY SVG */}
                        {simulationPoints.length > 0 ? (() => {
                          // 자동 스케일링 경위도 맵핑 바운스 생성
                          const lats = simulationPoints.map(p => p.lat);
                          const lons = simulationPoints.map(p => p.lon);
                          
                          // 외연 버퍼 계산
                          const latMin = Math.min(...lats, reefCenter.lat) - 0.04;
                          const latMax = Math.max(...lats, reefCenter.lat) + 0.04;
                          const lonMin = Math.min(...lons, reefCenter.lon) - 0.04;
                          const lonMax = Math.max(...lons, reefCenter.lon) + 0.04;

                          const latRange = latMax - latMin;
                          const lonRange = lonMax - lonMin;

                          // 500x400 표준 내부 플롯 뷰로 맵 좌표 치환
                          const mapX = (lon: number) => {
                            return 50 + ((lon - lonMin) / lonRange) * 500;
                          };
                          const mapY = (lat: number) => {
                            // 위도는 위가 서쪽 위로 가므로 y는 대향 반전 처리
                            return 350 - ((lat - latMin) / latRange) * 300;
                          };

                          return (
                            <svg 
                              className="w-full h-full"
                              viewBox="0 0 600 400"
                              style={{
                                transform: `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.1s ease-out'
                              }}
                            >
                              {/* 1. GEOFENCE ZONE */}
                              {showRestrictedZone && (
                                <>
                                  <circle 
                                    cx={mapX(reefCenter.lon)} 
                                    cy={mapY(reefCenter.lat)} 
                                    r={40} // 원 반지름
                                    fill="rgba(244, 63, 94, 0.07)"
                                    stroke="#f43f5e"
                                    strokeWidth="1"
                                    strokeDasharray="3,3"
                                  />
                                  <text 
                                    x={mapX(reefCenter.lon) - 45} 
                                    y={mapY(reefCenter.lat) - 45} 
                                    fill="#f43f5e" 
                                    className="text-[9px] font-bold fill-rose-400"
                                  >
                                    산호초 보호구역 (Geofence)
                                  </text>
                                </>
                              )}

                              {/* 2. ACTUAL HISTORIC PATH (LINE) */}
                              <polyline
                                points={simulationPoints.map(p => `${mapX(p.lon)},${mapY(p.lat)}`).join(' ')}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                              />

                              {/* 3. PREDICTED PATH (LINE) */}
                              {showPredictedPath && predictions.length > 1 && (
                                <polyline
                                  points={predictions.filter(p => p.pred_lat && p.pred_lon).map(p => `${mapX(p.pred_lon)},${mapY(p.pred_lat)}`).join(' ')}
                                  fill="none"
                                  stroke="#f59e0b"
                                  strokeWidth="1.5"
                                  strokeDasharray="4,4"
                                />
                              )}

                              {/* 4. ACTUAL HISTORIC DOTS */}
                              {simulationPoints.map((p, pIdx) => {
                                const isCurrent = pIdx === currentPlayIdx;
                                return (
                                  <circle
                                    key={`act-${pIdx}`}
                                    cx={mapX(p.lon)}
                                    cy={mapY(p.lat)}
                                    r={isCurrent ? 6 : 4}
                                    className={isCurrent ? "fill-teal-400 stroke-white stroke-2 animate-pulse" : "fill-emerald-500"}
                                  />
                                );
                              })}

                              {/* 5. CURRENT SIMULATION POINTER AND ACCENT COGNITIVE */}
                              {activePoint && (
                                <g>
                                  {/* 가속 방향 침로 COG 지시선 */}
                                  <line
                                    x1={mapX(activePoint.lon)}
                                    y1={mapY(activePoint.lat)}
                                    x2={mapX(activePoint.lon) + Math.sin(activePoint.cog * Math.PI / 180) * 20}
                                    y2={mapY(activePoint.lat) - Math.cos(activePoint.cog * Math.PI / 180) * 20}
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    markerEnd="url(#arrow)"
                                  />
                                </g>
                              )}

                              {/* 6. WARNING SIGN ON VIOLATION */}
                              {activePoint && isInsideReefForbidden && (
                                <g transform={`translate(${mapX(activePoint.lon) - 10}, ${mapY(activePoint.lat) - 25})`}>
                                  <rect x="0" y="0" width="85" height="14" rx="2" fill="#be123c" className="animate-bounce" />
                                  <text x="5" y="10" fill="#ffffff" className="text-[7.5px] font-bold">⚠️ 보호지 한계 침입!</text>
                                </g>
                              )}

                              {/* I탈 경고 지시창 */}
                              {activePred && activePred.error_distance_m > 480 && (
                                <g transform={`translate(${mapX(activePred.actual_lon) + 8}, ${mapY(activePred.actual_lat) - 8})`}>
                                  <rect x="0" y="0" width="130" height="15" rx="2" fill="#ea580c" />
                                  <text x="4" y="11" fill="#ffffff" className="text-[7.5px] font-bold font-sans">
                                    ⚠️ 정상 범위를 {activePred.error_distance_m}m 이탈!
                                  </text>
                                </g>
                              )}

                            </svg>
                          );
                        })() : (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                            분석한 선박 AIS 점이 존재하지 않습니다.
                          </div>
                        )}
                      </div>

                      {/* REPLAY INSTRUMENT CONSOLE BAR */}
                      <div className="bg-white border-t border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 shrink-0">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md"
                          >
                            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                          </button>
                          
                          <button 
                            onClick={() => {
                              setCurrentPlayIdx(0);
                              setIsPlaying(false);
                              logToConsole("🔄 시뮬레이션 경로 타임슬라이더를 시작지점으로 되감았습니다.");
                            }}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded shadow-sm"
                            title="되감기"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          <div className="h-6 w-px bg-slate-200" />

                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block leading-none">실시간 항해 시뮬레이션 재생</span>
                            <span className="text-xs font-mono font-bold text-slate-800 mt-1.5 block">
                              {(currentPlayIdx + 1).toString().padStart(2, '0')} / {simulationPoints.length.toString().padStart(2, '0')} 노드 정렬 진행 중
                            </span>
                          </div>
                        </div>

                        {/* PLAY SPEED SLIDER */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <span className="text-[10px] text-slate-500 font-bold shrink-0">배속 변경</span>
                          <input 
                            type="range"
                            min="300"
                            max="2500"
                            step="200"
                            value={playSpeed}
                            onChange={(e) => setPlaySpeed(Number(e.target.value))}
                            className="bg-slate-200 h-1 rounded w-32 cursor-pointer accent-teal-600"
                          />
                          <span className="text-xs font-mono text-teal-600 font-semibold shrink-0">{(3000 - playSpeed)/1000}x</span>
                        </div>
                      </div>

                    </div>

                    {/* DYNAMIC ALERT BOX & CONTROLLER FOR MODE A */}
                    <div className="bg-white border border-slate-200 p-5 rounded-lg flex flex-col justify-between h-[520px] shadow-sm">
                      
                      <div className="space-y-4 overflow-y-auto shrink-0 grow select-none h-[420px] custom-scrollbar">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block border-b border-slate-100 pb-2">동적 선박 현황 텔레메트리</span>
                        
                        {activePoint ? (
                          <div className="space-y-4">
                            
                            {/* SHIP META NAME BLOCK */}
                            <div>
                              <span className="text-[10px] text-slate-400 block">선박 식별 번호 (MMSI)</span>
                              <span className="text-sm font-bold font-mono text-slate-800 flex items-center gap-1.5 mt-0.5">
                                <Database className="w-4 h-4 text-slate-400" />
                                {activePoint.mmsi}
                              </span>
                            </div>

                            {/* VESSEL NAME */}
                            <div>
                              <span className="text-[10px] text-slate-400 block">감시 선박명</span>
                              <span className="text-sm font-bold text-teal-600 mt-0.5 block">
                                {activePoint.vesselName || activePoint.originalRow["선박명"] || "미확인 국적선 (한글명 없음)"}
                              </span>
                            </div>

                            {/* COGNITIVE COORDINATE STAT */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[9px] text-slate-400 block">현재 수신 위도</span>
                                <span className="text-xs font-bold font-mono text-slate-700 mt-1 block">{activePoint.lat.toFixed(5)}° N</span>
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[9px] text-slate-400 block">현재 수신 경도</span>
                                <span className="text-xs font-bold font-mono text-slate-700 mt-1 block">{activePoint.lon.toFixed(5)}° E</span>
                              </div>
                            </div>

                            {/* SOG COG SPEED HEADINGS */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
                                <span className="text-[9px] text-slate-400 block">수신 속도</span>
                                <span className="text-xs font-bold font-mono text-teal-600 mt-1 block">{activePoint.sog} kts</span>
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
                                <span className="text-[9px] text-slate-400 block">수신 방향</span>
                                <span className="text-xs font-bold font-mono text-amber-600 mt-1 block">{activePoint.cog}°</span>
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center hover:bg-slate-100 transition-colors">
                                <span className="text-[9px] text-slate-400 block">안전 이격 오차</span>
                                <span className={`text-xs font-bold font-mono mt-1 block ${isDeviationAlert ? 'text-rose-600' : 'text-slate-700'}`}>
                                  {activePred ? activePred.error_distance_m : 0} m
                                </span>
                              </div>
                            </div>

                            {/* TIMELINE SLOTS STACK */}
                            <div>
                              <span className="text-[10px] text-slate-400 block">AIS 최종 무선 수신표준시각</span>
                              <span className="text-xs font-mono text-slate-700 mt-0.5 block flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {activePoint.timestamp}
                              </span>
                            </div>

                            {/* INTUITIVE ALERTS PANEL */}
                            {isInsideReefForbidden || isDeviationAlert ? (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
                                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                                  해양 보호 구역 비상 위협 탐보
                                </span>
                                <div className="space-y-1 text-[11px] text-slate-600 leading-snug">
                                  {isInsideReefForbidden && (
                                    <p className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                                      산호초 특별 환경 보존지구 내부선 {currentDistanceToReef}m 영역 내 침투 중!
                                    </p>
                                  )}
                                  {isDeviationAlert && (
                                    <p className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                                      물리 보간 예측 항로 오차 유의 이탈 수치({activePred.error_distance_m}m) 초과. 급격한 선회 및 특이 기동 감지!
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-[11px] text-emerald-700 flex items-center gap-1.5 leading-snug">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                통제 센터 안전 진단: 해당 지점에서는 정상 범위 등속 운항을 보존 중입니다 (특이사항 없음).
                              </div>
                            )}

                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">시뮬레이션 재생 목록이 활성화되면 세부 정보가 실시간 표출됩니다.</p>
                        )}
                      </div>

                      {/* PARAMETERS ADJUST RAIL */}
                      <div className="border-t border-slate-100 pt-3 space-y-3 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-teal-600" />
                          환경 감시 안전 알고리즘 실시간 감도 설정
                        </span>
                        
                        <div className="space-y-2.5">
                          <div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                              <span>급선회 판단 임계각</span>
                              <span className="text-teal-600 font-bold font-mono">±{anomalyCofThreshold}°</span>
                            </div>
                            <input 
                              type="range"
                              min="15"
                              max="90"
                              step="5"
                              value={anomalyCofThreshold}
                              onChange={(e) => {
                                setAnomalyCofThreshold(Number(e.target.value));
                                logToConsole(`⚙️ [파라미터 변경] 급선회 COG 변동 감도를 ${e.target.value}° 로 재조정했습니다.`);
                              }}
                              className="w-full bg-slate-200 h-1.5 rounded appearance-none cursor-pointer accent-teal-600"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                              <span>동등 물리 2차 예측과 한계 오차치</span>
                              <span className="text-amber-600 font-bold font-mono">480 m</span>
                            </div>
                            <div className="text-[9px] text-slate-400 leading-normal">
                              2차 보간 궤적이 실제 도취값과 480미터 이상 유전 격각 오차가 날 경우 경보를 자동 활성화합니다.
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                // ==========================================
                // [MODE B] UNPREDICTABLE DATA PROFILE MONITOR
                // ==========================================
                <div className="p-6 space-y-6">
                  
                  {/* WARNING OUTLINE OF FAILING COORDINATE */}
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <h2 className="text-sm font-bold text-amber-750 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce text-amber-600" />
                        ⚠️ 지리적 항로 이동 예측 불가 (위도/경도 유실 및 미지정)
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                        한국 공공데이터 형식의 특성상 위도(Latitude) 및 경도(Longitude) 칼럼이 유실되어 있거나, 좌표 수신 미완료 데이터이기 때문에
                        지리적 항로 2차 융합 보간이나 경로 시뮬레이션을 가동할 수 없습니다. 대신 다음의 AIS 이상값 탐지 및 제원 품질 감시를 가동합니다.
                      </p>
                    </div>

                    <button 
                      onClick={loadDemoA}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold shrink-0 transition-all flex items-center gap-1 shadow-sm"
                    >
                      지도 구동형 데모 A 로드하기
                    </button>
                  </div>

                  {/* HIGH RESOLUTIVE DIAGNOSTIC BLOCKS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* LOST ESSENTIAL CHANNELS */}
                    <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-3 flex flex-col justify-between shadow-sm">
                      <div className="space-y-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">항로 예측 보장 필수 컬럼</span>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${columnMapping.mmsi ? 'bg-teal-500' : 'bg-rose-500'}`} />
                              식별 고유키 (MMSI / 선박번호)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{columnMapping.mmsi ? '감지' : '미감지'}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${columnMapping.timestamp ? 'bg-teal-500' : 'bg-rose-500'}`} />
                              표준 수신시각 (Timestamp / 수신시각)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{columnMapping.timestamp ? '감지' : '미감지'}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${columnMapping.lat ? 'bg-teal-500' : 'bg-rose-500'}`} />
                              위도 좌표 (Latitude / 위도)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{columnMapping.lat ? '감지' : '미감지'}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${columnMapping.lon ? 'bg-teal-500' : 'bg-rose-500'}`} />
                              경도 좌표 (Longitude / 경도)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{columnMapping.lon ? '감지' : '미감지'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-rose-50 border border-rose-200 rounded mt-3 text-[11px] leading-relaxed text-rose-700">
                        📌 지리 예측 관제를 실행하기 위해서는 가상 또는 수집용 위경도 및 시간 행이 연속성을 확보하여 추가 탑재되어야 합니다.
                      </div>
                    </div>

                    {/* QUALITY DIAGNOSTIC SUMMARY PANEL */}
                    <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">제원 누락 및 수신 불량 지표</span>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-slate-500">총 고유 선박 수</span>
                          <span className="font-mono font-bold text-slate-800">{diagnostic.totalVessels} 척</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-slate-500">선박명 누락</span>
                          <span className={`font-mono font-bold ${diagnostic.missingVesselNameCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{diagnostic.missingVesselNameCount} 건</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-slate-500">호출부호 결손</span>
                          <span className={`font-mono font-bold ${diagnostic.missingCallSignCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{diagnostic.missingCallSignCount} 건</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-slate-500">IMO 선박고유코드 오류(0)</span>
                          <span className={`font-mono font-bold ${diagnostic.missingImoCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{diagnostic.missingImoCount} 건</span>
                        </div>
                      </div>
                    </div>

                    {/* AIS EXTREMAL FIELD REPORT */}
                    <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4 shadow-sm">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">AIS 무수신/기형 이상량 감시</span>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">기형 속도 이상 검검 (SOG: 1023 / 음수 등)</span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            {diagnostic.sogAnomalyCount} 건 감지
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">선수방위 초과 이상 (COG: 3600 / 극대 등)</span>
                          <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            {diagnostic.cogAnomalyCount} 건 감지
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">전방 헤딩 각도 분실 (Heading: 511 등)</span>
                          <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            {diagnostic.headingAnomalyCount} 건 감지
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">선박 길이(상하좌우) 비대칭 오류</span>
                          <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                            {diagnostic.sizeAnomalyCount} 건 식별됨
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* ERROR LOG DETAIL GRID TABLE */}
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 uppercase font-display flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-amber-600" />
                        감시 탐지된 품질 에러 / 이상값 정밀 판독 테이블 (최대 20개 행)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">COUNT: {diagnostic.issues.length} Issues</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold font-mono tracking-wider">
                            <th className="p-3.5 pl-5">대상행</th>
                            <th className="p-3.5">선박식별 mmsi/번호</th>
                            <th className="p-3.5">수신 시간대</th>
                            <th className="p-3.5">문제가 된 컬럼</th>
                            <th className="p-3.5">입력된 실제 값</th>
                            <th className="p-3.5">이상 유형 분류</th>
                            <th className="p-3.5 pr-5">상세 진단 해설 및 처방</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                          {diagnostic.issues.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                                🎉 검수 조건상 어떤 식별 이상이나 품질 이격도 발견되지 않았습니다. 완벽히 보관된 양질의 데이터셋입니다.
                              </td>
                            </tr>
                          ) : (
                            diagnostic.issues.slice(0, 20).map((issue, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 pl-5 font-mono text-slate-500">{issue.rowIdx}</td>
                                <td className="p-3 font-mono font-bold text-slate-800">{issue.mmsi}</td>
                                <td className="p-3 font-mono text-slate-400">{issue.timestamp}</td>
                                <td className="p-3 text-amber-700 font-semibold">{issue.column}</td>
                                <td className="p-3 font-mono text-rose-700 font-bold bg-rose-50 border border-rose-100 rounded px-2.5 py-0.5 inline-block my-1.5">{issue.value || 'NULL'}</td>
                                <td className="p-3 font-mono">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    issue.severity === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                    issue.severity === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}>
                                    {issue.issueType}
                                  </span>
                                </td>
                                <td className="p-3 pr-5 text-slate-600 max-w-sm shrink-0 leading-relaxed">{issue.message}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

      </main>

    </div>
  );
}
