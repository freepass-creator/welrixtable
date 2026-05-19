// 단일 견적 케이스 calc.js 결과 출력 — Excel 결과와 비교용
// 사용:
//   node _audit/compare_one.mjs "현대" "쏘나타" 30690000 60 "중신용" 10 0
//   (brand model price term credit dep% pre%)
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);

const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));
const [, , brand, model, priceStr, termStr, credit, depStr, preStr] = process.argv;
const price = +priceStr;
const term = +termStr;
const dep = +depStr;
const pre = +preStr;

const v = veh.find(x => x.brand === brand && x.model === model && x.price === price);
if (!v) {
  console.error(`❌ 차량 못 찾음: ${brand} ${model} ${price}`);
  process.exit(1);
}
console.log(`vehicle: ${v.trim} (${v.price.toLocaleString()}원)`);
console.log(`  r24=${v.r24} r36=${v.r36} r48=${v.r48} r60=${v.r60}  strategic=${v.strategic} buyback_apply=${v.buyback_apply}`);
console.log(`  disp=${v.disp} fuel=${v.fuel} tax_exempt=${v.tax_exempt} group=${v.group}`);
console.log(`condition: ${term}개월 / ${credit} / 보증금 ${dep}% / 선납 ${pre}%`);
console.log();

const r = calcQuote({
  vehicle: {
    brand: v.brand, model: v.model, trim: v.trim,
    price: v.price, disp: v.disp, fuel: v.fuel,
    tax_exempt: v.tax_exempt, group: v.group, multi_seat: v.multi_seat,
    r24: v.r24, r36: v.r36, r48: v.r48, r60: v.r60,
    strategic: v.strategic, buyback_apply: v.buyback_apply,
  },
  options:   { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
  contract:  { term, km: '2만km', dep, pre },
  customer:  { creditGrade: credit },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
               injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  fees:      { feeRatePct: 5.0, svc: '웰스 Basic' },
});

console.log(`📊 calc.js 결과`);
console.log(`  월 대여료: ${Math.round(r.monthly).toLocaleString()}원`);
console.log(`  잔가율   : ${(r.residualPct*100).toFixed(2)}% (I4=${(r._debug.I4*100).toFixed(1)}% + I5=${(r._debug.I5*100).toFixed(1)}% + I6=${(r._debug.I6*100).toFixed(1)}%)`);
console.log(`  만기인수 : ${Math.round(r.residualAmt).toLocaleString()}원`);
console.log(`  보증금   : ${Math.round(r.depositAmt).toLocaleString()}원`);
console.log(`  선납금   : ${Math.round(r.prePayAmt).toLocaleString()}원`);
console.log();
console.log(`내부 추적 (Excel 비교용)`);
const dbg = r._debug;
console.log(`  F22 (취득원가 부가세제외) : ${Math.round(dbg.F22).toLocaleString()}`);
console.log(`  F23 (가산원가 합)          : ${Math.round(dbg.F23).toLocaleString()}`);
console.log(`  F25 (PMT)                   : ${Math.round(dbg.F25).toLocaleString()}`);
console.log(`  F26 (가산/월)              : ${Math.round(dbg.F26).toLocaleString()}`);
console.log(`  F27 (산출대여료)            : ${Math.round(dbg.F27).toLocaleString()}`);
console.log(`  H27 (신용가산 후)           : ${Math.round(dbg.H27).toLocaleString()}  (I21=${(dbg.I21*100).toFixed(1)}%)`);
console.log(`  H33                         : ${Math.round(dbg.H33).toLocaleString()}`);
console.log(`  I22 (기간가산)              : ${(dbg.I22*100).toFixed(1)}%`);
console.log(`  H34 (최종)                  : ${Math.round(dbg.H34).toLocaleString()}`);
