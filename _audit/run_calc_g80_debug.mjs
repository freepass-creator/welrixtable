// G80 스탠다드 60mo 중신용 — Excel 1,326,000원 vs ERP 1,334,000원 = 8k 차이 추적
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));
const t = veh.find(v => v.brand==='제네시스' && v.price===60700000);
const r = calcQuote({
  vehicle: { brand: t.brand, model: t.model, trim: t.trim, price: t.price,
             disp: t.disp, fuel: t.fuel, tax_exempt: t.tax_exempt, group: t.group,
             multi_seat: t.multi_seat,
             r24: t.r24, r36: t.r36, r48: t.r48, r60: t.r60,
             strategic: t.strategic, buyback_apply: t.buyback_apply },
  options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },  // ← 탁송/선팅 0
  contract: { term: 60, km: '2만km', dep: 10, pre: 0 },
  customer: { creditGrade: '중신용' },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
               injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
});
console.log('vehicle:', t.trim);
console.log('disp:', t.disp, '/ r60:', t.r60, '/ strategic:', t.strategic);
console.log('monthly:', Math.round(r.monthly).toLocaleString(), '(Excel: 1,326,000)');
console.log();
const d = r._debug;
const sorted = ['C7','C8','C9','C10','C11','C12','C13','C14','C15','C22','C23','C24','C25',
                'C26','C27','C28','C29','C30','C31','C32','C33','C34','C35','C36','C37',
                'F13','F22','F23','F25','F26','F27','H27','H28','H32','H33','H34',
                'I4','I5','I6','I9','I10','I20','I21','I22','_I15'];
for (const k of sorted) {
  if (d[k] === undefined) continue;
  const v = d[k];
  if (typeof v === 'number') console.log(`  ${k.padEnd(7)} = ${v.toFixed(4).replace(/\.?0+$/,'')}`);
  else console.log(`  ${k.padEnd(7)} = ${v}`);
}
