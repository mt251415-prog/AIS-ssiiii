import { VesselPreset, AISPoint, ColumnMapping, DiagnosticResult, QualityIssue } from './types';

// CSV 파싱 유틸리티 (쌍따옴표 내 쉼표, 개행 등 완전 지원하는 가볍고 견고한 파서)
export function parseCsv(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(currentValue.trim());
      if (row.length > 1 || row[0] !== "") {
        result.push(row);
      }
      row = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  
  if (currentValue !== "" || row.length > 0) {
    row.push(currentValue.trim());
    result.push(row);
  }

  return result;
}

// JSON에서 CSV 문자열로 변환하는 유틸리티 (내보내기 용도)
export function jsonToCsv(headers: string[], rows: Record<string, string>[]): string {
  const csvHeaders = headers.join(",");
  const csvRows = rows.map(row => 
    headers.map(header => {
      const val = row[header] || "";
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(",")
  );
  return [csvHeaders, ...csvRows].join("\n");
}

// 컬럼명을 자동 인식하는 스마트 칼럼 맵퍼
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    mmsi: null,
    timestamp: null,
    lat: null,
    lon: null,
    sog: null,
    cog: null,
    heading: null,
    vesselName: null,
    callSign: null,
    lengthTop: null,
    lengthBottom: null,
    lengthLeft: null,
    lengthRight: null
  };

  const clean = (s: string) => (s || '').toLowerCase().replace(/[\s_\-]/g, "");

  headers.forEach(h => {
    const c = clean(h);
    
    // MMSI
    if (c === "mmsi" || c === "선박번호" || c === "선박식별번호" || c === "id" || c === "vesselid") {
      if (!mapping.mmsi) mapping.mmsi = h;
    }
    // Timestamp
    else if (c === "timestamp" || c === "수신시각" || c === "시간" || c === "일시" || c === "datetime" || c === "date" || c === "time" || c === "등록일시") {
      if (!mapping.timestamp) mapping.timestamp = h;
    }
    // Latitude
    else if (c === "latitude" || c === "lat" || c === "위도" || c === "y" || c === "위도좌표") {
      if (!mapping.lat) mapping.lat = h;
    }
    // Longitude
    else if (c === "longitude" || c === "lon" || c === "lng" || c === "경도" || c === "x" || c === "경도좌표") {
      if (!mapping.lon) mapping.lon = h;
    }
    // SOG
    else if (c === "sog" || c === "속도" || c === "speed" || c === "선속" || c === "속력" || c === "sog속도") {
      if (!mapping.sog) mapping.sog = h;
    }
    // COG
    else if (c === "cog" || c === "선수방위" || c === "course" || c === "침로" || c === "방위") {
      if (!mapping.cog) mapping.cog = h;
    }
    // Heading
    else if (c === "heading" || c === "헤딩" || c === "선수향" || c === "선향") {
      if (!mapping.heading) mapping.heading = h;
    }
    // Vessel Name
    else if (c === "vesselname" || c === "선박명" || c === "name" || c === "선박이름" || c === "이름") {
      if (!mapping.vesselName) mapping.vesselName = h;
    }
    // Call Sign
    else if (c === "callsign" || c === "호출부호" || c === "호출" || c === "선박호출부호") {
      if (!mapping.callSign) mapping.callSign = h;
    }
    // Length Top (상)
    else if (c.includes("길이상") || c.includes("lengthtop") || c.includes("dimensionaltop")) {
      mapping.lengthTop = h;
    }
    // Length Bottom (하)
    else if (c.includes("길이하") || c.includes("lengthbottom") || c.includes("dimensionalbottom")) {
      mapping.lengthBottom = h;
    }
    // Length Left (좌)
    else if (c.includes("길이좌") || c.includes("lengthleft") || c.includes("dimensionalleft")) {
      mapping.lengthLeft = h;
    }
    // Length Right (우)
    else if (c.includes("길이우") || c.includes("lengthright") || c.includes("dimensionalright")) {
      mapping.lengthRight = h;
    }
  });

  return mapping;
}

// 진단 리포트를 생성하는 고등 오창 분석 엔진
export function performDiagnostic(
  headers: string[],
  parsedRows: string[][],
  mapping: ColumnMapping,
  maxSpeedThreshold: number = 40
): DiagnosticResult {
  const totalRecords = parsedRows.length;
  const issues: QualityIssue[] = [];
  
  // 필수 필드 매핑 검사
  const missingRequiredColumns: string[] = [];
  if (!mapping.mmsi) missingRequiredColumns.push("MMSI (선박식별번호 / 선박번호)");
  if (!mapping.timestamp) missingRequiredColumns.push("Timestamp (수신시각 / 시간)");
  if (!mapping.lat) missingRequiredColumns.push("Latitude (위도)");
  if (!mapping.lon) missingRequiredColumns.push("Longitude (경도)");

  // 인덱스 맵 생성
  const idxMap = {
    mmsi: mapping.mmsi ? headers.indexOf(mapping.mmsi) : -1,
    timestamp: mapping.timestamp ? headers.indexOf(mapping.timestamp) : -1,
    lat: mapping.lat ? headers.indexOf(mapping.lat) : -1,
    lon: mapping.lon ? headers.indexOf(mapping.lon) : -1,
    sog: mapping.sog ? headers.indexOf(mapping.sog) : -1,
    cog: mapping.cog ? headers.indexOf(mapping.cog) : -1,
    heading: mapping.heading ? headers.indexOf(mapping.heading) : -1,
    vesselName: mapping.vesselName ? headers.indexOf(mapping.vesselName) : -1,
    callSign: mapping.callSign ? headers.indexOf(mapping.callSign) : -1,
    lengthTop: mapping.lengthTop ? headers.indexOf(mapping.lengthTop) : -1,
    lengthBottom: mapping.lengthBottom ? headers.indexOf(mapping.lengthBottom) : -1,
    lengthLeft: mapping.lengthLeft ? headers.indexOf(mapping.lengthLeft) : -1,
    lengthRight: mapping.lengthRight ? headers.indexOf(mapping.lengthRight) : -1,
  };

  // 같은 선박의 연속 좌표 3개 이상 조건 추가 검증
  let hasThreeConsecutiveCoords = false;
  if (missingRequiredColumns.length === 0) {
    if (idxMap.lat !== -1 && idxMap.lon !== -1 && idxMap.mmsi !== -1) {
      const consecutiveCounts: Record<string, number> = {};
      const maxConsecutive: Record<string, number> = {};
      
      parsedRows.forEach(row => {
        const mmsiVal = row[idxMap.mmsi] || "";
        if (!mmsiVal) return;
        
        const latVal = parseFloat(row[idxMap.lat]);
        const lonVal = parseFloat(row[idxMap.lon]);
        
        const isValidCoord = !isNaN(latVal) && !isNaN(lonVal) && latVal !== 0 && lonVal !== 0 && latVal <= 90 && latVal >= -90 && lonVal <= 180 && lonVal >= -185;
        
        if (isValidCoord) {
          consecutiveCounts[mmsiVal] = (consecutiveCounts[mmsiVal] || 0) + 1;
          if (consecutiveCounts[mmsiVal] > (maxConsecutive[mmsiVal] || 0)) {
            maxConsecutive[mmsiVal] = consecutiveCounts[mmsiVal];
          }
        } else {
          consecutiveCounts[mmsiVal] = 0;
        }
      });
      
      hasThreeConsecutiveCoords = Object.values(maxConsecutive).some(count => count >= 3);
    }
  }

  const isPredictable = missingRequiredColumns.length === 0 && hasThreeConsecutiveCoords;

  // IMO 칼럼 존재 확인 (식별번호(IMO) 등의 한글명 매핑 보완)
  const imoIdx = headers.findIndex(h => {
    const c = h.toLowerCase().replace(/[\s_\-()]/g, "");
    return c === "imo" || c.includes("선박식별번호") || c === "imo번호" || c === "선박식별번호imo";
  });

  const uniqueVessels = new Set<string>();
  let missingVesselNameCount = 0;
  let missingCallSignCount = 0;
  let missingImoCount = 0;
  let PlateCount = 0;
  
  let sogAnomalyCount = 0;
  let cogAnomalyCount = 0;
  let headingAnomalyCount = 0;
  let sizeAnomalyCount = 0;

  // 데이터 한 행씩 정독 분석
  parsedRows.forEach((row, rIdx) => {
    const rowNum = rIdx + 1;
    const mmsiVal = idxMap.mmsi !== -1 ? row[idxMap.mmsi] || "" : "";
    const timeVal = idxMap.timestamp !== -1 ? row[idxMap.timestamp] || "" : "";
    
    if (mmsiVal) {
      uniqueVessels.add(mmsiVal);
    } else if (idxMap.mmsi !== -1) {
      issues.push({
        rowIdx: rowNum,
        mmsi: "N/A",
        timestamp: timeVal || "N/A",
        column: mapping.mmsi || "MMSI",
        value: "",
        issueType: 'MISSING',
        severity: 'high',
        message: `${rowNum}행: 선박 고유식별값(MMSI/선박번호)이 비어있습니다.`
      });
    }

    // 선박명 누락
    if (idxMap.vesselName !== -1) {
      const vName = row[idxMap.vesselName] || "";
      if (!vName.trim()) {
        missingVesselNameCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: mapping.vesselName || "선박명",
            value: "",
            issueType: 'MISSING',
            severity: 'low',
            message: `${rowNum}행: 선박 한글/영문명이 누락되었습니다.`
          });
        }
      }
    } else {
      missingVesselNameCount++;
    }

    // IMO 식별누락/무효값(0) 정교 집계 및 품질 이슈 로깅
    if (imoIdx !== -1) {
      const imoVal = (row[imoIdx] || "").trim();
      if (!imoVal || imoVal === "0" || imoVal === "N/A" || imoVal === "null" || imoVal === "undefined") {
        missingImoCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: headers[imoIdx] || "IMO",
            value: imoVal,
            issueType: 'MISSING',
            severity: 'low',
            message: `${rowNum}행: 선박식별번호(IMO) 정보가 누락되었거나 무효값(0)인 행입니다.`
          });
        }
      }
    } else {
      missingImoCount++;
    }

    // 호출부호 누락/무효값(0) 정교 집계 및 품질 이슈 로깅
    if (idxMap.callSign !== -1) {
      const call = (row[idxMap.callSign] || "").trim();
      if (!call || call === "0" || call === "N/A" || call === "null" || call === "undefined") {
        missingCallSignCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: mapping.callSign || "호출부호",
            value: call || "EMPTY",
            issueType: 'MISSING',
            severity: 'low',
            message: `${rowNum}행: 호출부호가 공백값 또는 비식별 무기명(0) 상태입니다.`
          });
        }
      }
    } else {
      missingCallSignCount++;
    }

    // 위경도 누락 검사 (GPS 미수신)
    if (idxMap.lat !== -1 && idxMap.lon !== -1) {
      const latVal = parseFloat(row[idxMap.lat]);
      const lonVal = parseFloat(row[idxMap.lon]);
      if (isNaN(latVal) || isNaN(lonVal) || latVal === 0 || lonVal === 0 || latVal > 90 || latVal < -90 || lonVal > 180 || lonVal < -185) {
        issues.push({
          rowIdx: rowNum,
          mmsi: mmsiVal || "미상",
          timestamp: timeVal || "N/A",
          column: `위도/경도`,
          value: `lat: ${row[idxMap.lat]}, lon: ${row[idxMap.lon]}`,
          issueType: 'ABSENT_COORDINATE',
          severity: 'high',
          message: `${rowNum}행: 위도/경도 값이 누락되었거나 비정상적인 극값 또는 0으로 표기되어 위치 추적이 불가합니다.`
        });
      }
    }

    // 속도(SOG) 이상값 검사 (AIS 수신 미수신 무효값: 1023, 999 등)
    if (idxMap.sog !== -1) {
      const sogNum = parseFloat(row[idxMap.sog]);
      if (isNaN(sogNum)) {
        sogAnomalyCount++;
      } else if (sogNum === 1023 || sogNum === 102.3 || sogNum === 999 || sogNum < 0 || sogNum > maxSpeedThreshold) {
        sogAnomalyCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: mapping.sog || "속도",
            value: String(sogNum),
            issueType: 'LIMIT_EXCEEDED',
            severity: 'medium',
            message: `${rowNum}행: 비정상 속도 감지 (${sogNum} kts). AIS 무효 플래그(1023) 또는 한계치(${maxSpeedThreshold} kts)를 초과한 에러 데이터 성격입니다.`
          });
        }
      }
    }

    // 선수방위(COG) 이상치 검사
    if (idxMap.cog !== -1) {
      const cogNum = parseFloat(row[idxMap.cog]);
      if (isNaN(cogNum)) {
        cogAnomalyCount++;
      } else if (cogNum === 3600 || cogNum === 360 || cogNum < 0 || cogNum > 360) {
        cogAnomalyCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: mapping.cog || "선수방위",
            value: String(cogNum),
            issueType: 'OUT_OF_RANGE',
            severity: 'low',
            message: `${rowNum}행: 선수방위(COG) 수치가 정상 범위(0°~360°)를 이탈했습니다 (${cogNum}°).`
          });
        }
      }
    }

    // 헤딩(Heading) 이상치 검사 (미수신 대표코드 511)
    if (idxMap.heading !== -1) {
      const hgNum = parseFloat(row[idxMap.heading]);
      if (isNaN(hgNum)) {
        headingAnomalyCount++;
      } else if (hgNum === 511 || hgNum < 0 || hgNum > 360) {
        headingAnomalyCount++;
        if (rIdx < 20) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: mapping.heading || "헤딩",
            value: String(hgNum),
            issueType: 'OUT_OF_RANGE',
            severity: 'low',
            message: `${rowNum}행: 헤딩 전방 지향각이 미수신 코드(511) 또는 비현실적 범위 값입니다 (${hgNum}°).`
          });
        }
      }
    }

    // 선박 크기 밸런스 검수
    if (idxMap.lengthTop !== -1 || idxMap.lengthBottom !== -1 || idxMap.lengthLeft !== -1 || idxMap.lengthRight !== -1) {
      const t = idxMap.lengthTop !== -1 ? parseFloat(row[idxMap.lengthTop]) || 0 : 0;
      const b = idxMap.lengthBottom !== -1 ? parseFloat(row[idxMap.lengthBottom]) || 0 : 0;
      const l = idxMap.lengthLeft !== -1 ? parseFloat(row[idxMap.lengthLeft]) || 0 : 0;
      const r = idxMap.lengthRight !== -1 ? parseFloat(row[idxMap.lengthRight]) || 0 : 0;

      if ((t > 0 && b === 0) || (l > 0 && r === 0) || t > 300 || b > 300 || l > 100 || r > 100) {
        sizeAnomalyCount++;
        if (rIdx < 10) {
          issues.push({
            rowIdx: rowNum,
            mmsi: mmsiVal || "미상",
            timestamp: timeVal || "N/A",
            column: "선박 제원 정보",
            value: `${t}m x ${b}m x ${l}m x ${r}m`,
            issueType: 'UNREALISTIC',
            severity: 'low',
            message: `${rowNum}행: 선박 비대칭 및 유실 제원 폭 발견 (상:${t}m, 하:${b}m, 좌:${l}m, 우:${r}m)`
          });
        }
      }
    }
  });

  // 데이터 품질 점수 결정 (감점 방식)
  let baseScore = 100;
  if (!isPredictable) {
    baseScore -= 40; // 위치 미정의 치명타
  }
  
  const issuePenalty = Math.min(30, (issues.filter(i => i.severity === 'high').length * 3) + (issues.filter(i => i.severity === 'medium').length * 1));
  baseScore -= issuePenalty;

  // 누락 항목 감점
  const missingTextPenalty = Math.min(15, (missingVesselNameCount / Math.max(1, totalRecords)) * 10 + (missingCallSignCount / Math.max(1, totalRecords)) * 5);
  baseScore -= missingTextPenalty;

  const qualityScore = Math.max(10, Math.round(baseScore));

  const mappedColumns: { key: string; header: string }[] = [];
  Object.entries(mapping).forEach(([k, v]) => {
    if (v) mappedColumns.push({ key: k, header: v });
  });

  return {
    isPredictable,
    totalRecords,
    totalVessels: uniqueVessels.size,
    mappedColumns,
    missingRequiredColumns,
    qualityScore,
    issues,
    missingVesselNameCount,
    missingCallSignCount,
    missingImoCount,
    sogAnomalyCount,
    cogAnomalyCount,
    headingAnomalyCount,
    sizeAnomalyCount
  };
}

// 7단계 한글 주석 포함 로컬 분석 Python 코드 템플릿 생성기
export function generatePythonCode(params: {
  maxSpeedKts: number;
  anomalyCofThreshold: number;
  isPredictable: boolean;
  mapping: ColumnMapping;
}): string {
  const mapStr = JSON.stringify(params.mapping, null, 4);

  return `#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
================================================================================
물리 가감속 관성 기반 산호초 지오펜스 감시 시스템 - 로컬 데이터 분석 모듈
================================================================================

본 파이썬 프로그램은 웹 시뮬레이터와 연동되며, 사용자가 로컬 환경에서
대용량 AIS 해양 데이터를 전처리하고 물리 가감속 기반 경로 추적을 탐색할 수 있게 지원합니다.

[실행 가이드]
$ pip install pandas numpy

$ python ais_surveillance_pipeline.py --input data.csv
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd
from datetime import datetime

# -------------------------------------------------------------
# [ST-1] 컬럼 자동 매핑 정의 및 전처리 파라미터 구성
# -------------------------------------------------------------
# 웹 대시보드 상에서 자동 검색한 컬럼 정보와 슬라이더 튜닝값이 자동 바인딩되어 있습니다.

COLUMN_MAPPING = ${mapStr}

MAX_SPEED_THRESHOLD = ${params.maxSpeedKts}     # 비정상 데이터 필터링 최고 속도 (kts)
COG_CHANGE_THRESHOLD = ${params.anomalyCofThreshold}   # 특이 기동 급선회 기준 각도 (degree)

def load_and_decode_csv(filepath):
    """
    한글 공공데이터의 특성을 배려하여 CP949/EUC-KR 및 UTF-8 인코딩을 자동 탐색해 로드합니다.
    """
    encodings = ['utf-8', 'cp949', 'euc-kr', 'latin-1']
    for idx, enc in enumerate(encodings):
        try:
            print(f"[진행] {enc} 인코딩 시도 중... ({idx+1}/{len(encodings)})")
            df = pd.read_csv(filepath, encoding=enc)
            print(f"[성공] '{enc}' 인코딩으로 데이터 로드를 성공했습니다! (행 수: {len(df)})")
            return df
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"[에러] 로딩 실패: {e}")
            break
            
    raise ValueError("지원하는 모든 한글/일반 인코딩으로 CSV를 해독하지 못했습니다. 형식을 확인하세요.")

def analyze_dataset_quality(df):
    """
    -------------------------------------------------------------
    [ST-2] 선박 식별 기형 데이터 및 AIS 불통 누락 정보 진단
    -------------------------------------------------------------
    """
    print("\\n" + "="*50)
    print(" 2단계: 데이터 세트 품질 및 이상치 리포트")
    print("="*50)
    
    report = {
        'total_rows': len(df),
        'missing_gps_coords': 0,
        'unrealistic_sog': 0,
        'out_of_range_cog': 0,
        'out_of_range_heading': 0,
    }
    
    # 1. 위경도 누락 검증
    lat_col = COLUMN_MAPPING.get('lat')
    lon_col = COLUMN_MAPPING.get('lon')
    if lat_col and lon_col:
        # 공공데이터 등에서 빈값 또는 0으로 채워진 불량 좌표 검수
        null_coords = df[df[lat_col].isna() | df[lon_col].isna() | (df[lat_col] == 0) | (df[lon_col] == 0)]
        report['missing_gps_coords'] = len(null_coords)
        print(f"- 위치 좌표(GPS) 누락 및 0값 위반 건수: {len(null_coords)} 건")
    else:
        print("- [주의] 파일에 위도/경도 필드가 누락되어 물리 좌표 분석이 불가능합니다.")
        
    # 2. SOG (속도) 이상값 (대표 미수신 플래그 1023 검수)
    sog_col = COLUMN_MAPPING.get('sog')
    if sog_col:
        sog_series = pd.to_numeric(df[sog_col], errors='coerce')
        anom_sog = df[sog_series.isna() | (sog_series >= 102.3) | (sog_series == 1023) | (sog_series < 0) | (sog_series > MAX_SPEED_THRESHOLD)]
        report['unrealistic_sog'] = len(anom_sog)
        print(f"- AIS 수신 불가 플래그(1023) 및 한계속도 초과 건수: {len(anom_sog)} 건")
        
    # 3. COG (선수방위)
    cog_col = COLUMN_MAPPING.get('cog')
    if cog_col:
        cog_series = pd.to_numeric(df[cog_col], errors='coerce')
        anom_cog = df[cog_series.isna() | (cog_series > 360) | (cog_series < 0) | (cog_series == 3600)]
        report['out_of_range_cog'] = len(anom_cog)
        print(f"- 선수방위 범위 초과 (0~360 이탈) 건수: {len(anom_cog)} 건")
        
    # 4. Heading (헤딩 각도)
    hd_col = COLUMN_MAPPING.get('heading')
    if hd_col:
        hd_series = pd.to_numeric(df[hd_col], errors='coerce')
        anom_hd = df[hd_series.isna() | (hd_series > 360) | (hd_series < 0) | (hd_series == 511)]
        report['out_of_range_heading'] = len(anom_hd)
        print(f"- 헤딩 미수신 플래그(511) 및 정상범위 이탈 건수: {len(anom_hd)} 건")
        
    return report

def run_trajectory_forecaster(df):
    """
    -------------------------------------------------------------
    [ST-3] 시계열 지연(Lag) 피처 엔지니어링 및 다이나믹 분석
    -------------------------------------------------------------
    위/경도가 존재하는 대상을 추려, 이전 위치(t-1, t-2) 물리 관성 벡터를 통해
    정상 궤적 예측 시뮬레이션을 수행하고 급선회나 보호구역 침탈을 걸러냅니다.
    """
    mmsi_col = COLUMN_MAPPING.get('mmsi')
    time_col = COLUMN_MAPPING.get('timestamp')
    lat_col = COLUMN_MAPPING.get('lat')
    lon_col = COLUMN_MAPPING.get('lon')
    sog_col = COLUMN_MAPPING.get('sog')
    cog_col = COLUMN_MAPPING.get('cog')

    print("\\n" + "="*50)
    print(" 3단계: 시간순 선박 경로 예측 및 이상 궤적 추적 연산")
    print("="*50)

    # 필수값 결측 정제
    clean_df = df.dropna(subset=[mmsi_col, time_col, lat_col, lon_col]).copy()
    try:
        clean_df[time_col] = pd.to_datetime(clean_df[time_col])
    except Exception:
        print("[경고] 시간형식 변환 실패. 일반 문자열 정렬을 적용합니다.")
        
    # MMSI 및 시간순 정렬
    clean_df = clean_df.sort_values(by=[mmsi_col, time_col])
    
    # 지연 변수 생성 (t-1, t-2 과거 시점 구하기)
    clean_df['lat_lag1'] = clean_df.groupby(mmsi_col)[lat_col].shift(1)
    clean_df['lon_lag1'] = clean_df.groupby(mmsi_col)[lon_col].shift(1)
    clean_df['lat_lag2'] = clean_df.groupby(mmsi_col)[lat_col].shift(2)
    clean_df['lon_lag2'] = clean_df.groupby(mmsi_col)[lon_col].shift(2)
    
    # -------------------------------------------------------------
    # [ST-4] 관성 기반 궤적 예측 모델 (물리 보간 알고리즘 적용)
    # -------------------------------------------------------------
    # 머신러닝 분석에 필수적인 입력 벡터(t-1 등속 모델) 및 산호초 보호 구역 진입 필터 적용
    
    predictions = []
    anomalies = []
    
    # 산호초 보호 구역 중심 경위도 (34.68, 129.04) 기준 반경 계산
    protect_lat, protect_lon = 34.68, 129.04
    
    for i, row in clean_df.iterrows():
        lat = row[lat_col]
        lon = row[lon_col]
        lat_l1 = row['lat_lag1']
        lon_l1 = row['lon_lag1']
        lat_l2 = row['lat_lag2']
        lon_l2 = row['lon_lag2']
        sog = row[sog_col] if pd.notna(row[sog_col]) else 0
        cog = row[cog_col] if pd.notna(row[cog_col]) else 0
        
        # 예측값 연산 (과거 2개 위치 기반 2차 선형 등가속 운동 예측)
        if pd.notna(lat_l1) and pd.notna(lon_l1):
            if pd.notna(lat_l2) and pd.notna(lon_l2):
                # t-1, t-2 기반 가속 속도 연계 예측
                pred_lat = lat_l1 + (lat_l1 - lat_l2)
                pred_lon = lon_l1 + (lon_l1 - lon_l2)
            else:
                # t-1 기반 단순 등속 관성 예측
                pred_lat = lat_l1
                pred_lon = lon_l1
                
            # 유클리드 전방 예측 고장 오차 연산 (오차 m 환산식 단순화)
            err_dist = np.sqrt((lat - pred_lat)**2 + (lon - pred_lon)**2) * 111320 # 1도당 평균 111km
            predictions.append((rowNum:=i, pred_lat, pred_lon, err_dist))
            
            # 오차 거리 480m 이상 급변경 기동 경보
            if err_dist > 480:
                anomalies.append({
                    'row_idx': i,
                    'mmsi': row[mmsi_col],
                    'time': str(row[time_col]),
                    'type': '위험 기동 이탈',
                    'message': f"예상 안전 항로에서 {err_dist:.1f}m 급격히 이격된 특이 기동 포착 (항로 이탈 의심)"
                })
        else:
            predictions.append((i, np.nan, np.nan, 0))
            
        # -------------------------------------------------------------
        # [ST-5] 지오펜스(Geofence) 보호 구역 실시간 무단 진입 식별
        # -------------------------------------------------------------
        dist_to_reef = np.sqrt((lat - protect_lat)**2 + (lon - protect_lon)**2) * 60 # 해리 근사치
        if dist_to_reef < 0.12: # 약 220미터 이내 초접근
            anomalies.append({
                'row_idx': i,
                'mmsi': row[mmsi_col],
                'time': str(row[time_col]),
                'type': '산호초 침범 위반',
                'message': "⚠️ 환경 위반: 허가되지 않은 선박이 보호 구역 내측 경계를 돌파 진행 중!"
            })
            
    # 데이터 장착 및 로컬 출력
    predictions_df = pd.DataFrame(predictions, columns=['row_idx', 'pred_lat', 'pred_lon', 'deviation_error_m'])
    clean_df = clean_df.join(predictions_df.set_index('row_idx'))
    
    print(f"- 관성기반 자율 경로 시뮬레이션 완료 (통과 레코드 수: {len(clean_df)}행)")
    print(f"- 경로 이탈 특이 기동 및 경보 위협 건수: {len(anomalies)} 건")
    
    if anomalies:
        print("\\n[보호소 통제 센터 실시간 경보 로그]")
        for a in anomalies[:5]:
            print(f" ▶ [{a['type']}] ({a['time']}) MMSI {a['mmsi']}: {a['message']}")
            
    return clean_df, anomalies

def main():
    parser = argparse.ArgumentParser(description="AIS CSV 진단 및 선박 이상값 감시 파이프라인")
    parser.add_argument('--input', type=str, required=True, help="분석 대상 선박 AIS CSV 파일 경로")
    parser.add_argument('--output', type=str, default='ais_analysis_report.csv', help="결과를 저장할 CSV 파일 경로")
    
    # 파라미터가 비어있어도 디스크 세션 로드로 직접 실행 가능하게 지원
    args = parser.parse_args(args=None if sys.argv[1:] else ['--input', 'vessel_sample.csv'])
    
    if not os.path.exists(args.input):
        print(f"[오류] 데이터 파일 '{args.input}'이(가) 로컬에 존재하지 않습니다!")
        print("대체용 샘플 데이터를 임시로 생성 및 분석하여 예시를 출력합니다.")
        # 간이 샘플 파일 빌딩
        sample_df = pd.DataFrame({
            '선박번호': ['440456123']*5,
            '수신시각': [f"2026-06-23 12:0{idx}:00" for idx in range(5)],
            '위도': [34.675, 34.678, 34.681, 34.683, 34.685],
            '경도': [129.032, 129.035, 129.039, 129.041, 129.043],
            '속도': [12.4, 12.5, 1023, 11.2, 124.5], # 1023 수신불가, 124 kts 기형속도 포함
            '선수방위': [45.2, 45.4, 46.1, 3600, 47.2]  # 3600 미수신값 포함
        })
        sample_df.to_csv('vessel_sample.csv', index=False, encoding='utf-8')
        args.input = 'vessel_sample.csv'

    # 1. 파일 적재
    df = load_and_decode_csv(args.input)
    
    # 2. 전처리 에러 및 품질 검수
    analyze_dataset_quality(df)
    
    # 3. 경로 추적 시뮬레이션 (위경도 필드가 있을 때 한정)
    lat_col = COLUMN_MAPPING.get('lat')
    lon_col = COLUMN_MAPPING.get('lon')
    
    if lat_col and lon_col:
        result_df, warns = run_trajectory_forecaster(df)
        # -------------------------------------------------------------
        # [ST-6] 로컬 디스크 통합 저장 및 데이터 검증 마무리
        # -------------------------------------------------------------
        result_df.to_csv(args.output, index=False, encoding='utf-8-sig')
        print(f"\\n[성공] 관제 분석 및 예측이 완료되어 최 종합 결과가 '{args.output}'에 보존되었습니다.")
    else:
        print("\\n[종료] 위도와 경도가 발견되지 않아 경로 추적 없이 정적 상태 품질 진단 후 작업을 마칩니다.")

if __name__ == "__main__":
    main()
`;
}

// ============================================================================
// 테스트용 시연 데이터셋 (원클릭 로드 및 발표 지원)
// ============================================================================

// 데모 A (항로 예측 및 위험 지오펜스 침탈 완벽 구동형 프리셋)
export const SAMPLE_A_TRACK: VesselPreset[] = [
  {
    mmsi: "440123789",
    name: "한국해양공동선 (연구 조사선)",
    type: "Oceanographic Vessel",
    description: "독도 및 제주해역 부근 해양 생태계 조사를 정기 수행하는 조사선입니다. 정상적인 속도로 관측 후 안전 구간으로 복귀하는 무해 경로입니다.",
    points: [
      {
        mmsi: "440123789",
        timestamp: "2026-06-23 12:00:00",
        lat: 34.612,
        lon: 128.905,
        sog: 11.2,
        cog: 45.2,
        originalRow: { "선박번호": "440123789", "수신시각": "2026-06-23 12:00:00", "위도": "34.612", "경도": "128.905", "속도": "11.2", "선수방위": "45.2", "선박명": "한국해양공동선" }
      },
      {
        mmsi: "440123789",
        timestamp: "2026-06-23 12:05:00",
        lat: 34.621,
        lon: 128.918,
        sog: 11.5,
        cog: 45.5,
        originalRow: { "선박번호": "440123789", "수신시각": "2026-06-23 12:05:00", "위도": "34.621", "경도": "128.918", "속도": "11.5", "선수방위": "45.5", "선박명": "한국해양공동선" }
      },
      {
        mmsi: "440123789",
        timestamp: "2026-06-23 12:10:00",
        lat: 34.630,
        lon: 128.931,
        sog: 11.4,
        cog: 45.6,
        originalRow: { "선박번호": "440123789", "수신시각": "2026-06-23 12:10:00", "위도": "34.630", "경도": "128.931", "속도": "11.4", "선수방위": "45.6", "선박명": "한국해양공동선" }
      },
      {
        mmsi: "440123789",
        timestamp: "2026-06-23 12:15:00",
        lat: 34.639,
        lon: 128.944,
        sog: 11.3,
        cog: 45.3,
        originalRow: { "선박번호": "440123789", "수신시각": "2026-06-23 12:15:00", "위도": "34.639", "경도": "128.944", "속도": "11.3", "선수방위": "45.3", "선박명": "한국해양공동선" }
      },
      {
        mmsi: "440123789",
        timestamp: "2026-06-23 12:20:00",
        lat: 34.648,
        lon: 128.957,
        sog: 11.4,
        cog: 45.4,
        originalRow: { "선박번호": "440123789", "수신시각": "2026-06-23 12:20:00", "위도": "34.648", "경도": "128.957", "속도": "11.4", "선수방위": "45.4", "선박명": "한국해양공동선" }
      }
    ]
  },
  {
    mmsi: "440267812",
    name: "의심 선박 A (급선회 및 연안 이탈)",
    type: "Dangerous Vessel A",
    description: "관찰 도중 1215 분 경과 시점에서 갑작스럽게 예기치 못한 우현 90도 격각 선회를 가하여 정상 항로를 탈출한 비정상 주행 선박입니다.",
    points: [
      {
        mmsi: "440267812",
        timestamp: "2026-06-23 12:00:00",
        lat: 34.590,
        lon: 129.130,
        sog: 14.5,
        cog: 60.0,
        originalRow: { "선박번호": "440267812", "수신시각": "2026-06-23 12:00:00", "위도": "34.590", "경도": "129.130", "속도": "14.5", "선수방위": "60.0", "선박명": "의심 선박 A" }
      },
      {
        mmsi: "440267812",
        timestamp: "2026-06-23 12:05:00",
        lat: 34.602,
        lon: 129.155,
        sog: 14.6,
        cog: 60.2,
        originalRow: { "선박번호": "440267812", "수신시각": "2026-06-23 12:05:00", "위도": "34.602", "경도": "129.155", "속도": "14.6", "선수방위": "60.2", "선박명": "의심 선박 A" }
      },
      {
        mmsi: "440267812",
        timestamp: "2026-06-23 12:10:00",
        lat: 34.614,
        lon: 129.180,
        sog: 14.4,
        cog: 60.1,
        originalRow: { "선박번호": "440267812", "수신시각": "2026-06-23 12:10:00", "위도": "34.614", "경도": "129.180", "속도": "14.4", "선수방위": "60.1", "선박명": "의심 선박 A" }
      },
      {
        mmsi: "440267812",
        timestamp: "2026-06-23 12:15:00",
        lat: 34.618,
        lon: 129.215,
        sog: 11.2,
        cog: 172.5, // 갑자기 선수방위 대폭 변경 및 감속 (급격한 방위 변경!)
        originalRow: { "선박번호": "440267812", "수신시각": "2026-06-23 12:15:00", "위도": "34.618", "경도": "129.215", "속도": "11.2", "선수방위": "172.5", "선박명": "의심 선박 A" }
      },
      {
        mmsi: "440267812",
        timestamp: "2026-06-23 12:20:00",
        lat: 34.604,
        lon: 129.220,
        sog: 9.8,
        cog: 175.0,
        originalRow: { "선박번호": "440267812", "수신시각": "2026-06-23 12:20:00", "위도": "34.604", "경도": "129.220", "속도": "9.8", "선수방위": "175.0", "선박명": "의심 선박 A" }
      }
    ]
  },
  {
    mmsi: "440954123",
    name: "의심 선박 B (산호초 지오펜스 무단 침탈선)",
    type: "Dangerous Vessel B",
    description: "생태 가치가 극상인 '산호초 보호 구역(34.68, 129.04)'에 허가 없이 영내로 급진입하여 지오펜스 실시간 쉘 위반 경보를 격발시킨 소형 고속 어로정입니다.",
    points: [
      {
        mmsi: "440954123",
        timestamp: "2026-06-23 12:00:00",
        lat: 34.670,
        lon: 129.015,
        sog: 18.2,
        cog: 50.0,
        originalRow: { "선박번호": "440954123", "수신시각": "2026-06-23 12:00:00", "위도": "34.670", "경도": "129.015", "속도": "18.2", "선수방위": "50.0", "선박명": "의심 선박 B" }
      },
      {
        mmsi: "440954123",
        timestamp: "2026-06-23 12:05:00",
        lat: 34.675,
        lon: 129.025,
        sog: 18.5,
        cog: 50.1,
        originalRow: { "선박번호": "440954123", "수신시각": "2026-06-23 12:05:00", "위도": "34.675", "경도": "129.025", "속도": "18.5", "선수방위": "50.1", "선박명": "의심 선박 B" }
      },
      {
        mmsi: "440954123",
        timestamp: "2026-06-23 12:10:00",
        lat: 34.680,
        lon: 129.038, // 산호초 중심 (34.68, 129.04) 에 초근접! (침입 개시됨)
        sog: 19.1,
        cog: 50.2,
        originalRow: { "선박번호": "440954123", "수신시각": "2026-06-23 12:10:00", "위도": "34.680", "경도": "129.038", "속도": "19.1", "선수방위": "50.2", "선박명": "의심 선박 B" }
      },
      {
        mmsi: "440954123",
        timestamp: "2026-06-23 12:15:00",
        lat: 34.685,
        lon: 129.049,
        sog: 18.8,
        cog: 50.0,
        originalRow: { "선박번호": "440954123", "수신시각": "2026-06-23 12:15:00", "위도": "34.685", "경도": "129.049", "속도": "18.8", "선수방위": "50.0", "선박명": "의심 선박 B" }
      },
      {
        mmsi: "440954123",
        timestamp: "2026-06-23 12:20:00",
        lat: 34.690,
        lon: 129.060,
        sog: 18.0,
        cog: 49.8,
        originalRow: { "선박번호": "440954123", "수신시각": "2026-06-23 12:20:00", "위도": "34.690", "경도": "129.060", "속도": "18.0", "선수방위": "49.8", "선박명": "의심 선박 B" }
      }
    ]
  }
];

// 품질 진단 및 이탈 탐색 대시보드 시뮬레이터 백업 예시용 (모드 B: 경위도 불포함 한국 제원 공공데이터용)
export const SAMPLE_B_STRUCT_ONLY: Record<string, string>[] = [
  { "선박번호": "44101", "선박명": "남해스타호 (어선)", "선박식별번호(IMO)": "120556", "호출부호": "DT3981", "선박길이_상": "15", "선박길이_하": "15", "선박길이_좌": "4", "선박길이_우": "0", "수신시각": "2026-06-23 09:00:00", "속도": "9.5", "선수방위": "270", "헤딩": "511" },
  { "선박번호": "44101", "선박명": "남해스타호 (어선)", "선박식별번호(IMO)": "120556", "호출부호": "DT3981", "선박길이_상": "15", "선박길이_하": "15", "선박길이_좌": "4", "선박길이_우": "4", "수신시각": "2026-06-23 09:15:00", "속도": "1023", "선수방위": "270", "헤딩": "268" }, // 1023 이상속도오차
  { "선박번호": "44102", "선박명": "골든크라운호 (화물선)", "선박식별번호(IMO)": "0", "호출부호": "", "선박길이_상": "90", "선박길이_하": "0", "선박길이_좌": "14", "선박길이_우": "14", "수신시각": "2026-06-23 09:05:00", "속도": "12.5", "선수방위": "180", "헤딩": "180" }, // IMO=0, 호출부호 누락, 길이 하 미기재로 비대칭
  { "선박번호": "44103", "선박명": "", "선박식별번호(IMO)": "955102", "호출부호": "HQ9122", "선박길이_상": "210", "선박길이_하": "210", "선박길이_좌": "32", "선박길이_우": "32", "수신시각": "2026-06-23 09:12:00", "속도": "58.2", "선수방위": "3600", "헤딩": "34" }, // 선명 누락, COG=3600 이상치, 속도=58노트(비정상 과속)
  { "선박번호": "44104", "선박명": "오션블루호 (여객선)", "선박식별번호(IMO)": "885102", "호출부호": "OB1203", "선박길이_상": "45", "선박길이_하": "45", "선박길이_좌": "8", "선박길이_우": "8", "수신시각": "2026-06-23 09:20:00", "속도": "18.2", "선수방위": "115", "헤딩": "115" },
  { "선박번호": "44105", "선박명": "천지해양6호 (유조선)", "선박식별번호(IMO)": "901123", "호출부호": "CJ667", "선박길이_상": "110", "선박길이_하": "110", "선박길이_좌": "18", "선박길이_우": "18", "수신시각": "2026-06-23 09:30:00", "속도": "-5.5", "선수방위": "50", "헤딩": "-10" } // 속도 음수, 헤딩 음수 이상치
];
