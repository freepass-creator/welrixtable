// vehicles.json 의 trim ↔ catalog trim 매칭 정확도 검증
// 각 vehicles trim 에 대해:
//   - catalog 트림에서 spec(엔진) + detail(트림) 토큰 매칭 점수
//   - 매칭된 트림의 select_groups 개수 확인
//   - 점수 낮으면 (≤2) 매칭 부정확 → 보강 필요
//
// 사용:
//   node scripts/verify-matching.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(REPO_ROOT, 'src', 'data', 'car-master');
const VEHICLES_FILE = path.join(REPO_ROOT, 'src', 'data', 'vehicles.json');

// app.js의 MODEL_TO_CHASSIS 미러
const MODEL_TO_CHASSIS = {
  '그랜저': 'hyundai_grandeur_gn7_fl',
  '팰리세이드': 'hyundai_palisade_lx3',
  '쏘나타': 'hyundai_sonata_dn8_edge',
  '아반떼': 'hyundai_avante_cn7',
  '코나': 'hyundai_kona_sx2',
  '투싼': 'hyundai_tucson_nx4',
  '싼타페': 'hyundai_santafe_mx5',
  '베뉴': 'hyundai_venue',
  'K5': 'kia_k5_dl3_facelift',
  'K8': 'kia_k8_gl3',
  'K9': 'kia_k9_rj',
  '니로': 'kia_niro_sg2',
  '셀토스': 'kia_seltos_sp3',
  '스포티지': 'kia_sportage_nq5',
  '쏘렌토': 'kia_sorento_mq4_facelift',
  '카니발': 'kia_carnival_ka4_facelift',
};

// app.js DETAIL_TRIM_KEYWORDS 미러 (긴 키워드 먼저)
const DETAIL_TRIM_KEYWORDS = [
  'Black Exterior', 'Black Ink',
  'Premium', 'Exclusive', 'Honors', 'Calligraphy',
  '캘리그래피 블랙 잉크', '캘리그래피 블랙 익스테리어', '캘리그래피',
  '아너스', '익스클루시브', '프리미엄',
  '스포츠 패키지', '기본 모델',
  '플래티넘', '플래그십',
  '렌터카 프레스티지', '렌터카 트렌디',
  '시그니처 디자인', '시그니처',
  '베스트 셀렉션', '스마트 셀렉션',
  '노블레스', '프레스티지',
  '트렌디 라이트', '트렌디',
  '하이리무진', '리무진',
  '스마트 초이스', '인스퍼레이션', '디 에센셜', '스마트',
];

function commonPrefix(arr) {
  if (!arr.length) return '';
  let p = arr[0];
  for (const s of arr) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (!p) return '';
  }
  return p;
}

function splitTrim(trimText, prefix = '') {
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
  for (const kw of DETAIL_TRIM_KEYWORDS) {
    if (rest === kw || rest.endsWith(' ' + kw)) {
      detail = kw;
      rest = rest === kw ? '' : rest.slice(0, -kw.length - 1).trim();
      break;
    }
  }
  if (seats) detail = detail ? `${detail} · ${seats}` : seats;
  if (!detail) detail = '기본';
  return { spec: rest || trimText, detail };
}

function matchScore(specTokens, detailTokens, catalogName) {
  const tnLower = catalogName.toLowerCase();
  let score = 0;
  for (const tok of specTokens) {
    if (/^\d/.test(tok) && tnLower.includes(tok)) score += 3;
    else if (tnLower.includes(tok)) score += 1;
  }
  for (const tok of detailTokens) {
    if (tnLower.includes(tok)) score += 2;
  }
  return score;
}

const vehicles = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));
const byModel = {};
for (const v of vehicles) (byModel[v.model] ||= []).push(v);

console.log('=== vehicles trim ↔ catalog 매칭 검증 ===\n');

const issues = [];
for (const [model, chassis] of Object.entries(MODEL_TO_CHASSIS)) {
  const list = byModel[model] || [];
  const catPath = path.join(CATALOG_DIR, `${chassis}.json`);
  if (!fs.existsSync(catPath)) {
    console.log(`✗ ${model}: catalog 없음`);
    continue;
  }
  const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  const catalogTrims = Object.entries(catalog.trims || {});
  const prefix = commonPrefix(list.map((v) => v.trim));

  let ok = 0, weak = 0, fail = 0;
  const details = [];
  for (const v of list) {
    const { spec, detail } = splitTrim(v.trim, prefix);
    const specTokens = spec.toLowerCase().split(/\s+/).filter(Boolean);
    const detailTokens = detail.toLowerCase().split(/[\s·]+/).filter((t) => t && t !== '기본');

    let bestScore = -1;
    let bestName = '';
    let bestData = null;
    for (const [tn, td] of catalogTrims) {
      const s = matchScore(specTokens, detailTokens, tn);
      if (s > bestScore) { bestScore = s; bestName = tn; bestData = td; }
    }
    const sg = (bestData?.select_groups || []).length;
    if (bestScore >= 3 && sg > 0) ok++;
    else if (bestScore >= 1) {
      weak++;
      details.push(`  ⚠ ${v.trim} → "${bestName}" (점수 ${bestScore}, 옵션 ${sg})`);
    } else {
      fail++;
      details.push(`  ✗ ${v.trim} → "${bestName}" (점수 ${bestScore}, 옵션 ${sg})`);
    }
  }
  const totalCount = list.length;
  const sign = fail > 0 ? '✗' : weak > totalCount * 0.3 ? '⚠' : '✓';
  console.log(`${sign} ${model.padEnd(8)} 트림 ${totalCount.toString().padStart(2)} : 정확 ${ok} / 약함 ${weak} / 실패 ${fail}`);
  if (fail > 0 || weak > totalCount * 0.5) {
    issues.push({ model, fail, weak, total: totalCount, details });
  }
}

if (issues.length) {
  console.log('\n=== 매칭 문제 상세 ===');
  for (const iss of issues) {
    console.log(`\n[${iss.model}]`);
    iss.details.slice(0, 5).forEach((d) => console.log(d));
    if (iss.details.length > 5) console.log(`  ... +${iss.details.length - 5}`);
  }
}
