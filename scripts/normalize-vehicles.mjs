// vehicles.json 전체 차량 규격 통일
// - 모든 row 에 model_name_kr / engine_label / trim_detail 필드 강제 채움
// - catalog-출처 row 는 이미 채워져 있음 → 그대로
// - 엑셀-출처 row (제네시스/포터 등) 는 trim 문자열에서 자동 추출

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VEHICLES_FILE = path.join(REPO_ROOT, 'src', 'data', 'vehicles.json');

// 모델별 표시명 (코드명 포함 — 사용자 표시용)
const MODEL_NAME_KR = {
  // 현대 (catalog 갱신 안 된 모델만 매핑, 갱신된 건 그대로 유지)
  '캐스퍼': '캐스퍼',
  '포터2':  '포터 II',
  // 기아 (catalog 못 만든 모델)
  '레이':   '더 뉴 레이 TAM',
  '모닝':   '모닝 JA',
  // 제네시스
  'G70':  'G70',
  'G80':  '디 올 뉴 G80 RG3',
  'G90':  'G90 RS4',
  'GV70': 'GV70',
  'GV80': 'GV80',
};

// 트림 detail 키워드 (긴 거 먼저)
const DETAIL_KEYWORDS = [
  // 영문
  'Black Exterior', 'Black Ink',
  'Premium', 'Exclusive', 'Honors', 'Calligraphy',
  // 그랜저 한글
  '캘리그래피 블랙 잉크', '캘리그래피 블랙 익스테리어', '캘리그래피',
  '아너스', '익스클루시브', '프리미엄',
  // 제네시스
  '스포츠 패키지', '기본 모델',
  // K9/G90
  '플래티넘', '플래그십', '마스터즈',
  // K5/K8/스포티지/쏘렌토
  '렌터카 프레스티지', '렌터카 트렌디',
  '시그니처 디자인', '시그니처',
  '베스트 셀렉션', '스마트 셀렉션',
  '노블레스', '프레스티지',
  '트렌디 라이트', '트렌디',
  // 카니발
  '하이리무진', '리무진',
  // 캐스퍼
  '스마트 초이스', '인스퍼레이션', '디 에센셜', '스마트',
];

// 모델별 하이브리드 기본 배기량 (catalog 트림명에 배기량 없을 때 보강)
const HYBRID_DISP = {
  'K5': '2.0', 'K8': '1.6', '니로': '1.6', '스포티지': '1.6',
  '쏘렌토': '1.6', '카니발': '1.6', '그랜저': '1.6',
  '아반떼': '1.6', '코나': '1.6', '투싼': '1.6', '싼타페': '1.6',
};

// 엔진/구동 정규화 — "2.5 가솔린 터보 2WD" → "가솔린 2.5T 2WD"
function normalizeEngine(rawEngine, model) {
  if (!rawEngine) return '';
  const fuelM = rawEngine.match(/(가솔린|LPG|디젤|하이브리드|HEV)/);
  const sizeM = rawEngine.match(/(\d+\.\d+)/);
  const turbo = /터보|\d\.\dT\b|\d\.\d\s*T\b|\bT-GDi\b/.test(rawEngine);
  const drive = rawEngine.match(/\b(2WD|4WD|AWD)\b/);
  let fuel = fuelM ? fuelM[0] : '';
  let size = sizeM ? sizeM[1] : '';
  const t = turbo ? 'T' : '';
  // 하이브리드 배기량 없으면 모델별 default
  if (fuel === '하이브리드' && !size && model && HYBRID_DISP[model]) {
    size = HYBRID_DISP[model];
  }
  const parts = [];
  if (fuel) parts.push(fuel);
  if (size) parts.push(`${size}${t}`);
  if (drive) parts.push(drive[0]);
  return parts.length ? parts.join(' ') : rawEngine.trim();
}

function commonPrefix(arr) {
  if (!arr.length) return '';
  let p = arr[0];
  for (const s of arr) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (!p) return '';
  }
  return p;
}

function splitTrim(trimText, prefix) {
  let rest = trimText;
  if (prefix && rest.startsWith(prefix)) rest = rest.slice(prefix.length);
  // 휠 분리
  const wheelM = rest.match(/(\d+)인치휠/);
  if (wheelM) rest = rest.replace(' ' + wheelM[0], '').replace(wheelM[0] + ' ', '').replace(wheelM[0], '').trim();
  // 인승 분리
  const seatsM = rest.match(/([5-9])인승/);
  let seats = '';
  if (seatsM) { seats = seatsM[0]; rest = rest.replace(seats, '').trim().replace(/\s+/g, ' '); }
  // 트림 키워드 추출
  let detail = '';
  for (const kw of DETAIL_KEYWORDS) {
    if (rest === kw || rest.endsWith(' ' + kw) || rest.startsWith(kw + ' ')) {
      detail = kw;
      rest = rest === kw
        ? ''
        : rest.endsWith(' ' + kw)
          ? rest.slice(0, -kw.length - 1).trim()
          : rest.slice(kw.length + 1).trim();
      break;
    }
  }
  if (seats) detail = detail ? `${detail} · ${seats}` : seats;
  if (!detail) detail = '기본';
  return { engine_raw: rest, trim_detail: detail };
}

const vehicles = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));

let normalized = 0;
let alreadyOk = 0;

// 모델별 group (commonPrefix 계산용)
const byModel = {};
for (const v of vehicles) (byModel[v.model] ||= []).push(v);

for (const [model, list] of Object.entries(byModel)) {
  const prefix = commonPrefix(list.map((v) => v.trim));
  for (const v of list) {
    if (!v.model_name_kr) v.model_name_kr = MODEL_NAME_KR[model] || model;
    // 강제 재정규화 (이미 채워져있어도 normalizeEngine 적용해서 하이브리드 배기량 보강)
    if (!v.trim_detail) {
      const { trim_detail } = splitTrim(v.trim, prefix);
      v.trim_detail = trim_detail;
    }
    if (v.engine_label) {
      // 재정규화 (예: "하이브리드" → "하이브리드 2.0" 모델 보강)
      v.engine_label = normalizeEngine(v.engine_label, model);
    } else {
      const { engine_raw } = splitTrim(v.trim, prefix);
      v.engine_label = normalizeEngine(engine_raw, model);
    }
    normalized++;
  }
}

fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehicles, null, 2));
console.log(`✓ 정규화: ${normalized} 트림 / 기존 OK: ${alreadyOk} / 총 ${vehicles.length}`);

// 모델별 정규화 결과 샘플
console.log('\n=== 정규화 결과 샘플 ===');
const samples = ['G70', 'G80', 'GV70', '캐스퍼', '포터2', '레이', '모닝'];
for (const m of samples) {
  const items = byModel[m] || [];
  if (!items.length) continue;
  console.log(`\n[${m}] ${items[0].model_name_kr}`);
  const seen = new Set();
  for (const v of items.slice(0, 6)) {
    const key = `${v.engine_label}|${v.trim_detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  엔진=[${v.engine_label}]  트림=[${v.trim_detail}]  → ${v.price.toLocaleString()}원`);
  }
}
