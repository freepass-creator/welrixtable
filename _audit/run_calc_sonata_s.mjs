// 쏘나타 1.6 터보 S 트림 — 60/48/36 개월 각 시나리오 calc.js 결과 출력.
// 사용자가 Excel 결과와 비교용.
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);

const vehicle = {
  brand: '현대', model: '쏘나타', trim: '쏘나타 디 엣지 1.6 터보 가솔린 S',
  price: 30690000, disp: 1598, fuel: '가솔린',
  tax_exempt: '과세', group: 'A군', multi_seat: undefined,
  r24: 0.66, r36: 0.57, r48: 0.5, r60: 0.42,
  strategic: 0, buyback_apply: 0.04,
};

for (const term of [60, 48, 36]) {
  const r = calcQuote({
    vehicle,
    options:    { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
    contract:   { term, km: '2만km', dep: 10, pre: 0 },
    customer:   { creditGrade: '중신용' },
    insurance:  { property: '1억', extraDriver: '없음', exec: '미가입',
                  injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
    fees:       { feeRatePct: 5.0, svc: '웰스 Basic' },
  });
  console.log(`[${term}개월] monthly=${Math.round(r.monthly).toLocaleString()}원  잔가율=${(r.residualPct*100).toFixed(1)}%  만기인수=${Math.round(r.residualAmt).toLocaleString()}원  보증금=${Math.round(r.depositAmt).toLocaleString()}원`);
}
