// 3대 표본 × 3시나리오 — Excel ↔ calc.js 비교 베이스라인
// 공통 조건: 탁송 서울 99,000 / 선팅 루마GG 105,000 / 보증금 10% / 수수료 5% / 약정 2만 / 중신용
import { calcQuote, setCompanyConfig } from '../src/lib/calc.js';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../public/data/company-config/welrix.json', import.meta.url), 'utf-8'));
setCompanyConfig(cfg);
const veh = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));

// 표본 3대 — 패턴별 (일반/전략/제네시스)
const SAMPLES = [
  { brand: '현대', model: '쏘나타', price: 30690000, label: '쏘나타 1.6T 가솔린 S (일반 가솔린)' },
  { brand: '현대', model: '아반떼', price: 20650000, label: '아반떼 1.6 가솔린 Smart (전략차종)' },
  { brand: '제네시스', model: 'G80', price: 60700000, label: 'G80 2.5T 2WD 기본 (제네시스 -20%)' },
];

const COMMON = {
  options: {
    optPrice: 0, discount: 0,
    deliveryFee: 99000,    // 탁송 서울
    itemsFee: 105000,      // 선팅 루마GG 쿠폰
    etc: 0,
  },
  customer:  { creditGrade: '중신용' },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
               injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
};

const fmtKrw = (n) => Math.round(n).toLocaleString();

for (const sample of SAMPLES) {
  const v = veh.find(x => x.brand === sample.brand && x.model === sample.model && x.price === sample.price);
  if (!v) {
    console.error(`❌ 차량 못 찾음: ${sample.brand} ${sample.model} ${sample.price.toLocaleString()}`);
    continue;
  }
  console.log('═'.repeat(80));
  console.log(`📌 ${sample.label}`);
  console.log(`   trim: ${v.trim}`);
  console.log(`   가격: ${fmtKrw(v.price)}원 + 탁송 99,000 + 선팅 105,000 = ${fmtKrw(v.price + 99000 + 105000)}원`);
  console.log(`   r24=${v.r24}  r36=${v.r36}  r48=${v.r48}  r60=${v.r60}  strategic=${v.strategic}  buyback_apply=${v.buyback_apply}`);
  console.log(`   disp=${v.disp}  fuel=${v.fuel}  tax_exempt=${v.tax_exempt}  group=${v.group}`);
  console.log('─'.repeat(80));

  const vehicle = {
    brand: v.brand, model: v.model, trim: v.trim,
    price: v.price,  // 차량가만 (탁송/선팅은 options 로 전달 — 프로덕션 quote.js 와 동일)
    disp: v.disp, fuel: v.fuel,
    tax_exempt: v.tax_exempt, group: v.group, multi_seat: v.multi_seat,
    r24: v.r24, r36: v.r36, r48: v.r48, r60: v.r60,
    strategic: v.strategic, buyback_apply: v.buyback_apply,
  };

  console.log(`기간       | 월대여료      | 잔가율  | 만기인수      | 보증금       | 선납금`);
  for (const term of [60, 48, 36]) {
    const r = calcQuote({
      vehicle,
      ...COMMON,
      contract: { term, km: '2만km', dep: 10, pre: 0 },
    });
    console.log(`${term}개월    | ${fmtKrw(r.monthly).padStart(11)}원 | ${(r.residualPct*100).toFixed(1).padStart(5)}% | ${fmtKrw(r.residualAmt).padStart(11)}원 | ${fmtKrw(r.depositAmt).padStart(10)}원 | ${fmtKrw(r.prePayAmt).padStart(7)}원`);
  }
  console.log();
}

console.log('═'.repeat(80));
console.log('✅ 공통 조건');
console.log('   탁송: 서울 99,000  |  선팅: 루마GG 105,000  |  보증금: 10%  |  선납: 0%');
console.log('   수수료율: 5%  |  약정주행: 2만km/년  |  신용: 중신용  |  대물: 1억');
