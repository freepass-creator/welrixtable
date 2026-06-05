// v5.5 엑셀 매핑: 블박 175,000 + 썬팅 105,000 기본 포함
// itemsFee = (175000 + 105000) / 1.1 = 254,545
// 또는 itemsFee 그냥 175000+105000 = 280,000 (VAT 포함값)?
import { calcQuote } from '../src/lib/calc.js';

const vehicle = {
  brand: '기아', model: '셀토스', name: '셀토스',
  trim: '셀토스 1.6 하이브리드 2WD 프레스티지', price: 33590000,
  disp: 1998, fuel: '가솔린', tax_exempt: '과세', group: 'V군', multi_seat: null,
  r24: 0.7, r36: 0.61, r48: 0.54, r60: 0.46, strategic: 0.08, buyback_apply: 0,
};

const cases = [
  { name: 'A: 우리 default (블박/썬팅 0)',          itemsFee: 0,               dep: 10 },
  { name: 'B: 블박+썬팅 280,000 (VAT포함값)',       itemsFee: 280000,          dep: 10 },
  { name: 'C: 블박+썬팅 254,545 (공급가)',          itemsFee: 254545,          dep: 10 },
  { name: 'D: 보증금 0 + 블박/썬팅 0',              itemsFee: 0,               dep: 0 },
  { name: 'E: 보증금 0 + 블박+썬팅 280,000',        itemsFee: 280000,          dep: 0 },
];

for (const c of cases) {
  const r = calcQuote({
    vehicle,
    options: { optPrice: 1090000, discount: 0, deliveryFee: 0, itemsFee: c.itemsFee, etc: 0 },
    contract: { term: 60, km: '2만km', dep: c.dep, pre: 0 },
    customer: { creditGrade: '중신용' },
    insurance: {
      property: '1억', extraDriver: '없음',
      exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
      deductible: '30만원~', emergency: '가입',
    },
    fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
  });
  console.log(`${c.name.padEnd(40)} 월: ${r.monthly?.toLocaleString().padStart(10)} | 잔가율: ${r.residualPct.toFixed(3)} | C14: ${r._debug?.C14?.toLocaleString() ?? '-'}`);
}
