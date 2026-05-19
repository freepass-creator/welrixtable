// 제네시스 G80 2.5T 2WD 기본 — 60mo 중신용 보증 10% (또는 사용자가 테스트한 조건)
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));

const SAMPLES = [
  { price: 45060000, label: 'G70 2.5T 2WD 기본' },
  { price: 60700000, label: 'G80 2.5T 2WD 기본' },
  { price: 97600000, label: 'G90 3.5T 2WD 5인승' },
];

for (const s of SAMPLES) {
  const t = veh.find(x => x.brand === '제네시스' && x.price === s.price);
  if (!t) { console.log(`❌ 못 찾음: ${s.label}`); continue; }
  console.log(`━━━━━━ ${s.label} (${t.trim}) ━━━━━━`);
  console.log(`r60=${t.r60} strategic=${t.strategic} fuel=${t.fuel} disp=${t.disp} group=${t.group} multi=${t.multi_seat}`);
  for (const term of [60, 48, 36]) {
    const r = calcQuote({
      vehicle: { brand: t.brand, model: t.model, trim: t.trim, price: t.price,
                 disp: t.disp, fuel: t.fuel, tax_exempt: t.tax_exempt, group: t.group,
                 multi_seat: t.multi_seat,
                 r24: t.r24, r36: t.r36, r48: t.r48, r60: t.r60,
                 strategic: t.strategic, buyback_apply: t.buyback_apply },
      options: { optPrice: 0, discount: 0, deliveryFee: 99000, itemsFee: 105000, etc: 0 },
      contract: { term, km: '2만km', dep: 10, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
                   injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    console.log(`  [${term}mo] monthly=${Math.round(r.monthly).toLocaleString()}원  잔가율=${(r.residualPct*100).toFixed(1)}% (I4=${(r._debug.I4*100).toFixed(1)} I5=${(r._debug.I5*100).toFixed(1)} I6=${(r._debug.I6*100).toFixed(1)})  I22=${(r._debug.I22*100).toFixed(1)}%`);
  }
  console.log();
}
