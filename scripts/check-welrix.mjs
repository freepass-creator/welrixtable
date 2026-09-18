// ============================================================================
//  웰릭스와 «0원» 같은지 검사   —   node scripts/check-welrix.mjs
// ----------------------------------------------------------------------------
//  ★대표 2026-09-18 「똑같은 조건을 놓고 똑같으면 완벽하게 맞아야 돼. 몇천 원 차이가 나면 안 돼」
//
//  아래 기대값은 **웰릭스 견적기 «화면»을 새로 열었을 때** 나온 값이다(2026-09-17 실측).
//  우리 기본값이 그쪽 기본값과 같다면 이 숫자가 그대로 나와야 한다.
//
//  ★무엇을 잡아내나
//    · 우리 기본값이 웰릭스와 어긋남 (탁송·썬팅·블박·보증금·외장색 …)
//    · 웰릭스가 가격·정책을 바꿈 (그러면 «전부» 틀어진다 — 다시 실측하고 이 표를 고친다)
//    · 계산 서버가 죽거나 몸통 규격이 바뀜
//
//  ⚠ deposit_pct·prepay_pct·feeRate 는 «비율»이다 (10% = 0.1 · 5% = 0.05).
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 뿌리 = resolve(여기, '..');

/* 우리 기본값을 «코드에서» 읽는다 — 손으로 적으면 어긋나도 모른다 */
const rates = await import('../src/lib/welrix-rates.js');
const 기본 = rates.웰릭스기본;

const API = process.env.WELRIX_API || 'https://welrixmobility.netlify.app/api/estimate';

/* 웰릭스 견적기 화면 기본값 실측 (2026-09-17) — 수수료 5% 기준 */
const 실측 = [
  { model: '캐스퍼 1.0 가솔린 스마트',                 기대: [398000, 427000, 487000] },
  { model: '디 올 뉴 아반떼 2.0 가솔린 Modern',        기대: [530000, 563000, 633000] },
  { model: '쏘나타 디 엣지 1.6 터보 가솔린 Premium',    기대: [648000, 697000, 796000] },
  { model: '더 뉴 투싼 1.6 가솔린 터보 2WD Modern',    기대: [623000, 667000, 759000] },
  { model: '더 뉴 그랜저 2.5 가솔린 2WD Premium',      기대: [846000, 901000, 1018000] },
  { model: 'G70 2.5 가솔린 터보 2WD 기본 모델',        기대: [1076000, 1193000, 1422000] },
];

/* 우리 화면이 보내는 것과 «똑같은» 몸통을 만든다 */
function 몸통(model) {
  return {
    model, old: false, manualPrice: 0,
    inputs: 기본.terms.map((t) => ({
      credit: 기본.credit,
      termMonths: t,
      mileage: 기본.km + '만km',
      optionPrice: 0,                       // 옵션 없음 · 외장색은 «추가금 없는» 색이 기본
      stockDiscount: 0,
      deliveryFee: rates.탁송[기본.deliveryRegion],
      tintFee: rates.썬팅값(기본.tint),
      dashcamFee: rates.블박값(기본.blackbox),
      deposit_pct: 기본.dep / 100,
      prepay_pct: 기본.pre / 100,
      liability: 기본.insProperty,
      extraDriver: 기본.extraDriver,
      maintenance: 기본.svc,
      feeRate: 5 / 100,                     // ★실측이 5% 기준이다 (운영 기본은 welrix-rates 를 따른다)
    })),
  };
}

/* 차량 DB 에 그 트림이 실제로 있는지도 같이 본다 */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(resolve(뿌리, 'public/welrix-db.js'), 'utf-8'), ctx);
const 트림들 = new Set(
  (ctx.window.VEHICLE_DB?.manufacturers || []).flatMap((m) => m.models)
    .flatMap((m) => m.variants).flatMap((v) => v.trims).map((t) => t.trim_id));

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', X = '\x1b[0m';
const 원 = (n) => (n == null ? '—' : n.toLocaleString()).padStart(11);

console.log('우리 기본값:', JSON.stringify({
  신용: 기본.credit, 보증금: 기본.dep + '%', 선납: 기본.pre + '%', 약정: 기본.km + '만km',
  정비: 기본.svc, 대물: 기본.insProperty, 추가운전자: 기본.extraDriver,
  탁송: `${기본.deliveryRegion} ${rates.탁송[기본.deliveryRegion].toLocaleString()}`,
  썬팅: `${기본.tint} ${rates.썬팅값(기본.tint).toLocaleString()}`,
  블박: `${기본.blackbox} ${rates.블박값(기본.blackbox).toLocaleString()}`,
  운영수수료: 기본.feeRatePct + '%',
}, null, 0));
console.log(`검사는 실측과 같은 «수수료 5%» 로 돈다.\n`);

let 탈락 = 0;
for (const c of 실측) {
  if (!트림들.has(c.model)) {
    console.log(`${R}✘${X} ${c.model}\n   차량 DB(welrix-db.js) 에 이 트림이 없다 — 어댑터를 다시 만들어야 한다`);
    탈락++; continue;
  }
  let 나온값 = null, 오류 = '';
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(몸통(c.model)) });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok && Array.isArray(j.results)) 나온값 = j.results.map((x) => x.monthlyRent);
    else 오류 = j?.error || `응답 ${r.status}`;
  } catch (e) { 오류 = String(e?.message || e); }

  if (!나온값) { console.log(`${R}✘${X} ${c.model} — ${오류}`); 탈락++; continue; }
  const 차 = 나온값.map((m, i) => m - c.기대[i]);
  const 맞 = 차.every((d) => d === 0);
  if (!맞) 탈락++;
  console.log(`${맞 ? G + '✔' + X : R + '✘' + X} ${c.model}`);
  console.log(`   나온값${나온값.map(원).join('')}`);
  if (!맞) console.log(`   기대값${c.기대.map(원).join('')}   차이 ${차.join(' / ')}`);
  await new Promise((s) => setTimeout(s, 200));      // 남의 서버다 — 천천히
}

console.log(`\n${탈락 ? R : G}${실측.length - 탈락}/${실측.length} 차종이 «0원» 으로 같다${X}`);
if (탈락) {
  console.log(`\n${Y}★어긋났다면 둘 중 하나다${X}`);
  console.log('  ① 우리 기본값이 웰릭스와 달라졌다 → src/lib/welrix-rates.js 를 본다');
  console.log('  ② 웰릭스가 가격·정책을 바꿨다 → 견적기 화면에서 다시 실측하고 이 표를 고친다');
  process.exitCode = 1;
}
