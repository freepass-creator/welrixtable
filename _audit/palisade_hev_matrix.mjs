// 디 올 뉴 팰리세이드 Hybrid — 잔가율/만기인수금액 전체 매트릭스
// 엑셀(견적1~3)의 잔가 공식을 calc.js 와 비교
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));

const hevs = veh.filter(v => v.model === '디 올 뉴 팰리세이드 Hybrid');
console.log(`HEV 트림 ${hevs.length}개`);
console.log();

const terms = [24, 36, 48, 60];
const credits = ['고신용', '중신용', '저신용'];

const sample = hevs[0]; // 7인승 Exclusive 2WD (51,460,000원)
console.log(`샘플 차종: ${sample.trim}`);
console.log(`가격: ${sample.price.toLocaleString()}원`);
console.log(`base r24/36/48/60 = ${sample.r24}/${sample.r36}/${sample.r48}/${sample.r60}`);
console.log();

console.log('잔가율 매트릭스 (term × credit, 2만km):');
console.log('              24개월     36개월     48개월     60개월');
for (const cr of credits) {
  const cells = terms.map(t => {
    const r = calcQuote({
      vehicle: { brand: sample.brand, model: sample.model, trim: sample.trim,
                 price: sample.price, disp: sample.disp, fuel: sample.fuel,
                 tax_exempt: sample.tax_exempt, group: sample.group, multi_seat: sample.multi_seat,
                 r24: sample.r24, r36: sample.r36, r48: sample.r48, r60: sample.r60,
                 strategic: sample.strategic, buyback_apply: sample.buyback_apply },
      options:  { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0 },
      contract: { term: t, km: '2만km', dep: 10, pre: 0 },
      customer: { creditGrade: cr },
      insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
                   injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    const pct = (r.residualPct * 100).toFixed(1).padStart(5);
    return `${pct}%`;
  });
  console.log(`  ${cr.padEnd(5)}    ${cells.join('   ')}`);
}
console.log();

console.log('만기인수금액 매트릭스:');
console.log('              24개월        36개월        48개월        60개월');
for (const cr of credits) {
  const cells = terms.map(t => {
    const r = calcQuote({
      vehicle: { brand: sample.brand, model: sample.model, trim: sample.trim,
                 price: sample.price, disp: sample.disp, fuel: sample.fuel,
                 tax_exempt: sample.tax_exempt, group: sample.group, multi_seat: sample.multi_seat,
                 r24: sample.r24, r36: sample.r36, r48: sample.r48, r60: sample.r60,
                 strategic: sample.strategic, buyback_apply: sample.buyback_apply },
      options:  { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0 },
      contract: { term: t, km: '2만km', dep: 10, pre: 0 },
      customer: { creditGrade: cr },
      insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
                   injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return Math.round(r.residualAmt).toLocaleString().padStart(11);
  });
  console.log(`  ${cr.padEnd(5)}    ${cells.join('   ')}`);
}
console.log();

// 엑셀 공식 분해
console.log('엑셀 공식 분해 (중신용 기준):');
console.log('  잔가율 = r[term] + km_adj + I5(매각잔가가산 4%) + I6(인수가율가산 2%)');
console.log('  만기인수금액 = 소비자가 × 잔가율');
console.log();
console.log('  예: 36개월 = 0.57 + 0 + 0.04 + 0.02 = 0.63 (63%)');
console.log('  예: 60개월 = 0.42 + 0 + 0.04 + 0.02 = 0.48 (48%)');
