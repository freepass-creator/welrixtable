// ============================================================================
//  잔가표 검산 — 웰릭스 서버의 인수가율과 견준다   —   node scripts/check-welrix-residuals.mjs
// ----------------------------------------------------------------------------
//  erp4 세션 요청 2026-09-18. welrix-residuals.json 의 짝 있는 차마다 웰릭스에
//  60/48/36개월(중신용·2만km·옵션 없음)을 한 번 묻고, acquirePrice/totalCarPrice(인수가율)를
//  calc.js 잔가 공식(I4+I5+I6)과 견준다.
//
//  웰릭스 인수가율 = r(기간) + 브랜드보정 + 주행보정(2만=0) + 매각가산 4% + 인수가 가산(중신용 2% + 제네시스 23% / K9·하이리무진 20%)
//  → 다르면 거꾸로 r 을 풀어 «웰릭스 쪽 r» 로 적는다.
//
//  ★표를 «고치지» 않는다. 결과를 _audit/ 에 떨구고, build-welrix-residuals.mjs 가 그걸 읽어
//    차마다 «웰릭스와 다름» 표시를 단다. (erp4 가 그 차만 빼고 쓴다)
//  ★24개월은 웰릭스가 받지 않는다(「허용되지 않은 값: termMonths」) — r24 는 검산 못 한다.
//  ★한 요청에 inputs 3개까지 — 그래서 차당 정확히 1요청이다.
// ============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const calc = await import('../src/lib/calc.js');
const rates = await import('../src/lib/welrix-rates.js');
const API = process.env.WELRIX_API || 'https://welrixmobility.netlify.app/api/estimate';

const 웰차 = JSON.parse(readFileSync(resolve(뿌리, '_audit/welrix-netlify-20260917/vehicles-508.json'), 'utf8'));
const 우리차 = JSON.parse(readFileSync(resolve(뿌리, 'src/data/vehicles.json'), 'utf8'));
const 잔가표 = JSON.parse(readFileSync(resolve(뿌리, 'public/data/welrix-residuals.json'), 'utf8')).잔가;

/* 표의 «우리이름»으로 vehicles.json 줄을 되찾는다 (brand·model 이 브랜드 보정에 필요) */
const 정 = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const 우리줄 = new Map(우리차.map((u) => [정(`${u.model} ${u.trim}`), u]));
const 가격 = new Map(웰차.map((w) => [w.model, w.price]));

const 오늘 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const 나갈곳 = resolve(뿌리, `_audit/welrix-residual-check-${오늘}.json`);
const 결과 = existsSync(나갈곳) ? JSON.parse(readFileSync(나갈곳, 'utf8')).차 : {};   // 끊겨도 이어서

const 기간들 = [60, 48, 36];
const 몸 = (model) => ({ model, old: false, manualPrice: 0, inputs: 기간들.map((t) => ({
  credit: '중신용', termMonths: t, mileage: '2만km', optionPrice: 0, stockDiscount: 0,
  deliveryFee: rates.탁송['서울'], tintFee: 0, dashcamFee: 0, deposit_pct: 0.1, prepay_pct: 0,
  liability: '1억', extraDriver: '없음', maintenance: '웰스 Basic', feeRate: 0.05 })) });

function 우리인수율(u, price, term) {
  return calc.calcQuote({
    vehicle: { ...u, price }, options: { optPrice: 0, discount: 0 },
    contract: { term, km: '2만km', dep: 10, pre: 0 }, customer: { creditGrade: '중신용' },
    insurance: { property: '1억', extraDriver: '없음' }, fees: { feeRatePct: 5, svc: '웰스 Basic' },
  }).residualPct;
}

const 할것 = Object.entries(잔가표).filter(([m, v]) => v && !결과[m]);
console.log(`검산할 차 ${할것.length} (이미 한 것 ${Object.keys(결과).length})`);
let n = 0;
for (const [model, 표] of 할것) {
  const u = 우리줄.get(정(표.우리이름));
  if (!u) { 결과[model] = { 판정: '안 잼', 까닭: '우리 줄을 못 찾음' }; continue; }
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(몸(model)) })
    .then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
  if (!r?.ok) { 결과[model] = { 판정: '안 잼', 까닭: r?.error || '응답 없음' }; continue; }

  const 다름 = {};
  기간들.forEach((t, i) => {
    const g = r.results[i];
    const 웰 = g.acquirePrice / g.totalCarPrice;
    const 우 = 우리인수율(u, g.totalCarPrice, t);
    const 틈 = Math.round((웰 - 우) * 1e4) / 1e4;            // 인수가율 차이 = r 차이 (다른 가산은 같다)
    if (Math.abs(틈) >= 0.0005) {
      const 키 = `r${t}`;
      다름[키] = { 표: 표[키], 웰릭스: Math.round((표[키] + 틈) * 1e4) / 1e4 };
    }
  });
  결과[model] = Object.keys(다름).length ? { 판정: '다름', 다름 } : { 판정: '같음' };

  if (++n % 20 === 0) {
    writeFileSync(나갈곳, JSON.stringify({ _meta: { 만든날: 오늘 }, 차: 결과 }, null, 1));
    console.log(`  ${n}/${할것.length}`);
  }
  await new Promise((ok) => setTimeout(ok, 150));             // 남의 서버다 — 천천히
}

const 셈 = (k) => Object.values(결과).filter((v) => v.판정 === k).length;
const 본문 = {
  _meta: {
    만든날: 오늘,
    조건: '중신용 · 2만km · 옵션 없음 · 60/48/36개월. 인수가율(acquirePrice/totalCarPrice)을 calc.js 잔가 공식과 견줌',
    못잰것: 'r24 (웰릭스가 24개월을 받지 않는다)',
    같음: 셈('같음'), 다름: 셈('다름'), 안잼: 셈('안 잼'),
  },
  차: 결과,
};
mkdirSync(dirname(나갈곳), { recursive: true });
writeFileSync(나갈곳, JSON.stringify(본문, null, 1));
console.log(`\n→ ${나갈곳}`);
console.log(`같음 ${셈('같음')} · 다름 ${셈('다름')} · 안 잼 ${셈('안 잼')}`);
for (const [m, v] of Object.entries(결과)) if (v.판정 === '다름')
  console.log(`  다름  ${m}  ` + Object.entries(v.다름).map(([k, d]) => `${k} 표 ${d.표} → 웰릭스 ${d.웰릭스}`).join(' · '));
for (const [m, v] of Object.entries(결과)) if (v.판정 === '안 잼') console.log(`  안 잼 ${m} — ${v.까닭}`);
