// findVehicleMeta 버그 검증 — HEV 트림이 가솔린 잔가로 매칭됨
import { readFileSync } from 'node:fs';
const VEHICLES = JSON.parse(readFileSync(new URL('../public/data/vehicles.json', import.meta.url), 'utf-8'));

// quote.js 의 findVehicleMeta 그대로 복제
function findVehicleMeta(brand, model, trim_name, variant, trim_price_won) {
  if (!VEHICLES?.length) return {};
  if (trim_price_won) {
    const exact = VEHICLES.filter(v =>
      v.brand === brand && v.model === model && v.price === trim_price_won
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      const tokens = [...(variant || '').split(/[\s·,()/]+/), ...(trim_name || '').split(/[\s·,()/]+/)]
        .filter(t => t && t.length >= 1).map(t => t.toLowerCase());
      if (tokens.length) {
        const scored = exact.map(m => ({
          m, score: tokens.reduce((s, t) => s + ((m.trim || '').toLowerCase().includes(t) ? 1 : 0), 0),
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
  if (trim_name) {
    const variantTokens = (variant || '').split(/[\s·,()]+/).filter(t => t.length > 1);
    const matches = VEHICLES.filter(v =>
      v.brand === brand &&
      (v.model === model || (v.trim || '').includes(model)) &&
      (v.trim || '').includes(trim_name)
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1 && variantTokens.length) {
      const scored = matches.map(m => ({
        m, score: variantTokens.reduce((s, t) => s + ((m.trim || '').includes(t) ? 1 : 0), 0)
      }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score > 0) return scored[0].m;
    }
    if (matches.length) return matches[0];
  }
  return VEHICLES.find(v => v.brand === brand && v.model === model) || {};
}

// 시뮬레이션: vehicle-db.js 가 cascade 로 넘기는 값 (HEV 7인승 Exclusive 2WD)
console.log('=== 케이스 1: HEV 7인승 Exclusive 2WD (51,460,000) ===');
const r1 = findVehicleMeta('현대', '디 올 뉴 팰리세이드', '익스클루시브', '하이브리드 2.5 터보 7인승', 51460000);
console.log(`매칭된 trim: ${r1.trim}`);
console.log(`매칭된 model: ${r1.model}`);
console.log(`매칭된 price: ${r1.price}`);
console.log(`잔가율: r24=${r1.r24} r36=${r1.r36} r48=${r1.r48} r60=${r1.r60}`);
console.log(`예상: r36=0.57 (HEV 정확) / 실제 가져온 값과 비교 →`, r1.r36 === 0.57 ? '✅ 정확' : `❌ 버그! (가솔린 ${r1.r36})`);
console.log();

console.log('=== 케이스 2: HEV 9인승 Calligraphy 4WD (64,140,000) ===');
const r2 = findVehicleMeta('현대', '디 올 뉴 팰리세이드', '캘리그래피', '하이브리드 2.5 터보 9인승', 64140000);
console.log(`매칭된 trim: ${r2.trim}`);
console.log(`매칭된 model: ${r2.model}`);
console.log(`매칭된 price: ${r2.price}`);
console.log(`잔가율: r24=${r2.r24} r36=${r2.r36} r48=${r2.r48} r60=${r2.r60}`);
console.log(`예상: r36=0.57 (HEV) → 실제 r36 ${r2.r36 === 0.57 ? '✅' : '❌'}`);
console.log();

console.log('=== 케이스 3: 가솔린 7인승 Exclusive 2WD (45,160,000) — 대조군 ===');
const r3 = findVehicleMeta('현대', '디 올 뉴 팰리세이드', '익스클루시브', '가솔린 2.5 터보 7인승', 45160000);
console.log(`매칭된 trim: ${r3.trim}`);
console.log(`매칭된 model: ${r3.model}`);
console.log(`잔가율: r36=${r3.r36}`);
console.log(`예상: r36=0.55 (가솔린) → 실제 ${r3.r36 === 0.55 ? '✅' : '❌'}`);
