// 스포티지 1.6 HEV 노블레스 60개월 중신용 — Excel 견적1 캐시와 비교
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);

// vehicles.json 에서 스포티지 1.6 HEV 노블레스 정보 추출
const veh = JSON.parse(readFileSync(new URL('../src/data/vehicles.json', import.meta.url), 'utf-8'));
const target = veh.find(v => v.model === '스포티지' && v.price === 38280000);
console.log('vehicle:', target);

const r = calcQuote({
  vehicle: {
    brand: target.brand, model: target.model, trim: target.trim,
    price: target.price, disp: target.disp, fuel: target.fuel,
    tax_exempt: target.tax_exempt, group: target.group, multi_seat: target.multi_seat,
    r24: target.r24, r36: target.r36, r48: target.r48, r60: target.r60,
    strategic: target.strategic, buyback_apply: target.buyback_apply,
  },
  options:   { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
  contract:  { term: 60, km: '2만km', dep: 20, pre: 0 },
  customer:  { creditGrade: '중신용' },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
               injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  fees:      { feeRatePct: 5.0, svc: '웰스 Basic' },
});
console.log('calc.js result:');
console.log(`  monthly=${Math.round(r.monthly).toLocaleString()}원  잔가율=${(r.residualPct*100).toFixed(1)}%  만기인수=${Math.round(r.residualAmt).toLocaleString()}원`);
const dbg = r._debug;
const sortedKeys = Object.keys(dbg).sort();
for (const k of sortedKeys) {
  console.log(`  ${k.padEnd(8)} = ${dbg[k]}`);
}
