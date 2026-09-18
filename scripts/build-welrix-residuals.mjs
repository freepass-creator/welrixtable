// ============================================================================
//  웰릭스 model 키로 짝지은 잔가표   —   node scripts/build-welrix-residuals.mjs
// ----------------------------------------------------------------------------
//  erp4(신차·중고 견적기) 세션 요청 2026-09-18.
//  우리 vehicles.json(엑셀 v6.1 동기본)의 r24/36/48/60·group·buyback_apply·strategic 을
//  웰릭스 model 문자열에 짝지어 내보낸다.
//
//  ★welrix-db.js 에는 싣지 않는다. 웰릭스 견적기는 계산을 API 가 하므로 필요가 없고,
//    실으면 «웰릭스 값»처럼 보이는 우리 값이 섞인다. 이 파일은 «우리 표»다.
//  ★짝을 못 지은 웰릭스 model 은 값 없이 null 로 둔다 — 형제 트림 값으로 채우지 않는다.
//  ★한 웰릭스 model 에 값이 «다른» 우리 줄이 둘 이상 붙으면 모호로 보고 null 로 둔다.
//  ⚠ vehicles.json 의 price 는 옛 가격(웰릭스 priceOld)이라 내보내지 않는다.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 웰차 = JSON.parse(readFileSync(resolve(뿌리, '_audit/welrix-netlify-20260917/vehicles-508.json'), 'utf8'));
const 우리차 = JSON.parse(readFileSync(resolve(뿌리, 'src/data/vehicles.json'), 'utf8'));

const 정 = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const 칸 = ['r24', 'r36', 'r48', 'r60', 'group', 'buyback_apply', 'strategic'];

/* 우리 줄 → 웰릭스 model (이름 맞추기) */
const 웰맵 = new Map(웰차.map((w) => [정(w.model), w.model]));
const 붙은것 = new Map();                       // 웰릭스 model → [우리 줄…]
for (const u of 우리차) {
  for (const c of [`${u.model} ${u.trim}`, `${u.name} ${u.trim}`, u.trim]) {
    const m = 웰맵.get(정(c));
    if (m) { (붙은것.get(m) || 붙은것.set(m, []).get(m)).push(u); break; }
  }
}

const 표 = {};
const 모호 = [];
for (const w of 웰차) {
  const 줄들 = 붙은것.get(w.model) || [];
  if (!줄들.length) { 표[w.model] = null; continue; }
  /* ★소수점 찌꺼기(0.6799999999999999 ↔ 0.68)는 같은 값이다 — vehicles.json 에 같은 차가
     두 줄씩 든 곳(그랜저 3.5)에서 한쪽만 찌꺼기가 있어 «모호»로 잘못 잡혔다. 6자리로 다듬는다. */
  const 다듬 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v ?? null);
  const 값들 = 줄들.map((u) => Object.fromEntries(칸.map((k) => [k, 다듬(u[k])])));
  const 같다 = 값들.every((v) => JSON.stringify(v) === JSON.stringify(값들[0]));
  if (!같다) { 표[w.model] = null; 모호.push(w.model); continue; }
  표[w.model] = { ...값들[0], 우리이름: `${줄들[0].model} ${줄들[0].trim}` };
}

/* ★검산 표시 — scripts/check-welrix-residuals.mjs 가 _audit/ 에 떨군 가장 새 결과를 읽는다.
   값은 «고치지 않는다». 다르면 웰릭스와다름 에 두 값을 나란히 적어 두고, 쓰는 쪽이 판단한다
   (erp4 는 그 차를 빼고 쓴다 — 2026-09-18 합의). */
const 검산파일 = readdirSync(resolve(뿌리, '_audit')).filter((f) => /^welrix-residual-check-\d{8}\.json$/.test(f)).sort().pop();
const 검산 = 검산파일 ? JSON.parse(readFileSync(resolve(뿌리, '_audit', 검산파일), 'utf8')) : null;
for (const [m, v] of Object.entries(표)) {
  if (!v) continue;
  const c = 검산?.차?.[m];
  v.검산 = c ? c.판정 : '안 잼';
  if (c?.판정 === '다름') v.웰릭스와다름 = c.다름;
}

const 짝 = Object.values(표).filter(Boolean).length;
const 우리짝 = [...붙은것.values()].reduce((a, v) => a + v.length, 0);
const 본문 = {
  _meta: {
    만든날: new Date().toISOString().slice(0, 10),
    출처: 'welrixtable src/data/vehicles.json (엑셀 v6.1 동기본) × _audit/welrix-netlify-20260917/vehicles-508.json',
    짝규칙: '공백 빼고 소문자로 「model trim」·「name trim」·「trim」 중 먼저 맞는 것',
    뜻: '«우리 표»다. 웰릭스 서버의 잔가가 아니다. null = 짝 없음 또는 모호 — 채우지 말 것',
    칸,
    웰릭스model수: 웰차.length,
    짝지은model수: 짝,
    짝없는model수: 웰차.length - 짝 - 모호.length,
    모호model: 모호,
    검산: 검산 ? {
      파일: `_audit/${검산파일}`, 조건: 검산._meta?.조건, 못잰것: 검산._meta?.못잰것,
      같음: Object.values(표).filter((v) => v?.검산 === '같음').length,
      다름: Object.values(표).filter((v) => v?.검산 === '다름').length,
      안잼: Object.values(표).filter((v) => v?.검산 === '안 잼').length,
      뜻: '다름 = 웰릭스 서버 인수가율에서 거꾸로 푼 r 이 이 표와 다르다. 값은 고치지 않았다 — 웰릭스와다름 에 둘 다 적었다',
    } : '검산 안 함',
    우리줄: { 전체: 우리차.length, 짝지어짐: 우리짝, 안짝: 우리차.length - 우리짝 },
  },
  잔가: 표,
};

const 나갈곳 = resolve(뿌리, 'public/data/welrix-residuals.json');
writeFileSync(나갈곳, JSON.stringify(본문, null, 1));
console.log(`만들었다 → ${나갈곳}`);
console.log(`  웰릭스 model ${웰차.length} 중 짝 ${짝} · 짝 없음 ${웰차.length - 짝 - 모호.length} · 모호 ${모호.length}`);
console.log(`  우리 줄 ${우리차.length} 중 짝지어짐 ${우리짝} · 안 짝 ${우리차.length - 우리짝}`);
if (모호.length) console.log('  모호:', 모호.join(' / '));
