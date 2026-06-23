import { VesselPreset, AISPoint } from './types';

// Let's establish Busan - Tsushima Strait sea lane coordinate bounds roughly
// Latitude: 34.5 to 35.2
// Longitude: 128.8 to 129.8

export const VESSEL_PRESETS: VesselPreset[] = [
  {
    mmsi: "440123456",
    name: "일반 화물선 (정상 운항 중)",
    type: "Commercial Cargo Carrier",
    description: "정상 해역을 안정적인 속도(14~16kts)와 일정한 침로로 안전하게 운항 중인 컨테이너선입니다.",
    points: [
      { mmsi: "440123456", timestamp: "2026-06-16 12:00:00", lat: 34.524, lon: 128.845, sog: 15.2, cog: 41.5 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:05:00", lat: 34.542, lon: 128.868, sog: 15.1, cog: 42.0 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:10:00", lat: 34.561, lon: 128.891, sog: 15.3, cog: 42.1 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:15:00", lat: 34.579, lon: 128.914, sog: 15.4, cog: 41.8 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:20:00", lat: 34.598, lon: 128.937, sog: 15.2, cog: 42.3 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:25:00", lat: 34.616, lon: 128.960, sog: 15.3, cog: 42.5 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:30:00", lat: 34.635, lon: 128.983, sog: 15.5, cog: 42.2 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:35:00", lat: 34.653, lon: 129.006, sog: 15.4, cog: 42.0 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:40:00", lat: 34.671, lon: 129.029, sog: 15.2, cog: 41.9 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:45:00", lat: 34.690, lon: 129.052, sog: 15.1, cog: 42.4 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:50:00", lat: 34.708, lon: 129.075, sog: 15.3, cog: 42.8 },
      { mmsi: "440123456", timestamp: "2026-06-16 12:55:00", lat: 34.726, lon: 129.098, sog: 15.2, cog: 43.0 },
      { mmsi: "440123456", timestamp: "2026-06-16 13:00:00", lat: 34.745, lon: 129.121, sog: 15.3, cog: 42.7 },
      { mmsi: "440123456", timestamp: "2026-06-16 13:05:00", lat: 34.763, lon: 129.144, sog: 15.5, cog: 42.5 },
      { mmsi: "440123456", timestamp: "2026-06-16 13:10:00", lat: 34.781, lon: 129.167, sog: 15.4, cog: 42.1 }
    ]
  },
  {
    mmsi: "440234567",
    name: "의심 선박 A (급선회/오염물질 투기 의심)",
    type: "Chemical Tanker",
    description: "선박의 비정상적인 회전이나 갑작스러운 급선회가 일어난 상태로 오염물질 무단 유출 등이 전방위적으로 의심되는 경로입니다.",
    points: [
      { mmsi: "440234567", timestamp: "2026-06-16 12:00:00", lat: 34.600, lon: 129.200, sog: 18.0, cog: 78.0 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:05:00", lat: 34.605, lon: 129.230, sog: 18.1, cog: 78.2 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:10:00", lat: 34.610, lon: 129.260, sog: 18.2, cog: 77.9 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:15:00", lat: 34.615, lon: 129.290, sog: 17.9, cog: 78.5 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:20:00", lat: 34.620, lon: 129.320, sog: 18.0, cog: 78.0 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:25:00", lat: 34.625, lon: 129.350, sog: 17.8, cog: 78.1 },
      // Sudden sharp maneuver starts here (cog slips to 180, SOG plummets to 7 kts)
      { mmsi: "440234567", timestamp: "2026-06-16 12:30:00", lat: 34.612, lon: 129.365, sog: 12.4, cog: 140.0 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:35:00", lat: 34.582, lon: 129.365, sog: 7.2,  cog: 180.5 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:40:00", lat: 34.555, lon: 129.364, sog: 6.8,  cog: 181.2 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:45:00", lat: 34.528, lon: 129.363, sog: 7.0,  cog: 180.0 },
      { mmsi: "440234567", timestamp: "2026-06-16 12:50:00", lat: 34.501, lon: 129.362, sog: 7.1,  cog: 179.7 }
    ]
  },
  {
    mmsi: "440345678",
    name: "Poseidon 7 (Sensor Noise)",
    type: "LNG Tanker",
    description: "GPS 센서 에러, 전송 버그 또는 스푸핑으로 인해 특정 시점에 불가능한 좌표 이동 및 비현실적인 속도 분출(SOG 92.5 kts) 기형 노이즈가 유입되어 전처리 필터링이 시급한 사례입니다.",
    points: [
      { mmsi: "440345678", timestamp: "2026-06-16 12:00:00", lat: 34.850, lon: 129.100, sog: 12.0, cog: 270.0 },
      { mmsi: "440345678", timestamp: "2026-06-16 12:05:00", lat: 34.850, lon: 129.080, sog: 12.1, cog: 270.3 },
      { mmsi: "440345678", timestamp: "2026-06-16 12:10:00", lat: 34.850, lon: 129.060, sog: 11.9, cog: 269.8 },
      // Extreme noise spike in GPS / speed
      { mmsi: "440345678", timestamp: "2026-06-16 12:15:00", lat: 35.150, lon: 128.010, sog: 92.5, cog: 112.4 }, // Unrealistic jump
      { mmsi: "440345678", timestamp: "2026-06-16 12:20:00", lat: 34.850, lon: 129.020, sog: 12.0, cog: 270.1 }, // Normal position resumed
      { mmsi: "440345678", timestamp: "2026-06-16 12:25:00", lat: 34.850, lon: 129.000, sog: 12.2, cog: 270.5 },
      { mmsi: "440345678", timestamp: "2026-06-16 12:30:00", lat: 34.850, lon: 128.980, sog: 12.1, cog: 270.0 }
    ]
  },
  {
    mmsi: "440456789",
    name: "의심 선박 B (산호초 보호구역 무단 진입)",
    type: "Fishing Boat",
    description: "생태학적으로 민감한 산호초 보호 구역(위험 지역 GEOFENCE) 내부로 무단 진입 및 가속 행위가 감지되었습니다.",
    points: [
      { mmsi: "440456789", timestamp: "2026-06-16 12:00:00", lat: 34.880, lon: 129.450, sog: 6.2, cog: 135.0 },
      { mmsi: "440456789", timestamp: "2026-06-16 12:05:00", lat: 34.868, lon: 129.462, sog: 6.4, cog: 134.8 },
      { mmsi: "440456789", timestamp: "2026-06-16 12:10:00", lat: 34.856, lon: 129.474, sog: 6.3, cog: 135.2 },
      // Direct heading towards Coastal Guard Restricted Polygon centered around (34.82, 129.51)
      { mmsi: "440456789", timestamp: "2026-06-16 12:15:00", lat: 34.844, lon: 129.486, sog: 8.5, cog: 135.0 },
      { mmsi: "440456789", timestamp: "2026-06-16 12:20:00", lat: 34.832, lon: 129.498, sog: 11.2, cog: 135.5 }, // Trespassing geofence
      { mmsi: "440456789", timestamp: "2026-06-16 12:25:00", lat: 34.820, lon: 129.510, sog: 13.0, cog: 135.0 }, // Inside deep warning zone
      { mmsi: "440456789", timestamp: "2026-06-16 12:30:00", lat: 34.808, lon: 129.522, sog: 13.5, cog: 136.0 },
      { mmsi: "440456789", timestamp: "2026-06-16 12:35:00", lat: 34.796, lon: 129.534, sog: 13.2, cog: 134.9 }
    ]
  }
];

// Helper to convert objects collection into clean CSV formatted string
export function jsonToCsv(points: AISPoint[]): string {
  const headers = "MMSI,Timestamp,Latitude,Longitude,SOG,COG";
  const rows = points.map(p => `${p.mmsi},${p.timestamp},${p.lat},${p.lon},${p.sog},${p.cog}`);
  return [headers, ...rows].join("\n");
}

// Custom parser for uploaded/pasted CSV
export function parseCsv(csvText: string): AISPoint[] {
  const lines = csvText.split("\n");
  const result: AISPoint[] = [];
  
  // Find which column name matches what
  if (lines.length < 2) return [];
  
  const header = lines[0].toLowerCase().replace(/"/g, '').split(",");
  const mmsiIdx = header.findIndex(h => h.includes("mmsi"));
  const timeIdx = header.findIndex(h => h.includes("time") || h.includes("stamp"));
  const latIdx = header.findIndex(h => h.includes("lat"));
  const lonIdx = header.findIndex(h => h.includes("lon"));
  const sogIdx = header.findIndex(h => h.includes("sog") || h.includes("speed"));
  const cogIdx = header.findIndex(h => h.includes("cog") || h.includes("course"));
  
  // Fallback defaults if structure is standard: 0=MMSI, 1=Timestamp, 2=Lat, 3=Lon, 4=SOG, 5=COG
  const finalMmsiIdx = mmsiIdx !== -1 ? mmsiIdx : 0;
  const finalTimeIdx = timeIdx !== -1 ? timeIdx : 1;
  const finalLatIdx = latIdx !== -1 ? latIdx : 2;
  const finalLonIdx = lonIdx !== -1 ? lonIdx : 3;
  const finalSogIdx = sogIdx !== -1 ? sogIdx : 4;
  const finalCogIdx = cogIdx !== -1 ? cogIdx : 5;
  
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const cols = rawLine.split(",").map(c => c.replace(/"/g, '').trim());
    if (cols.length < 4) continue;
    
    const latVal = parseFloat(cols[finalLatIdx]);
    const lonVal = parseFloat(cols[finalLonIdx]);
    if (isNaN(latVal) || isNaN(lonVal)) continue;
    
    result.push({
      mmsi: cols[finalMmsiIdx] || "UNKNOWN",
      timestamp: cols[finalTimeIdx] || new Date().toISOString().replace('T', ' ').substring(0, 19),
      lat: latVal,
      lon: lonVal,
      sog: parseFloat(cols[finalSogIdx]) || 0,
      cog: parseFloat(cols[finalCogIdx]) || 0
    });
  }
  return result;
}

// Dynamic Python code generation based on UI sliders or configurations
export function generatePythonCode(config: {
  maxSpeedKts: number;
  lagSteps: number;
  xgboostEstimators: number;
  anomalyCofThreshold: number;
}): string {
  return `import pandas as pd
import numpy as np
from datetime import datetime
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error

"""
========================================================================
AIS 선박 경로 예측 및 이상 기동 실시간 탐지 파이프라인 (XGBoost)
========================================================================
- 작성목적: AIS 원천 데이터를 로드, 정련, 파생 변수를 고속으로 생성하고,
           XGBoost를 사용하여 차기 위치 예측 및 급격한 거동 패턴 감시 수행.
========================================================================
"""

# -------------------------------------------------------------
# [ST-1] 데이터 로드 (CSV 파일 문자열 주입 또는 로컬 파일 읽기 가능)
# -------------------------------------------------------------
def load_and_init_data(csv_filepath_or_buffer):
    """
    AIS 정형 데이터를 Pandas DataFrame으로 불러옵니다.
    """
    print("[1] AIS 원천 데이터를 정하민 정형 레이아웃으로 로드하고 있습니다...")
    # CSV를 읽고 컬럼 전처리 수행
    df = pd.read_csv(csv_filepath_or_buffer)
    
    # 컬럼 공백 제거 및 표준화
    df.columns = [col.strip() for col in df.columns]
    
    # 시간 정보를 datetime 타입으로 파싱 후 인덱스/시간순 정렬 대비
    df['Timestamp'] = pd.to_datetime(df['Timestamp'])
    return df


# -------------------------------------------------------------
# [ST-2] 데이터 정제 및 이상치 처리 (Preprocessing)
# -------------------------------------------------------------
def preprocess_ais_data(df, max_speed_threshold=${config.maxSpeedKts}):
    """
    1. MMSI 및 중요 좌표계 결측치 소거
    2. 중복 행 제거
    3. 비현실적 이상 속력(예: SOG > ${config.maxSpeedKts} knots) 필터링 (센서 노이즈)
    4. MMSI별 / Timestamp(시계열) 오름차순 정렬
    """
    print("[2] 데이터 클렌징 및 이상 센서 노이즈 필터링 진행 중...")
    initial_count = len(df)
    
    # 필수 좌표계 결측 검증
    df = df.dropna(subset=['MMSI', 'Latitude', 'Longitude'])
    
    # 정제 규칙 1: SOG(속도 Over Ground) 한계 임계값 초과 체크
    # 상선 속도가 ${config.maxSpeedKts}노트 이상인 값은 GPS 스푸핑 및 전송 불안 노이즈로 간주하고 필터링합니다.
    df = df[df['SOG'] <= max_speed_threshold]
    
    # MMSI 및 시간 기준 정렬
    df = df.sort_values(by=['MMSI', 'Timestamp']).reset_index(drop=True)
    
    cleaned_count = len(df)
    print(f" -> 완료: 총 {initial_count}개 행 중 {initial_count - cleaned_count}개의 이상/노이즈 레코드 소거 완료.")
    return df


# -------------------------------------------------------------
# [ST-3] 시계열 피처 엔지니어링 (Lag Features & Changes)
# -------------------------------------------------------------
def engineer_ais_features(df, lag_steps=${config.lagSteps}):
    """
    과거 시점(t-1, t-2) 위산/경도 차이를 계산하여 파생 피처를 생산합니다.
    - lat_lag1, lon_lag1 : 직전 시점(t-1) 위도 및 경도
    - lat_lag2, lon_lag2 : 전전 시점(t-2) 위도 및 경도
    - sog_diff : 최근 속도 가속화 변화량
    - cog_diff : 최근 방향(행선 침로) 꺾임 변화량
    """
    print(f"[3] 피처 엔지니어링 수행 중 (Window Lag: {lag_steps} 시점)...")
    
    # MMSI 단위로 시계열 그룹화를 수행하여 각 윈도우 슬라이스 계산
    grouped = df.groupby('MMSI')
    
    # 과거 수치 반영 (t-1, t-2 위경도 지연값 생성)
    for shift_i in range(1, lag_steps + 1):
        df[f'lat_lag{shift_i}'] = grouped['Latitude'].shift(shift_i)
        df[f'lon_lag{shift_i}'] = grouped['Longitude'].shift(shift_i)
        df[f'sog_lag{shift_i}'] = grouped['SOG'].shift(shift_i)
        df[f'cog_lag{shift_i}'] = grouped['COG'].shift(shift_i)

    # 15분 이내 시간 간격 가정을 통한 급변량 도출 (직전 속력 및 침로의 대수적 차이값)
    df['sog_diff'] = df['SOG'] - df['sog_lag1']
    
    # 침로 COG는 360도 평면 순환이므로 방향 차이의 주기성을 고려하여 보정 (-180 ~ +180)
    cog_raw_diff = df['COG'] - df['cog_lag1']
    df['cog_diff'] = (cog_raw_diff + 180) % 360 - 180
    
    # 다음 위치 예측을 위해 Target 변수(t+1 시점의 위경도)도 사전에 생성해 둡니다
    df['target_lat'] = grouped['Latitude'].shift(-1)
    df['target_lon'] = grouped['Longitude'].shift(-1)
    
    # Lag 변수들 및 Target 생성 과정에서 확보하지 못한 결측 시작/종료 부분 제거
    clean_featured_df = df.dropna().copy()
    print(f" -> 피처 엔지니어링 결과 생성된 피처 수: {len(clean_featured_df.columns)}개 적용됨.")
    return clean_featured_df


# -------------------------------------------------------------
# [ST-4] XGBoost 머신러닝 모델 학습 및 예측
# -------------------------------------------------------------
def train_prediction_model(df):
    """
    선박의 현재 물리 상태와 과거 Lag 이력 피처들을 기반으로 차기 좌표(Target Lat, Target Lon)를 예측하는
    독립적인 XGBoost Regressor 모델을 구동하고 검증합니다.
    """
    print("[4] 최적화된 XGBoost 예측 모델 학습 및 차수 검증 진행 중...")
    
    # 입력 모델 예측에 활용할 Feature 리스트 명시
    feature_cols = [
        'Latitude', 'Longitude', 'SOG', 'COG',
        'lat_lag1', 'lon_lag1', 'lat_lag2', 'lon_lag2',
        'sog_lag1', 'cog_lag1', 'sog_diff', 'cog_diff'
    ]
    
    X = df[feature_cols]
    y_lat = df['target_lat']
    y_lon = df['target_lon']
    
    # Train / Test Split
    X_train, X_test, y_train_lat, y_test_lat = train_test_split(X, y_lat, test_size=0.2, random_state=42)
    _, _, y_train_lon, y_test_lon = train_test_split(X, y_lon, test_size=0.2, random_state=42)
    
    # 1. 위도 예측 XGBoost Regressor
    model_lat = xgb.XGBRegressor(
        n_estimators=${config.xgboostEstimators},
        learning_rate=0.08,
        max_depth=5,
        random_state=42
    )
    model_lat.fit(X_train, y_train_lat)
    
    # 2. 경도 예측 XGBoost Regressor
    model_lon = xgb.XGBRegressor(
        n_estimators=${config.xgboostEstimators},
        learning_rate=0.08,
        max_depth=5,
        random_state=42
    )
    model_lon.fit(X_train, y_train_lon)
    
    # 성능 검증 예측
    pred_lat = model_lat.predict(X_test)
    pred_lon = model_lon.predict(X_test)
    
    rmse_lat = np.sqrt(mean_squared_error(y_test_lat, pred_lat))
    rmse_lon = np.sqrt(mean_squared_error(y_test_lon, pred_lon))
    
    print(f" -> [검증 성능] 위도 예측 RMSE: {rmse_lat:.6f} 도")
    print(f" -> [검증 성능] 경도 예측 RMSE: {rmse_lon:.6f} 도")
    
    return model_lat, model_lon, feature_cols


# -------------------------------------------------------------
# [ST-5] 지능형 이상 운항 감시 모니터링 로직 (Anomaly Monitor)
# -------------------------------------------------------------
def monitor_abnormal_behavior(df, model_lat, model_lon, feature_cols):
    """
    예측 위경도 평면과 전처리 도출 이상 패턴을 비교하여 4가지 감시 규칙으로 실시간 이상 징후를 분류합니다.
    
    1. 속도 이상(SOG_SUDDEN): 속도가 단시간 내 비정상 감속 혹은 급변경
    2. 조타 방향 급변(COG_SUDDEN): 훈련/충돌 회피 비정상 급선회 감지 (COG 변동 > 45도 초과)
    3. 예측 경로 이탈(DEVIATION_HIGH): XGBoost 예측 값 대비 실제 도달 거리가 유클리드 임계값 초과
    """
    print("[5] 파이썬 실시간 룰 기반 + ML 차수 이탈 이상 기동 모니터링 수행...")
    
    results = df.copy()
    
    # XGBoost 예측값 대입
    results['predicted_lat'] = model_lat.predict(results[feature_cols])
    results['predicted_lon'] = model_lon.predict(results[feature_cols])
    
    # 실제 도달 거리 편차 계산
    lat_err = results['target_lat'] - results['predicted_lat']
    lon_err = results['target_lon'] - results['predicted_lon']
    results['prediction_error_dist'] = np.sqrt(lat_err**2 + lon_err**2) * 111.32  # 도 단위 -> KM 근사치 변환
    
    anomalies = []
    for idx, row in results.iterrows():
        # 규칙 1: SOG_SUDDEN
        if abs(row['sog_diff']) > 6.0:  # 5분만에 6노트 이상 감속/가속
            anomalies.append({
                'Timestamp': str(row['Timestamp']),
                'MMSI': int(row['MMSI']),
                'Latitude': row['Latitude'],
                'Longitude': row['Longitude'],
                'Anomaly_Type': 'SOG_SUDDEN_CHANGE',
                'Status': 'CRITICAL',
                'Detail': f"급격한 기동 속도 변동 (변화량: {row['sog_diff']:.1f} kts)"
            })
            
        # 규칙 2: COG_SUDDEN
        if abs(row['cog_diff']) > ${config.anomalyCofThreshold}.0:  # 5분내 침로가 ${config.anomalyCofThreshold}도 이상 변경
            anomalies.append({
                'Timestamp': str(row['Timestamp']),
                'MMSI': int(row['MMSI']),
                'Latitude': row['Latitude'],
                'Longitude': row['Longitude'],
                'Anomaly_Type': 'COG_SUDDEN_TURN',
                'Status': 'WARNING',
                'Detail': f"지정 임계치 초과 급선회 감지 (변위 각도: {row['cog_diff']:.1f}도)"
            })
            
        # 규칙 3: DEVIATION_HIGH (ML 모델이 배가 갈 것으로 상정한 경로에서 어긋난 주행을 할 때)
        if row['prediction_error_dist'] > 0.45:  # 450m 이상 예측 모델 예상 궤적 이탈
            anomalies.append({
                'Timestamp': str(row['Timestamp']),
                'MMSI': int(row['MMSI']),
                'Latitude': row['Latitude'],
                'Longitude': row['Longitude'],
                'Anomaly_Type': 'PATH_DEVIATION_HIGH',
                'Status': 'CRITICAL',
                'Detail': f"XGBoost 예측 경로 오차 궤적 이탈 (이탈거리: {row['prediction_error_dist']*1000:.1f}m)"
            })
            
    anomalies_df = pd.DataFrame(anomalies)
    return results, anomalies_df


# -------------------------------------------------------------
# [ST-6] 로컬 메인 시뮬레이션 테스트 실행기
# -------------------------------------------------------------
if __name__ == "__main__":
    # 가상의 샘플 AIS 데이터 메모리 버퍼 생성 (사용자 주입과 동일한 규격)
    sample_csv_data = \"\"\"MMSI,Timestamp,Latitude,Longitude,SOG,COG
440987654,2026-06-16 12:00:00,34.524,128.845,15.2,41.5
440987654,2026-06-16 12:05:00,34.542,128.868,15.1,42.0
440987654,2026-06-16 12:10:00,34.561,128.891,15.3,42.1
440987654,2026-06-16 12:15:00,34.579,128.914,15.4,32.4
440987654,2026-06-16 12:20:00,34.598,128.937,92.5,42.3 # 노이즈 포인트 유입
440987654,2026-06-16 12:25:00,34.616,128.960,15.3,42.5
440987654,2026-06-16 12:30:00,34.635,128.983,15.5,42.2
440987654,2026-06-16 12:35:00,34.653,129.006,5.1,130.0 # 갑작스러운 속도 격감 및 회전
440987654,2026-06-16 12:40:00,34.671,129.029,5.0,131.0
\"\"\"
    
    import io
    # 1. 원천 데이터 취득
    raw_df = load_and_init_data(io.StringIO(sample_csv_data))
    
    # 2. 전처리 정제 구동
    cleaned_df = preprocess_ais_data(raw_df)
    
    # 3. 피처 지연변수 자동 구축
    featured_df = engineer_ais_features(cleaned_df)
    
    # 4. XGBoost 모델 피팅
    md_lat, md_lon, f_cols = train_prediction_model(featured_df)
    
    # 5. 이상 기동 실시간 탐지 결과 집계
    predicted_full, anomaly_summary = monitor_abnormal_behavior(featured_df, md_lat, md_lon, f_cols)
    
    print("\\n==================================================")
    print("   [분석 피드백 리포트 - 최종 탐지 요약]")
    print("==================================================")
    if len(anomaly_summary) > 0:
        print(anomaly_summary.to_string(index=False))
    else:
        print("정상 안전 운항 상태입니다. 어떠한 이상 거동 기동도 탐지되지 않았습니다.")
    print("==================================================\\n")
`;
}
