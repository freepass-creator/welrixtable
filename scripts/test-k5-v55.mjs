// K5 2.0 HEV 베스트 셀렉션 — 엑셀 v5.5 견적1 시트 입력 동일
// 엑셀: 차량가 35,020,000 / 보증금 0 / 60M / 2만km / 중신용 / 블박 175k + 썬팅 105k
// 엑셀 결과: 735,000원 (월 대여료)
import { calcQuote } from '../src/lib/calc.js';

const vehicle = {
  brand: '기아', model: 'K5', name: 'K5',
  trim: 'K5 2.0 하이브리드 베스트 셀렉션', price: 35020000,
  disp: 1999, fuel: 'HEV.', tax_exempt: '과세', group: 'A군', multi_seat: null,
  r24: 0.66, r36: 0.57, r48: 0.5, r60: 0.42, strategic: 0, buyback_apply: 0.04,
};

// 엑셀 블박+썬팅: F9 175,000 + F10 105,000 = 280,000 (VAT 포함값)
// C14: (F9+F10)/1.1 = 254,545

const r = calcQuote({
  vehicle,
  options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 280000, etc: 0 },
  contract: { term: 60, km: '2만km', dep: 0, pre: 0 },
  customer: { creditGrade: '중신용' },
  insurance: {
    property: '1억', extraDriver: '없음',
    exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
    deductible: '30만원~', emergency: '가입',
  },
  fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
});

const d = r._debug;
console.log('========== K5 2.0 HEV 베스트 셀렉션 (calc.js vs 엑셀 v5.5) ==========');
console.log('월 대여료 결과:');
console.log('  calc.js:', r.monthly?.toLocaleString());
console.log('  엑셀 v6: 740,000');
console.log('');
console.log('셀별 비교:');
const rows = [
  ['C5 차량가',        d.C7,    35020000],  // 엑셀에 옵션 0 이라 C5=C7
  ['C7 소비자가',      d.C7,    35020000],
  ['C8 공급가',        d.C8,    30691272],
  ['C9 개소세+교육세',  d.C9,    1145091],
  ['C10 부가세',       d.C10,   3183636.3],
  ['C11 취득가액',     d.C11,   31836363],
  ['C12 취득세',       d.C12,   1273455],
  ['C13 등록비',       d.C13,   200000],
  ['C14 블박/썬팅',    d.C14,   254545],     // (175k+105k)/1.1 = 254,545
  ['C15 취득원가',     d.C15,   33564363],   // C11+C12+C13+C14
  ['I4 잔가(실제)',    d.I4,    0.42],
  ['I5 매각잔가가산',   d.I5,    0.04],
  ['I6 인수가율가산',   d.I6,    0.02],
  ['I9 대출이자',      d.I9,    null],
  ['I10 자동차보험',    d.I10,   820750],
  ['I20 영업수당',     d.I20,   null],
  ['I21 신용가산',     d.I21,   0.03],
  ['I22 기간가산',     d.I22,   -0.03],
  ['F22 취득원가(=C22)', d.F22, 33564363],
  ['F23 가산원가',     d.F23,   null],
  ['F25 PMT 산출대여료', Math.round(d.F25), null],
  ['F26 가산원가환산',  Math.round(d.F26), null],
  ['F27 산출대여료',    Math.round(d.F27), null],
  ['H27 신용가산',     Math.round(d.H27), null],
  ['H33 절사후청구',   d.H33, null],
  ['H34 최종월',       d.H34, 740000],   // v6 (중신용 profit 0.043) — v5.5=735,000
];
for (const [label, ours, excel] of rows) {
  const o = typeof ours === 'number' ? ours.toLocaleString() : ours;
  const e = excel != null ? (typeof excel === 'number' ? excel.toLocaleString() : excel) : '?';
  const diff = (typeof ours === 'number' && typeof excel === 'number') ? (ours - excel).toLocaleString() : '';
  const mark = (typeof ours === 'number' && typeof excel === 'number' && Math.abs(ours - excel) > 1) ? '❌' : '✓';
  console.log(`  ${mark} ${label.padEnd(20)} 우리: ${String(o).padStart(15)}  엑셀: ${String(e).padStart(15)}  diff: ${diff}`);
}
