// 수정된 findVehicleMeta 검증 — quote.js 에서 그대로 복사
import { readFileSync } from 'node:fs';
const VEHICLES = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));

function findVehicleMeta(brand, model, trim_name, variant, trim_price_won) {
  if (!VEHICLES?.length) return {};
  const isHEV = /하이브리드|HEV/i.test(variant || '');
  const modelCandidates = isHEV ? [`${model} Hybrid`, model] : [model];

  if (trim_price_won) {
    for (const m of modelCandidates) {
      const exact = VEHICLES.filter(v =>
        v.brand === brand && v.model === m && v.price === trim_price_won
      );
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) {
        const tokens = [...(variant || '').split(/[\s·,()/]+/), ...(trim_name || '').split(/[\s·,()/]+/)]
          .filter(t => t && t.length >= 1).map(t => t.toLowerCase());
        if (tokens.length) {
          const scored = exact.map(mm => ({
            m: mm, score: tokens.reduce((s, t) => s + ((mm.trim || '').toLowerCase().includes(t) ? 1 : 0), 0),
          }));
          scored.sort((a, b) => b.score - a.score);
          if (scored[0].score > 0 && scored[0].score > (scored[1]?.score ?? 0)) return scored[0].m;
          if (trim_name) {
            const tn = exact.find(v => (v.trim || '').includes(trim_name));
            if (tn) return tn;
          }
        }
        return exact[0];
      }
    }
  }
  if (trim_name) {
    const variantTokens = (variant || '').split(/[\s·,()]+/).filter(t => t.length > 1);
    for (const m of modelCandidates) {
      const matches = VEHICLES.filter(v =>
        v.brand === brand &&
        (v.model === m || (v.trim || '').includes(m)) &&
        (v.trim || '').includes(trim_name)
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1 && variantTokens.length) {
        const scored = matches.map(mm => ({
          m: mm, score: variantTokens.reduce((s, t) => s + ((mm.trim || '').includes(t) ? 1 : 0), 0)
        }));
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].m;
      }
      if (matches.length) return matches[0];
    }
  }
  for (const m of modelCandidates) {
    const f = VEHICLES.find(v => v.brand === brand && v.model === m);
    if (f) return f;
  }
  return {};
}

const cases = [
  // [label, brand, model, trim_name, variant, price, expected_r36, expected_model]
  ['HEV 7인승 Exclusive 2WD', '현대', '디 올 뉴 팰리세이드', '익스클루시브', '하이브리드 2.5 터보 7인승', 51460000, 0.57, '디 올 뉴 팰리세이드 Hybrid'],
  ['HEV 9인승 Calligraphy 4WD', '현대', '디 올 뉴 팰리세이드', '캘리그래피', '하이브리드 2.5 터보 9인승', 64140000, 0.57, '디 올 뉴 팰리세이드 Hybrid'],
  ['HEV 7인승 Prestige 2WD', '현대', '디 올 뉴 팰리세이드', '프레스티지', '하이브리드 2.5 터보 7인승', 57290000, 0.57, '디 올 뉴 팰리세이드 Hybrid'],
  ['가솔린 7인승 Exclusive 2WD (대조군)', '현대', '디 올 뉴 팰리세이드', '익스클루시브', '가솔린 2.5 터보 7인승', 45160000, 0.55, '디 올 뉴 팰리세이드'],
  ['그랜저 HEV 캘리그래피', '현대', '더 뉴 그랜저', '캘리그래피', '하이브리드 1.6 터보', null, 0.55, '더 뉴 그랜저 Hybrid'],
];

let pass = 0, fail = 0;
for (const [label, brand, model, tn, variant, price, expR36, expModel] of cases) {
  const r = findVehicleMeta(brand, model, tn, variant, price);
  const ok = r.r36 === expR36 && r.model === expModel;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  console.log(`   매칭 model: ${r.model} (예상 ${expModel})`);
  console.log(`   r36: ${r.r36} (예상 ${expR36})`);
}
console.log(`\n총 ${pass}/${pass+fail} 통과`);
