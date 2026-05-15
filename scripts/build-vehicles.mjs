// catalog json → vehicles.json 변환기
// - catalog: 제조사 출처 (트림명, 가격, 옵션) — 매일 자동 갱신
// - vehicles: calc.js 입력 형식 (배기량, 잔가율, 면세 등 영업 정책 포함)
//
// 잔가율 (r24/r36/r48/r60) 은 제조사에 없음 = wel 영업 정책
// → 기존 vehicles.json 에서 모델·엔진별 매트릭스로 추출해서 새 trim에 이식
//
// 사용:
//   node scripts/build-vehicles.mjs <chassis_id>            # 단일 모델 갱신
//   node scripts/build-vehicles.mjs --all                   # 매핑된 전체 모델 갱신
// 예:
//   node scripts/build-vehicles.mjs hyundai_grandeur_gn7_fl

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(REPO_ROOT, 'src', 'data', 'car-master');
const VEHICLES_FILE = path.join(REPO_ROOT, 'src', 'data', 'vehicles.json');

// chassis → model 매핑 (wel app.js MODEL_TO_CHASSIS 와 일관)
const CHASSIS_TO_MODEL = {
  // 현대
  'hyundai_grandeur_gn7_fl':        { model: '그랜저', brand: '현대' },
  'hyundai_grandeur_gn7_fl_hybrid': { model: '그랜저', brand: '현대' },
  'hyundai_palisade_lx3':    { model: '팰리세이드', brand: '현대' },
  'hyundai_sonata_dn8_edge': { model: '쏘나타', brand: '현대' },
  'hyundai_avante_cn7':      { model: '아반떼', brand: '현대' },
  'hyundai_kona_sx2':        { model: '코나', brand: '현대' },
  'hyundai_tucson_nx4':      { model: '투싼', brand: '현대' },
  'hyundai_santafe_mx5':     { model: '싼타페', brand: '현대' },
  'hyundai_venue':           { model: '베뉴', brand: '현대' },
  // 기아
  'kia_k5_dl3_facelift':       { model: 'K5', brand: '기아' },
  'kia_k8_gl3':                { model: 'K8', brand: '기아' },
  'kia_k9_rj':                 { model: 'K9', brand: '기아' },
  'kia_niro_sg2':              { model: '니로', brand: '기아' },
  'kia_seltos_sp3':            { model: '셀토스', brand: '기아' },
  'kia_sportage_nq5':          { model: '스포티지', brand: '기아' },
  'kia_sorento_mq4_facelift':  { model: '쏘렌토', brand: '기아' },
  'kia_carnival_ka4_facelift': { model: '카니발', brand: '기아' },
  // 레이/모닝은 PDF 구조 다름 — 별도 처리
};

// 트림명에서 엔진 정보 (fuel + disp) 추출
function parseEngine(trimName) {
  let fuel = '가솔린';
  if (/LPG/i.test(trimName)) fuel = 'LPG';
  else if (/하이브리드|HEV/i.test(trimName)) fuel = 'HEV';
  else if (/디젤/i.test(trimName)) fuel = '디젤';
  const dispM = trimName.match(/(\d\.\d)(?:\s*T)?/);
  const dispDecimal = dispM ? parseFloat(dispM[1]) : 0;
  const dispMap = { 1.0: 998, 1.6: 1598, 2.0: 1999, 2.4: 2360, 2.5: 2497, 3.0: 2999, 3.5: 3470 };
  const disp = dispMap[dispDecimal] || Math.round(dispDecimal * 1000);
  return { fuel, disp, dispDecimal };
}

// catalog 트림명 → {engine_label, trim_detail} 분리
// 예: "프리미엄 가솔린 2.5"           → { trim_detail: '프리미엄', engine_label: '가솔린 2.5' }
//     "프레스티지 하이브리드"          → { trim_detail: '프레스티지', engine_label: '하이브리드' }
//     "GT-라인 가솔린 1.6T"            → { trim_detail: 'GT-라인', engine_label: '가솔린 1.6T' }
//     "익스클루시브 플러스 장애인용 LPG 3.5" → { trim_detail: '익스클루시브 플러스 장애인용', engine_label: 'LPG 3.5' }
function splitTrimEngine(catalogTrimName) {
  // 엔진 패턴 (오른쪽 끝부터 매칭)
  const patterns = [
    /\s+(가솔린|LPG|디젤|하이브리드)\s+\d+(?:\.\d+)?\s*T?\s*$/,
    /\s+\d+(?:\.\d+)?\s*T?\s+(가솔린|LPG|디젤|하이브리드)\s*$/,
    /\s+(가솔린|LPG|디젤|하이브리드)\s*$/,
  ];
  for (const re of patterns) {
    const m = catalogTrimName.match(re);
    if (m) {
      const enginePart = m[0].trim();
      const detailPart = catalogTrimName.slice(0, m.index).trim();
      // 엔진 라벨 정규화: "1.6T 가솔린" / "가솔린 1.6T" → "가솔린 1.6T"
      const fuel = enginePart.match(/(가솔린|LPG|디젤|하이브리드)/)?.[0] || '가솔린';
      const size = enginePart.match(/\d+(?:\.\d+)?\s*T?/)?.[0]?.replace(/\s+/g, '');
      const engine_label = size ? `${fuel} ${size}` : fuel;
      return { trim_detail: detailPart || catalogTrimName, engine_label };
    }
  }
  return { trim_detail: catalogTrimName, engine_label: '' };
}

// 기존 vehicles.json 에서 모델·엔진별 잔가율 메타 추출
function extractResidualMatrix(vehicles, model) {
  const matrix = {};  // key: "fuel|disp" → { r24, r36, r48, r60, group, tax_exempt, buyback_apply, strategic, multi_seat }
  for (const v of vehicles) {
    if (v.model !== model) continue;
    const fuel = v.fuel === 'HEV.' ? 'HEV' : v.fuel;
    const key = `${fuel}|${v.disp}`;
    if (matrix[key]) continue;  // 같은 엔진은 첫 트림 기준
    matrix[key] = {
      r24: v.r24, r36: v.r36, r48: v.r48, r60: v.r60,
      group: v.group,
      tax_exempt: v.tax_exempt,
      buyback_apply: v.buyback_apply || 0,
      strategic: v.strategic || 0,
      multi_seat: v.multi_seat || null,
    };
  }
  return matrix;
}

// 가장 가까운 잔가율 룩업 (disp 정확 매칭 → 같은 연료 첫번째 → 기본값)
function lookupResidual(matrix, fuel, disp) {
  const exactKey = `${fuel}|${disp}`;
  if (matrix[exactKey]) return matrix[exactKey];
  // 같은 연료 첫번째
  for (const k of Object.keys(matrix)) {
    if (k.startsWith(`${fuel}|`)) return matrix[k];
  }
  // 기본값 (그랜저급 대형 세단 기준)
  return { r24: 0.65, r36: 0.55, r48: 0.48, r60: 0.4, group: 'A군', tax_exempt: '과세', buyback_apply: 0, strategic: 0, multi_seat: null };
}

// catalog trim → vehicles row
function trimToVehicle(brand, model, modelNameKr, trimName, trimData, residualMatrix) {
  const { fuel, disp } = parseEngine(trimName);
  const meta = lookupResidual(residualMatrix, fuel, disp);
  const isDisabled = /장애인용/.test(trimName);
  const taxExempt = isDisabled ? '면세' : meta.tax_exempt;
  // 정규화: catalog 트림명 → engine_label + trim_detail 분리
  const { trim_detail, engine_label } = splitTrimEngine(trimName);
  return {
    brand,
    model,
    model_name_kr: modelNameKr,        // UI 모델 dropdown 표시 (예: "더 뉴 그랜저 GN7")
    name: model,
    trim: `${modelNameKr} ${trimName}`,  // legacy 통합 문자열 (호환용)
    trim_detail,                        // UI 트림 dropdown (예: "프리미엄")
    engine_label,                       // UI 엔진 dropdown (예: "가솔린 2.5")
    price: trimData.price.base,
    disp,
    fuel,
    tax_exempt: taxExempt,
    group: meta.group,
    multi_seat: meta.multi_seat,
    r24: meta.r24,
    r36: meta.r36,
    r48: meta.r48,
    r60: meta.r60,
    strategic: meta.strategic,
    buyback_apply: meta.buyback_apply,
  };
}

// 옵션 중 "엔진 업그레이드" 발견 시 별도 vehicle row 생성
// 예: G2.5 트림 + "스마트스트림 가솔린 3.5 엔진 +2,470,000" → G3.5 row 추가
function expandEngineOptions(baseRow, trimData) {
  const extras = [];
  const selectGroups = trimData.select_groups || [];
  for (const opt of selectGroups) {
    const nameM = opt.name?.match(/(?:스마트스트림\s*)?(가솔린|LPG|디젤|하이브리드)\s*(\d\.\d)(?:\s*T)?\s*엔진/);
    if (!nameM || !opt.price) continue;
    const upFuel = nameM[1];
    const upSize = nameM[2];
    const upT = /T/.test(opt.name) ? 'T' : '';
    const newEngine = `${upFuel} ${upSize}${upT}`;
    if (newEngine === baseRow.engine_label) continue;  // 동일 엔진은 skip
    // 새 row: 가격 + 옵션, 엔진 라벨 갱신
    extras.push({
      ...baseRow,
      price: baseRow.price + opt.price,
      engine_label: newEngine,
      trim: baseRow.trim.replace(baseRow.engine_label, newEngine),
      _upgraded_from: baseRow.engine_label,
    });
  }
  return extras;
}

function buildOne(chassis, vehicles) {
  const meta = CHASSIS_TO_MODEL[chassis];
  if (!meta) throw new Error(`chassis 매핑 없음: ${chassis}`);
  const catPath = path.join(CATALOG_DIR, `${chassis}.json`);
  if (!fs.existsSync(catPath)) throw new Error(`catalog 없음: ${catPath}`);
  const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  const modelNameKr = catalog.model_name_kr || meta.model;
  const residualMatrix = extractResidualMatrix(vehicles, meta.model);
  console.log(`\n=== ${chassis} → ${meta.model} (${modelNameKr}) ===`);
  console.log(`  잔가율 메타: ${Object.keys(residualMatrix).join(' | ')}`);

  const newRows = [];
  for (const [trimName, trimData] of Object.entries(catalog.trims)) {
    const row = trimToVehicle(meta.brand, meta.model, modelNameKr, trimName, trimData, residualMatrix);
    newRows.push(row);
    // 엔진 업그레이드 옵션 → 별도 row 생성
    const extras = expandEngineOptions(row, trimData);
    newRows.push(...extras);
  }
  console.log(`  생성: ${newRows.length} 트림`);
  return { model: meta.model, rows: newRows };
}

// vehicles.json 갱신: 해당 모델의 기존 row 제거 + 새 row 추가
function applyToVehicles(vehicles, model, newRows) {
  const filtered = vehicles.filter((v) => v.model !== model);
  return [...filtered, ...newRows];
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('사용: node scripts/build-vehicles.mjs <chassis_id> | --all');
  process.exit(1);
}

let vehicles = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));
const targets = args[0] === '--all' ? Object.keys(CHASSIS_TO_MODEL) : [args[0]];
// 같은 모델에 여러 chassis (예: 가솔린 + 하이브리드) 가 매핑되면 합쳐서 적용
const modelRowsMap = {};
for (const chassis of targets) {
  const { model, rows } = buildOne(chassis, vehicles);
  modelRowsMap[model] = [...(modelRowsMap[model] || []), ...rows];
}
for (const [model, rows] of Object.entries(modelRowsMap)) {
  vehicles = applyToVehicles(vehicles, model, rows);
}

// 백업 후 저장
const backupPath = VEHICLES_FILE + '.bak';
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(VEHICLES_FILE, backupPath);
  console.log(`\n백업: ${backupPath}`);
}
fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehicles, null, 2));
console.log(`\n✓ 저장: ${VEHICLES_FILE} (총 ${vehicles.length} 트림)`);
