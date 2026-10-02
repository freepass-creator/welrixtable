// ============================================================================
//  광고 셀프견적 검사   —   node scripts/check-promo.mjs
// ----------------------------------------------------------------------------
//  우리 엔진이 «웰릭스 견적기와 같은 값»을 내는지 본다.
//  아래 실측값은 2026-09-17 에 welrixmobility.netlify.app 에서 직접 뽑은 것이다.
//
//  ★언제 돌리나
//    · calc.js 를 고쳤을 때
//    · 차량 스냅샷을 새로 받았을 때
//    · 웰릭스가 값을 바꾼 것 같을 때 (먼저 실측을 다시 뜨고 아래 표를 고친다)
//
//  ★값이 틀어지면 «우리 보정이 낡은 것»이다. scripts/promo-overrides.json 을
//    다시 잡는다. 도구: node _audit/welrix-netlify-20260917/캘리브레이션.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 뿌리 = resolve(여기, '..');
const 읽JSON = (p) => JSON.parse(readFileSync(resolve(뿌리, p), 'utf-8'));

const 정책 = 읽JSON('public/data/company-config/welrix.json');
const 보정 = 읽JSON('scripts/promo-overrides.json');
for (const [경로, 값] of Object.entries(보정['덮어쓸 것'])) {
  const 길 = 경로.split('.');
  let 자리 = 정책;
  for (const k of 길.slice(0, -1)) 자리 = 자리[k];
  자리[길.at(-1)] = 값;
}
setCompanyConfig(정책.financial ? 정책 : { financial: 정책 });

const DB = 읽JSON('src/data/vehicles.json');
const 우리들 = Array.isArray(DB) ? DB : (DB.vehicles || []);
const 찾 = (이름조각, 트림) =>
  우리들.find((v) => (v.name || '').replace(/_/g, '').includes(이름조각) && v.trim === 트림);

// ── 2026-09-17 웰릭스 견적기 실측 ────────────────────────────────────────────
//  공통: 중신용 · 보증금 10% · 선납 0% · 2만km · 웰스 Basic · 대물 1억 ·
//        추가운전자 없음 · 임직원 미가입 · 탁송 서울 120,000 · 수수료율 5%
const 실측 = [
  { 이름: '캐스퍼 1.0 가솔린 스마트',            잔가: ['캐스퍼', '1.0 가솔린 스마트'],
    가격: 15460000, 용품: 285000, 웰릭스: [398000, 427000, 487000] },
  { 이름: '캐스퍼 — 썬팅·블박 없음(광고 기본값)',  잔가: ['캐스퍼', '1.0 가솔린 스마트'],
    가격: 15460000, 용품: 0,      웰릭스: [393000, 422000, 480000] },
  { 이름: '쏘나타 디 엣지 1.6 터보 가솔린 Premium', 잔가: ['쏘나타', '1.6 터보 가솔린 Premium'],
    가격: 29330000, 용품: 285000, 웰릭스: [648000, 697000, 796000] },
  { 이름: '더 뉴 투싼 1.6 가솔린 터보 2WD Modern', 잔가: ['투싼', '1.6 가솔린 터보 2WD Modern'],
    가격: 28440000, 용품: 285000, 웰릭스: [623000, 667000, 759000] },
  { 이름: 'G70 2.5 가솔린 터보 2WD 기본 모델',    잔가: ['G70', 'G70 2.5 가솔린 터보 2WD 기본 모델'],
    가격: 45000000, 용품: 285000, 웰릭스: [1076000, 1193000, 1422000] },
  // ↓ 신형 — 우리 DB 에 없어 «구형 잔가를 빌린» 경우. 오차 1,000원까지 본다.
  { 이름: '디 올 뉴 아반떼 2.0 가솔린 Modern (잔가 빌림)', 잔가: ['아반떼', '1.6 가솔린 Modern'],
    가격: 23980000, 용품: 285000, 웰릭스: [530000, 563000, 633000] },
  { 이름: '더 뉴 그랜저 2.5 가솔린 2WD Premium (잔가 빌림)', 잔가: ['그랜저', '2.5 가솔린 2WD Premium'],
    가격: 42450000, 용품: 285000, 웰릭스: [846000, 901000, 1018000] },

  // ── ★수수료율 7% — 대표 2026-09-17 「7% 기준」. 웰릭스 입력 상한도 7% 다 ──
  { 이름: '[7%] 캐스퍼 1.0 가솔린 스마트', 잔가: ['캐스퍼', '1.0 가솔린 스마트'],
    가격: 15460000, 용품: 285000, 수수료: 7.0, 웰릭스: [403000, 434000, 497000] },
  // ★렌터카 전용 트림 — 제조사가 렌터카용으로 따로 매긴 값(기아·현대 공식 가격표 확인).
  //   일반 트림보다 306만원 싸다. 우리가 렌터카 회사라 이게 «쓰는» 값이다.
  { 이름: '[7%] 쏘나타 디 엣지 2.0 LPG Business 1 (렌터카 전용)',
    잔가: ['쏘나타', '2.0 LPG Business 1'],
    가격: 25600000, 용품: 285000, 수수료: 7.0, 웰릭스: [591000, 636000, 730000] },
];

const 허용오차 = 1000;   // 절사 경계에서 1,000원까지는 붙은 것으로 본다

const 입력 = (v, 가격, 용품, 기간, 수수료 = 5.0) => ({
  vehicle: { ...v, price: 가격 },
  options: { optPrice: 0, discount: 0, deliveryFee: 120000, itemsFee: 용품, etc: 0 },
  contract: { term: 기간, km: '2만km', dep: 10, pre: 0 },
  customer: { creditGrade: '중신용' },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입', injury: '무한',
               self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  fees: { feeRatePct: 수수료, svc: '웰스 Basic' },
});

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', X = '\x1b[0m';
const 원 = (n) => n.toLocaleString().padStart(10);
let 탈락 = 0, 느슨 = 0;

console.log(`웰릭스 실측 대조 — 보정 금리 ${(정책.financial.credit_lookup['중신용'].interest * 100).toFixed(2)}%\n`);
for (const c of 실측) {
  const v = 찾(...c.잔가);
  if (!v) { console.log(`${R}✘${X} ${c.이름} — 잔가 기준 트림을 우리 DB 에서 못 찾았다`); 탈락++; continue; }
  const 우리 = [60, 48, 36].map((t) => calcQuote(입력(v, c.가격, c.용품, t, c.수수료 ?? 5.0)).monthly);
  const 차이 = 우리.map((m, i) => m - c.웰릭스[i]);
  const 최대 = Math.max(...차이.map(Math.abs));
  const 표 = 최대 === 0 ? `${G}✔${X}` : 최대 <= 허용오차 ? `${Y}≈${X}` : `${R}✘${X}`;
  if (최대 > 허용오차) 탈락++; else if (최대 > 0) 느슨++;
  console.log(`${표} ${c.이름}`);
  console.log(`   우리  ${우리.map(원).join('')}`);
  console.log(`   웰릭스${c.웰릭스.map(원).join('')}   차이 ${차이.join(' / ')}`);
}
console.log(`\n정확히 일치 ${실측.length - 탈락 - 느슨} · 오차 1,000원 이내 ${느슨} · ${탈락 ? R : ''}틀어짐 ${탈락}${X}`);
if (탈락) {
  console.log(`\n${R}★보정이 낡았다.${X} 웰릭스 견적기에서 값을 다시 뜨고`);
  console.log('   node _audit/welrix-netlify-20260917/캘리브레이션.mjs 로 다시 잡는다.');
  process.exitCode = 1;
}
