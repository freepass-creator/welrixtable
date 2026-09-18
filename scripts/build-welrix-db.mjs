// ============================================================================
//  웰릭스 차량 DB 어댑터   —   node scripts/build-welrix-db.mjs
// ----------------------------------------------------------------------------
//  ★대표 2026-09-18 「우리는 웰릭스 거 견적기를 그대로 갖다 쓰고 …
//    외형은 다른데 내부는 똑같은 로직이어야 되는 거야」
//
//  ★무엇을 하나
//    웰릭스 «평평한» 차량 목록을 우리 화면(StepVehicle)이 읽는 «계층» 모양으로 바꾼다.
//    화면은 한 줄도 안 고치고, 읽는 데이터만 갈아끼운다.
//
//      웰릭스              우리 화면
//      brand      →  manufacturer   제조사
//      carType    →  model          모델
//      fuel       →  variant        세부모델(파워트레인)
//      model(전체) →  trim           트림   ★이 문자열이 곧 /api/estimate 의 model 키다
//
//  ★trim_id 를 웰릭스 model 문자열로 두는 것이 이 어댑터의 핵심이다.
//    손님이 트림을 고르면 그 값이 그대로 계산 서버로 나간다 — 이름 매핑이 없다.
//
//  ★가격은 웰릭스 것을 그대로 쓴다.
//    옛 public/vehicle-db.js 는 제조사 가격표에 없는 숫자였다(폐기 표시함).
//
//  ★옵션 «관계»(설명·배타그룹·선행·포함)는 옛 마스터에서 가져온다.
//    가격은 낡아도 관계는 안 낡는다. 웰릭스 카탈로그엔 {name, price} 뿐이다.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { MODEL_SLUG } from '../src/lib/slug.js';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 뿌리 = resolve(여기, '..');
const 읽 = (p) => readFileSync(resolve(뿌리, p), 'utf-8');
const 읽J = (p) => JSON.parse(읽(p));

const 스냅 = '_audit/welrix-netlify-20260917';
const 웰차 = 읽J(`${스냅}/vehicles-508.json`).filter((v) => !v.oldOnly);   // ★신차만
const 카탈 = 읽J(`${스냅}/catalog.json`);
const 나갈곳 = resolve(뿌리, 'public/welrix-db.js');

const 브랜드ID = { 현대: 'hyundai', 기아: 'kia', 제네시스: 'genesis' };
const 연료라벨 = (f) => ({ 'HEV.': '하이브리드' }[f] || f);

/* ── 옵션 관계 — 옛 마스터에서 긁는다(가격 말고 «관계»만) ────────────────── */
const 관계 = (() => {
  const ctx = { window: {}, console: { log() {}, warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(읽('public/vehicle-db.js'), ctx);
  const DB = ctx.window.VEHICLE_DB;
  const 정 = (s) => String(s || '')
    .replace(/[ⅠⅡⅢ]/g, (m) => ({ 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III' }[m]))
    .replace(/인치/g, '"').replace(/패키지|PACK|PKG/g, '')
    .replace(/[\s·,()\[\]+"'’”&]/g, '').toUpperCase();
  const 통 = {};
  for (const m of DB?.manufacturers || []) for (const md of m.models || []) {
    const slug = MODEL_SLUG[md.model_name]
      || Object.entries(MODEL_SLUG).find(([k]) => k.includes(md.model_name))?.[1];
    if (!slug) continue;
    const t = 통[slug] ||= { 옵: new Map(), 묶: new Map(), 품: new Map() };
    for (const v of md.variants || []) {
      const om = v.options_master || {};
      for (const [, o] of Object.entries(om)) {
        const k = 정(o.name);
        if (!t.옵.has(k)) t.옵.set(k, { sub: o.sub || null, requires: (o.requires || []).map((r) => om[r]?.name).filter(Boolean) });
      }
      for (const g of v.exclusive_groups || []) {
        const 들 = (g.members || []).map((id) => om[id]?.name).filter(Boolean);
        const label = g.label || '같은 묶음';
        for (const nm of 들) if (!t.묶.has(정(nm))) t.묶.set(정(nm), label);
      }
      for (const [id, arr] of Object.entries(v.option_excludes || {})) {
        const nm = om[id]?.name; if (!nm) continue;
        const 든 = (arr || []).map((e) => om[e]?.name).filter(Boolean);
        if (든.length) t.품.set(정(nm), 든);
      }
    }
  }
  return { 통, 정 };
})();

/* ★구동을 바꾸는 «옵션»은 싣지 않는다.
   웰릭스는 4WD 를 «트림»으로도 팔고 «옵션»으로도 붙일 수 있게 해 놨다:
     K9  3.3 터보 2WD 플래티넘 66,880,000 + AWD 옵션 247만 = 69,350,000
         = 「K9 3.3 가솔린 터보 AWD 플래티넘」 값과 «정확히» 같다
     셀토스 2WD 트렌디 25,120,000 + 전자식 4WD 198만 = 27,100,000 = 「4WD 트렌디」
   두 길이 열려 있으면 손님이 4WD 트림을 고른 뒤 또 4WD 옵션을 눌러 «두 번» 값을 낸다.
   우리는 구동을 파워트레인 축에서 고르므로 옵션 쪽을 뺀다 — 값은 어느 쪽이든 같다.
   ⚠ 「2열 냉온장 컵홀더(6인승 전용)」 처럼 «설명»에 인승·구동이 든 것은 빼면 안 된다. */
const 구동옵션 = (이름) => /^(전자식\s*)?(AWD|4WD)$/i.test(String(이름).replace(/\s+/g, ' ').trim())
  || /^HTRAC\s*\(?4WD\)?$/i.test(String(이름).trim());

/* 옵션 이름 → 안정된 id */
const 옵ID = (이름) => 'o_' + Buffer.from(String(이름)).toString('base64')
  .replace(/[^A-Za-z0-9]/g, '').slice(0, 16);

/* ── 파워트레인 ────────────────────────────────────────────────────────────
 *  ★대표 2026-09-18 「모델은 그랜저·캐스퍼·싼타페 이런 거고,
 *    파워트레인은 «가솔린 2.5» 이런 게 파워트레인이지. 예전 견적기 제대로 다시 봐봐」
 *
 *  옛 견적기(vehicle-db.js)의 variant 가 바로 그 단위였다 —
 *    「가솔린 1.6 터보」 · 「가솔린 2.0」 · 「하이브리드 2.0」
 *    「LPG 2.0 (렌터카)」 · 「가솔린 1.0 (밴)」
 *  연료만으로 나누면(내가 처음에 그렇게 했다) 2.5 냐 3.5 냐를 고르는 자리가 없어진다.
 *
 *  ⚠ 웰릭스 트림 이름은 배기량·터보 자리가 차종마다 다르다:
 *      「2.5 가솔린」(그랜저) · 「1.6 터보 가솔린」(쏘나타) · 「1.6 가솔린 터보」(K5)
 *    그래서 «배기량은 숫자로, 터보·용도는 낱말로» 따로 집는다.
 *  ★인승(5/7/9)·구동(2WD/4WD)도 여기서 나눈다 — 제조사 「내 차 만들기」가 그렇게 묻는다.
 *    대표 2026-09-18 「우리는 제조사에서 내 차 만들기 방식으로 해놓은 거야.
 *    거기에 맞춰서 웰릭스하고 세부 트림하고 딱 그게 맞으면 거기서부터 견적 이어나가면 되니까」
 *    안 나누면 싼타페가 트림 36줄이 된다(5·7인승 × 2WD·4WD × 6등급) — 고르기 벅차다.
 *    나누면 파워트레인 8갈래 × 트림 6개가 되어 «한 번에 하나씩» 고르게 된다.
 */
/* ★연료는 «트림 이름»을 먼저 믿는다.
   웰릭스 원본에 오류가 있다 — 셀토스 하이브리드 3트림의 fuel 이 「가솔린」으로 들어가 있어서
   그대로 쓰면 하이브리드가 가솔린 갈래에 섞인다(2026-09-18 확인). */
function 진짜연료(웰릭스모델, fuel) {
  if (/하이브리드|HEV/i.test(웰릭스모델)) return 'HEV.';
  if (/\bLPi\b|LPG/i.test(웰릭스모델)) return 'LPG';
  if (/디젤/.test(웰릭스모델)) return '디젤';
  if (/가솔린/.test(웰릭스모델)) return '가솔린';
  return fuel;
}

function 파워트레인(웰릭스모델, 차종, 연료) {
  let 뒤 = String(웰릭스모델);
  const i = 뒤.indexOf(차종);
  if (i >= 0) 뒤 = 뒤.slice(i + 차종.length);
  const 앞 = i >= 0 ? 웰릭스모델.slice(0, i + 차종.length + 3) : 웰릭스모델;

  const 배기량 = (뒤.match(/\d\.\d/) || [])[0] || '';
  const 터보 = /터보|T-GDI/i.test(뒤);
  const 인승 = (웰릭스모델.match(/(\d+)인승/) || [])[0] || '';
  const 구동 = /4WD|AWD|HTRAC/i.test(뒤) ? '4WD' : (/2WD/i.test(뒤) ? '2WD' : '');
  const 용도 = /밴/.test(앞) || /\s밴\s|^밴/.test(뒤) ? '밴'
    : /렌터카|Business|비즈니스/i.test(뒤) ? '렌터카'
    : /택시/.test(뒤) ? '택시'
    : /선구매/.test(웰릭스모델) ? '선구매'
    : '';

  const 엔진 = [연료라벨(진짜연료(웰릭스모델, 연료)), 배기량].filter(Boolean).join(' ') + (터보 ? ' 터보' : '')
    + (용도 ? ` (${용도})` : '');
  /* ★인승·구동은 «이 엔진 안에서 갈릴 때만» 이름에 붙인다 (아래에서 정한다).
     그랜저는 4WD 가 3.5 에만 있는데 전부 「· 2WD」가 붙으면 군더더기다 —
     제조사 「내 차 만들기」도 갈릴 때만 묻는다. */
  return { 엔진, 인승, 구동 };
}

/* 트림 이름에서 «앞에서 이미 고른 것»을 지운다 — 엔진·인승·구동을 두 번 보일 필요가 없다.
   「2.5 가솔린 터보 5인승 2WD 익스클루시브」 → 「익스클루시브」 */
function 트림이름정리(짧은, pt, 연료) {
  let s = 짧은;
  if (pt.인승) s = s.replace(pt.인승, '');
  if (pt.구동) s = s.replace(new RegExp(pt.구동, 'i'), '');
  const 배기량 = (pt.이름.match(/\d\.\d/) || [])[0];
  if (배기량) s = s.replace(배기량, '');
  /* 세대 꼬리도 턴다 — 「쏘나타 디 엣지 …」 처럼 차종 뒤에 세대말이 붙는 차가 있다 */
  for (const 꼬리 of ['디 엣지', '디 올 뉴', '더 뉴', 'The new', 'New'])
    s = s.replace(new RegExp('^' + 꼬리, 'i'), '').trim();
  for (const 낱말 of [연료라벨(연료), 연료, '가솔린', 'LPG', 'Lpi', '하이브리드', '터보', '밴', '렌터카'])
    if (낱말) s = s.replace(new RegExp(낱말, 'ig'), '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s || 짧은;
}

/* 트림 표시 이름 — 「<세대> <차종>」을 떼고 남은 것 */
function 짧은이름(전체, 차종) {
  let s = String(전체);
  const i = s.indexOf(차종);
  if (i >= 0) s = s.slice(i + 차종.length);
  return s.trim() || 전체;
}

/* ── 계층으로 쌓는다 ────────────────────────────────────────────────────── */
const 제조사들 = [];
for (const [브랜드, mid] of Object.entries(브랜드ID)) {
  const 차종들 = [...new Set(웰차.filter((w) => w.brand === 브랜드).map((w) => w.carType))];
  const models = [];
  for (const 차종 of 차종들) {
    const slug = MODEL_SLUG[차종] || Object.entries(MODEL_SLUG).find(([k]) => k.includes(차종))?.[1] || 차종;
    const 통 = 관계.통[slug];
    /* ★파워트레인으로 묶는다 — 먼저 «엔진»으로, 그 안에서 인승·구동이 갈리면 그것까지 */
    const 이차들 = 웰차.filter((w) => w.brand === 브랜드 && w.carType === 차종);
    const 엔진표 = new Map();
    for (const w of 이차들) {
      const pt = 파워트레인(w.model, 차종, w.fuel);
      if (!엔진표.has(pt.엔진)) 엔진표.set(pt.엔진, { 인승들: new Set(), 구동들: new Set(), 차들: [] });
      const e = 엔진표.get(pt.엔진);
      e.인승들.add(pt.인승); e.구동들.add(pt.구동);
      e.차들.push({ w, pt });
    }
    const 묶음표 = new Map();
    for (const [엔진, e] of 엔진표) {
      const 인승갈림 = e.인승들.size > 1;
      const 구동갈림 = e.구동들.size > 1;
      for (const { w, pt } of e.차들) {
        const 몸 = [인승갈림 ? pt.인승 : '', 구동갈림 ? pt.구동 : ''].filter(Boolean).join(' ');
        const 이름 = 엔진 + (몸 ? ` · ${몸}` : '');
        const id = ('pt_' + 이름).replace(/[^\w가-힣]/g, '_');
        if (!묶음표.has(id)) 묶음표.set(id, {
          id, 이름, 연료: w.fuel, 차들: [],
          /* ★인승·구동은 트림 이름에서 «언제나» 지운다.
             갈리면 파워트레인 이름에 이미 있고, 안 갈리면 모든 트림에 똑같이 붙는 군더더기다. */
          인승: pt.인승, 구동: pt.구동,
        });
        묶음표.get(id).차들.push(w);
      }
    }
    const variants = [];
    for (const pt of 묶음표.values()) {
      const 연료 = pt.연료;
      const 목록 = pt.차들.sort((a, b) => a.price - b.price);
      const options_master = {};
      const trims = 목록.map((w) => {
        const 옵 = (카탈.optionsByModel?.[w.model] || [])
          .filter((o) => o.price > 0 && !구동옵션(o.name));
        const ids = [];
        for (const o of 옵) {
          const id = 옵ID(o.name); ids.push(id);
          if (!options_master[id]) {
            const k = 관계.정(o.name);
            const r = 통?.옵.get(k);
            options_master[id] = {
              name: o.name,
              price: Math.round(o.price / 10000),          // 화면은 만원 단위로 읽는다
              ...(r?.sub ? { sub: r.sub } : {}),
              ...(r?.requires?.length ? { _requiresNames: r.requires } : {}),
            };
          }
        }
        return {
          trim_id: w.model,                                 // ★API 의 model 키
          name: 트림이름정리(짧은이름(w.model, 차종), pt, 연료),
          base_price_5: Math.round(w.price / 10000),
          base_price_3_5: Math.round(w.price / 10000),      // 웰릭스는 한 벌만 준다 — 그게 견적 기준이다
          _welrixModel: w.model,
          _priceWon: w.price,
          _rentalOnly: /렌터카|Business|비즈니스/i.test(w.model) || undefined,
          available_options: ids,
        };
      });
      /* 이름으로 잡아 둔 선행·배타·포함을 id 로 바꿔 심는다 */
      const 이름찾기 = {};
      for (const [id, o] of Object.entries(options_master)) 이름찾기[관계.정(o.name)] = id;
      for (const o of Object.values(options_master)) {
        if (o._requiresNames) {
          o.requires = o._requiresNames.map((n) => 이름찾기[관계.정(n)]).filter(Boolean);
          if (!o.requires.length) delete o.requires;
          delete o._requiresNames;
        }
      }
      const 묶음 = {};
      for (const [id, o] of Object.entries(options_master)) {
        const label = 통?.묶.get(관계.정(o.name));
        if (label) (묶음[label] ||= []).push(id);
      }
      const exclusive_groups = Object.entries(묶음)
        .filter(([, ids]) => ids.length > 1)
        .map(([label, members], i) => ({ id: 'g' + i, label, members }));
      const option_excludes = {};
      for (const [id, o] of Object.entries(options_master)) {
        const 든 = 통?.품.get(관계.정(o.name));
        if (!든) continue;
        const 들 = 든.map((n) => 이름찾기[관계.정(n)]).filter(Boolean);
        if (들.length) option_excludes[id] = 들;
      }
      variants.push({
        variant_id: pt.id,
        variant_name: pt.이름,
        vehicle_type: 목록[0]?.multiSeat ? '다인승' : '승용',
        fuel: 연료라벨(연료),
        displacement_cc: 목록[0]?.cc || 0,
        transmission: '',
        trims, options_master, exclusive_groups, option_excludes,
      });
    }
    const 색 = 카탈.colors?.[차종] || {};
    const 추가 = 카탈.colorExtra?.[차종] || {};
    models.push({
      model_id: slug, model_name: 차종, category: '', year: 2026, variants,
      exterior_colors: (색.exterior || []).map((n) => ({ name: n, code: '', hex: '', price: 추가[n] ? Math.round(추가[n] / 10000) : 0 })),
      _interior: 색.interior || [],
    });
  }
  제조사들.push({ manufacturer_id: mid, manufacturer_name: 브랜드, models });
}

const 오늘 = new Date().toISOString().slice(0, 10);
const 트림수 = 제조사들.flatMap((m) => m.models).flatMap((m) => m.variants).flatMap((v) => v.trims).length;
const 본문 = `/* ============================================================================
 *  ★자동 생성 — 고치지 마라. node scripts/build-welrix-db.mjs
 * ----------------------------------------------------------------------------
 *  생성 ${오늘} · 웰릭스 신차 ${트림수}트림
 *  가격  = 웰릭스 스냅샷(제조사 공식 가격표와 일치 확인)
 *  옵션  = 웰릭스 카탈로그 + 옛 마스터의 «관계»(설명·배타·선행·포함)
 *  ★trim_id 가 곧 /api/estimate 의 model 키다 — 이름 매핑이 필요 없다.
 * ========================================================================== */
window.VEHICLE_DB = ${JSON.stringify({ manufacturers: 제조사들 })};
window.__WELRIX_DB_BUILT = '${오늘}';
`;
writeFileSync(나갈곳, 본문, 'utf-8');

const 옵수 = 제조사들.flatMap((m) => m.models).flatMap((m) => m.variants)
  .reduce((a, v) => a + Object.keys(v.options_master).length, 0);
const 배타 = 제조사들.flatMap((m) => m.models).flatMap((m) => m.variants).reduce((a, v) => a + v.exclusive_groups.length, 0);
const 색수 = 제조사들.flatMap((m) => m.models).reduce((a, m) => a + m.exterior_colors.length, 0);
console.log(`만들었다 → ${나갈곳}`);
console.log(`  제조사 ${제조사들.length} · 모델 ${제조사들.reduce((a,m)=>a+m.models.length,0)}` +
  ` · 트림 ${트림수} · 옵션 ${옵수} · 배타묶음 ${배타} · 외장색 ${색수} · ${(본문.length/1024).toFixed(0)}KB`);
const 렌 = 제조사들.flatMap((m)=>m.models).flatMap((m)=>m.variants).flatMap((v)=>v.trims).filter((t)=>t._rentalOnly);
console.log(`  ★렌터카 전용 ${렌.length}개: ` + 렌.map((t)=>t.trim_id).join(' · '));
