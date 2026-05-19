// 카니발 9인승 1.6 하이브리드 노블레스 — vehicles.json 재생성 후 검증
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));
const target = veh.find(v => v.brand === '기아' && v.model === '카니발' && v.price === 45260000);
console.log('vehicle:', target.trim, `(${target.price.toLocaleString()}원)`);
console.log(`  r24=${target.r24} r36=${target.r36} r48=${target.r48} r60=${target.r60}  strategic=${target.strategic}`);
console.log(`  disp=${target.disp}  fuel=${target.fuel}  tax_exempt=${target.tax_exempt}  group=${target.group}  multi_seat=${target.multi_seat}`);
console.log(`조건: 탁송 99k 선팅 105k 보증10% 선납0% 약정2만 중신용 수수료5%`);
console.log();
const fmt = (n) => Math.round(n).toLocaleString();
for (const term of [60, 48, 36]) {
  const r = calcQuote({
    vehicle: {
      brand: target.brand, model: target.model, trim: target.trim,
      price: target.price, disp: target.disp, fuel: target.fuel,
      tax_exempt: target.tax_exempt, group: target.group, multi_seat: target.multi_seat,
      r24: target.r24, r36: target.r36, r48: target.r48, r60: target.r60,
      strategic: target.strategic, buyback_apply: target.buyback_apply,
    },
    options: { optPrice: 0, discount: 0, deliveryFee: 99000, itemsFee: 105000, etc: 0 },
    contract: { term, km: '2만km', dep: 10, pre: 0 },
    customer: { creditGrade: '중신용' },
    insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
                 injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
    fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
  });
  console.log(`[${term}mo] monthly=${fmt(r.monthly).padStart(10)}원  잔가율=${(r.residualPct*100).toFixed(1)}%  만기인수=${fmt(r.residualAmt)}`);
}
