// vehicle-db.js 전체 정합성 검증
// 1. available_options 의 옵션 ID 가 options_master 에 정의돼 있나
// 2. exclusive_groups.members 의 옵션 ID 가 options_master 에 있나
// 3. requires_in_trim 의 키가 trims 의 trim_id 와 일치하나
// 4. requires_in_trim 의 값 옵션 ID 가 options_master 에 있나
// 5. requires 의 옵션 ID 가 options_master 에 있나
// 6. 의심 패턴 — 옵션 매트릭스 출력 (트림×옵션) + 트림별 누락 옵션 highlight
global.window = {};
require('../public/vehicle-db.js');
const db = global.window.VEHICLE_DB;

const errors = [];
const warnings = [];
const matrices = [];

function err(model, msg) { errors.push(`[${model}] ${msg}`); }
function warn(model, msg) { warnings.push(`[${model}] ${msg}`); }

for (const maker of (db.manufacturers || [])) {
  const brand = maker.manufacturer_id;
  for (const model of (maker.models || [])) {
    if (!model || !model.model_id) continue;
      const ctx = `${brand}/${model.model_id}`;
      const variants = model.variants || [];
      for (const v of variants) {
        const vctx = `${ctx}/${v.variant_id}`;
        const optMaster = v.options_master || {};
        const masterKeys = new Set(Object.keys(optMaster));
        const trims = v.trims || [];
        const trimIds = new Set(trims.map(t => t.trim_id));

        // 1. exclusive_groups members
        for (const g of (v.exclusive_groups || [])) {
          for (const m of (g.members || [])) {
            if (!masterKeys.has(m)) {
              err(vctx, `exclusive_groups[${g.id}].members 에 정의 안 된 옵션: '${m}'`);
            }
          }
        }

        // 2. options_master 의 requires / requires_in_trim
        for (const [optId, opt] of Object.entries(optMaster)) {
          for (const r of (opt.requires || [])) {
            if (!masterKeys.has(r)) {
              err(vctx, `${optId}.requires 에 정의 안 된 옵션: '${r}'`);
            }
          }
          for (const [trimId, reqs] of Object.entries(opt.requires_in_trim || {})) {
            if (!trimIds.has(trimId)) {
              err(vctx, `${optId}.requires_in_trim 의 trim_id '${trimId}' 가 trims 에 없음 (실제: ${[...trimIds].join(',')})`);
            }
            for (const r of reqs) {
              if (!masterKeys.has(r)) {
                err(vctx, `${optId}.requires_in_trim[${trimId}] 에 정의 안 된 옵션: '${r}'`);
              }
            }
          }
        }

        // 3. trims 의 available_options
        for (const t of trims) {
          for (const optId of (t.available_options || [])) {
            if (!masterKeys.has(optId)) {
              err(`${vctx}/${t.trim_id}`, `available_options 에 정의 안 된 옵션: '${optId}'`);
            }
          }
        }

        // 4. 매트릭스 — 트림 × 옵션
        if (trims.length && masterKeys.size) {
          const allOpts = [...masterKeys];
          const matrix = {
            title: `${ctx} / ${v.variant_id}`,
            opts: allOpts.map(o => ({ id: o, name: optMaster[o].name, price: optMaster[o].price })),
            rows: trims.map(t => ({
              trim_id: t.trim_id,
              trim_name: t.name,
              available: new Set(t.available_options || []),
            })),
          };
          matrices.push(matrix);

          // 의심 패턴: 옵션이 어떤 트림에는 있는데 일부에서만 빠짐 (트림 위계상 위에는 있는데 아래엔 없거나)
          for (const optId of allOpts) {
            const inTrims = trims.map(t => (t.available_options || []).includes(optId));
            const presentCount = inTrims.filter(Boolean).length;
            // 1, 2, ... 일부 트림에만 있는 옵션 — 의심 (의도된 차별일 수도, 데이터 오류일 수도)
            if (presentCount > 0 && presentCount < trims.length) {
              const present = trims.filter((_, i) => inTrims[i]).map(t => t.trim_id);
              const absent = trims.filter((_, i) => !inTrims[i]).map(t => t.trim_id);
              warn(`${vctx}/${optId}(${optMaster[optId].name})`, `present: [${present.join(',')}], absent: [${absent.join(',')}]`);
            }
          }
        }
      }
  }
}

console.log('=== 구조 오류 ===');
if (!errors.length) console.log('(없음)');
else errors.forEach(e => console.log('  ' + e));

console.log('\n=== 핵심 옵션 트림 매트릭스 (셀토스 선루프 누락 케이스 검증) ===');
console.log('(인기 옵션은 거의 모든 트림에 있어야 정상)');
// 옵션 이름 기준 — 차종별 옵션 ID 다르므로
const HOT_KEYWORDS = ['선루프', '썬루프', '파노라마', '통풍시트', '스마트센스', '드라이브 와이즈', '빌트인캠', '빌트인 캠', '하이패스', '내비'];
const hotWarnings = warnings.filter(w => HOT_KEYWORDS.some(kw => w.includes(kw)));
console.log(`핵심 옵션 의심: ${hotWarnings.length}건 (전체 ${warnings.length}건 중)`);
console.log('');
// 선루프류만 별도 출력
const sunroofWarnings = warnings.filter(w => /선루프|썬루프|파노라마/.test(w));
console.log(`--- 선루프 관련 (${sunroofWarnings.length}건) ---`);
sunroofWarnings.forEach(w => console.log('  ' + w));
console.log('');
const navwarn = warnings.filter(w => /내비|navi/i.test(w));
console.log(`--- 내비 관련 (${navwarn.length}건) ---`);
navwarn.slice(0, 30).forEach(w => console.log('  ' + w));
if (navwarn.length > 30) console.log(`  ... 외 ${navwarn.length - 30}건`);
console.log('');
const safetywarn = warnings.filter(w => /스마트센스|드라이브 와이즈|drive_wise/i.test(w));
console.log(`--- 안전 사양 (스마트센스/드라이브와이즈) (${safetywarn.length}건) ---`);
safetywarn.slice(0, 30).forEach(w => console.log('  ' + w));
if (safetywarn.length > 30) console.log(`  ... 외 ${safetywarn.length - 30}건`);
