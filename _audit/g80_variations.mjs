// G80 2.5T 2WD 기본 60mo 중신용 — 세팅 변화별 월대여료 시뮬레이션
// 7천원 차이의 원인 찾기
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));
const v = veh.find(x => x.brand === '제네시스' && x.model === 'G80' && x.price === 60700000);

const baseVehicle = {
  brand: v.brand, model: v.model, trim: v.trim,
  disp: v.disp, fuel: v.fuel,
  tax_exempt: v.tax_exempt, group: v.group, multi_seat: v.multi_seat,
  r24: v.r24, r36: v.r36, r48: v.r48, r60: v.r60,
  strategic: v.strategic, buyback_apply: v.buyback_apply,
};
const COMMON_INS = {
  property: '1억', extraDriver: '없음', exec: '미가입',
  injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입',
};

function run(opts) {
  const r = calcQuote({
    vehicle: { ...baseVehicle, price: 60700000 + (opts.deliveryFee || 0) + (opts.itemsFee || 0) },
    options: { optPrice: 0, discount: 0, deliveryFee: opts.deliveryFee || 0, itemsFee: opts.itemsFee || 0, etc: 0 },
    contract: { term: 60, km: opts.km || '2만km', dep: opts.dep ?? 10, pre: opts.pre ?? 0 },
    customer: { creditGrade: opts.credit || '중신용' },
    insurance: { property: opts.property || '1억', extraDriver: opts.extraDriver || '없음', exec: '미가입',
                 injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
    fees: { feeRatePct: opts.fee ?? 5.0, svc: opts.svc || '웰스 Basic' },
  });
  return Math.round(r.monthly);
}

const baseline = run({ deliveryFee: 99000, itemsFee: 105000 });
console.log(`baseline (탁송 99k + 선팅 105k + 보증 10% + 선납 0% + 약정 2만 + 수수료 5% + 중신용): ${baseline.toLocaleString()}원`);
console.log();
console.log('세팅 변경별 차이:');
const variations = [
  ['보증금 0%',    { deliveryFee: 99000, itemsFee: 105000, dep: 0 }],
  ['보증금 5%',    { deliveryFee: 99000, itemsFee: 105000, dep: 5 }],
  ['보증금 20%',   { deliveryFee: 99000, itemsFee: 105000, dep: 20 }],
  ['보증금 30%',   { deliveryFee: 99000, itemsFee: 105000, dep: 30 }],
  ['선납금 5%',    { deliveryFee: 99000, itemsFee: 105000, pre: 5 }],
  ['선납금 10%',   { deliveryFee: 99000, itemsFee: 105000, pre: 10 }],
  ['약정 3만km',   { deliveryFee: 99000, itemsFee: 105000, km: '3만km' }],
  ['약정 1만km',   { deliveryFee: 99000, itemsFee: 105000, km: '1만km' }],
  ['수수료 4%',    { deliveryFee: 99000, itemsFee: 105000, fee: 4 }],
  ['수수료 6%',    { deliveryFee: 99000, itemsFee: 105000, fee: 6 }],
  ['대물 2억',     { deliveryFee: 99000, itemsFee: 105000, property: '2억' }],
  ['대물 3억',     { deliveryFee: 99000, itemsFee: 105000, property: '3억' }],
  ['추가운전자 1명',{ deliveryFee: 99000, itemsFee: 105000, extraDriver: '1명' }],
  ['웰스 Self',    { deliveryFee: 99000, itemsFee: 105000, svc: '웰스 Self' }],
  ['신용',         { deliveryFee: 99000, itemsFee: 105000, credit: '신용' }],
  ['고신용',        { deliveryFee: 99000, itemsFee: 105000, credit: '고신용' }],
  ['저신용',        { deliveryFee: 99000, itemsFee: 105000, credit: '저신용' }],
  ['탁송 인천(40k)',{ deliveryFee: 40000, itemsFee: 105000 }],
  ['선팅 없음',     { deliveryFee: 99000, itemsFee: 0 }],
];
for (const [name, opts] of variations) {
  const v = run(opts);
  const diff = v - baseline;
  const sign = diff > 0 ? '+' : '';
  console.log(`  ${name.padEnd(16)} ${v.toLocaleString().padStart(11)}원  (${sign}${diff.toLocaleString()})`);
}
