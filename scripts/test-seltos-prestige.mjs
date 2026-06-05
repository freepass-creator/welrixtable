// 셀토스 1.6 하이브리드 2WD 프레스티지 + 109만 옵션, 60개월 / 보증금 10% / 중신용
import { calcQuote } from '../src/lib/calc.js';

const vehicle = {
  brand: '기아', model: '셀토스', name: '셀토스',
  trim: '셀토스 1.6 하이브리드 2WD 프레스티지', price: 33590000,
  disp: 1998, fuel: '가솔린', tax_exempt: '과세', group: 'V군', multi_seat: null,
  r24: 0.7, r36: 0.61, r48: 0.54, r60: 0.46, strategic: 0.08, buyback_apply: 0,
};

const r = calcQuote({
  vehicle,
  options: { optPrice: 1090000, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
  contract: { term: 60, km: '2만km', dep: 10, pre: 0 },
  customer: { creditGrade: '중신용' },
  insurance: {
    property: '1억', extraDriver: '없음',
    exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
    deductible: '30만원~', emergency: '가입',
  },
  fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
});

console.log('--- 주요 결과 ---');
console.log('월 대여료:', r.monthly?.toLocaleString());
console.log('총 잔존가율:', r.residualPct);
console.log('잔존가 금액:', r.residualAmt?.toLocaleString());
console.log('--- 전체 ---');
console.log(JSON.stringify(r, null, 2));
