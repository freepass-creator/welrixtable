// ============================================================================
//  광고 셀프견적 산출물 생성기   —   node scripts/build-promo-quote.mjs
// ----------------------------------------------------------------------------
//  freepass-sales 의 광고 페이지(웹/rent.html)에 붙일 «quote-engine.js» 를 만든다.
//
//  ★정본은 여기(welrixtable)다. 나가는 파일은 «산출물»이지 사본이 아니다.
//    계산을 고칠 일이 생기면 src/lib/calc.js 를 고치고 이걸 다시 돌린다.
//    freepass-sales 쪽 quote-engine.js 를 직접 손대면 다음 생성 때 날아간다.
//
//  섞어 넣는 것 셋:
//    1. 계산엔진   src/lib/calc.js                      (엑셀 v6.1 포팅, 의존성 0)
//    2. 정책       public/data/company-config/welrix.json + scripts/promo-overrides.json
//    3. 차량       _audit/<스냅샷>/vehicles-508.json     (웰릭스 최신 차량가)
//                  + src/data/vehicles.json             (잔가율·군·면세 — 웰릭스는 서버에만 있어 못 준다)
//
//  차량 고르는 규칙: 광고 차종마다 «웰릭스 목록의 첫 트림»을 쓴다.
//                   (웰릭스 견적기도 목록 첫 트림을 기본으로 고른다 = 그 차종의 입문 트림)
//
//  ★잔가율이 없는 신형은 «빌린다»
//    8월 이후 나온 트림(신형 아반떼 2.0 등)은 우리 DB 에 잔가율이 없다.
//    그럴 때 같은 차종에서 «차량가가 가장 가까운» 우리 트림의 잔가율을 빌린다.
//    2026-09-17 검증: 신형 아반떼·그랜저를 웰릭스 실측과 맞춰 본 결과
//      · 잔가율을 역산하면 0.477/0.559/0.629 — 구형(0.48/0.56/0.63)과 «사실상 같다»
//      · 그래서 구형 잔가를 그대로 빌려 신형 차량가로 계산해도 오차 ±1,000원(0.2%)
//    즉 신형이라고 잔가 등급이 바뀌지는 않는다. 빌려 쓰는 게 안전하다.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODEL_SLUG } from '../src/lib/slug.js';
import vm from 'node:vm';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 뿌리 = resolve(여기, '..');
const 읽기 = (p) => readFileSync(resolve(뿌리, p), 'utf-8');
const 읽JSON = (p) => JSON.parse(읽기(p));

const 스냅샷 = '_audit/welrix-netlify-20260917/vehicles-508.json';
const 나갈곳 = process.argv[2] || 'C:/dev/freepass-sales/웹/quote-engine.js';

// ── 광고에 싣는 차종 (웹/rent.html 의 25종) ────────────────────────────────
const 광고차종 = [
  ['현대', ['캐스퍼', '베뉴', '아반떼', '코나', '포터2', '투싼', '쏘나타', '싼타페', '그랜저', '팰리세이드']],
  ['기아', ['모닝', '레이', '셀토스', '스포티지', 'K5', '니로', '쏘렌토', 'K8', '카니발', 'K9']],
  ['제네시스', ['G70', 'GV70', 'G80', 'GV80', 'G90']],
];

// ── 이름 맞추기 ────────────────────────────────────────────────────────────
// ★공백·밑줄을 «먼저» 없앤 다음 세대 머리표를 뗀다. 순서가 바뀌면
//   우리 DB 의 「더_뉴_투싼」이 「더 뉴」와 안 맞아 매칭이 통째로 실패한다.
const 정규 = (s) => String(s || '')
  .replace(/[ \u00b7,()_\-]/g, '')
  .toUpperCase()
  .replace(/디올뉴|더뉴|올뉴|신형|THENEW|ALLNEW|NEW/g, '');

/** 차종 → URL 슬러그. ★주소에 한글을 넣지 않는다 —
 *  `?차=캐스퍼` 는 카톡·문자로 돌 때 `%EC%B0%A8=...` 로 깨져 보인다.
 *  slug.js 의 MODEL_SLUG 는 키가 세대 이름까지 붙어 있어(「더 뉴 캐스퍼」) 부분일치로 찾는다. */
function 슬러그(차종) {
  if (MODEL_SLUG[차종]) return MODEL_SLUG[차종];
  const 키 = Object.keys(MODEL_SLUG).find((k) => k.includes(차종));
  return 키 ? MODEL_SLUG[키] : null;
}

function 우리차찾기(우리들, 웰릭스모델명) {
  const k = 정규(웰릭스모델명);
  return 우리들.find((v) => 정규(`${v.name} ${v.trim}`) === k)
      || 우리들.find((v) => 정규(v.trim) === k)
      || null;
}

// ── 옵션 «관계» — 옛 마스터(public/vehicle-db.js)에서 긁는다 ────────────────
//  ★대표 2026-09-17 「웰릭스 테이블에 내가 되게 좀 재밌게 고르고 선택하고 하게끔 해놨다니까」
//    그 «재미»는 옵션이 평평한 체크 목록이 아니라 «서로 관계가 있다»는 것이다 —
//      · 설명(sub)        무엇이 들었는지
//      · 선행 필수         이걸 먼저 골라야 고를 수 있다
//      · 배타 그룹         휠·내장 같은 건 하나만
//      · 포함 관계         상위 옵션에 이미 들어 있으면 못 고른다
//  ★값(가격)은 웰릭스 카탈로그가 최신이고, 관계는 «낡지 않는다». 그래서 갈라 쓴다.
const 옵션관계 = (() => {
  const ctx = { window: {}, console: { log() {}, warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(읽기('public/vehicle-db.js'), ctx);
  const DB = ctx.window.VEHICLE_DB;
  const 옵정규 = (s) => String(s || '')
    .replace(/[\u2160\u2161\u2162]/g, (m) => ({ '\u2160': 'I', '\u2161': 'II', '\u2162': 'III' }[m]))
    .replace(/인치/g, '"').replace(/패키지|PACK|PKG/g, '')
    .replace(/[\s\u00b7,()\[\]+"'\u2019\u201d&]/g, '').toUpperCase();
  const 통 = {};
  for (const m of DB.manufacturers || []) for (const md of m.models || []) {
    const slug = MODEL_SLUG[md.model_name]
      || Object.entries(MODEL_SLUG).find(([k]) => k.includes(md.model_name))?.[1];
    if (!slug) continue;
    const t = 통[slug] ||= { 옵션: new Map(), 묶음: new Map(), 포함: new Map() };
    for (const v of md.variants || []) {
      const om = v.options_master || {};
      for (const [, o] of Object.entries(om)) {
        const k = 옵정규(o.name);
        if (!t.옵션.has(k)) t.옵션.set(k, {
          설명: o.sub || null,
          선행: (o.requires || []).map((r) => om[r]?.name).filter(Boolean),
        });
      }
      for (const g of v.exclusive_groups || []) {
        const 이름들 = (g.members || g.options || g.ids || []).map((id) => om[id]?.name).filter(Boolean);
        const label = g.label || g.name || '같은 묶음';
        for (const nm of 이름들) if (!t.묶음.has(옵정규(nm))) t.묶음.set(옵정규(nm), label);
      }
      for (const [id, arr] of Object.entries(v.option_excludes || {})) {
        const nm = om[id]?.name; if (!nm) continue;
        const 든것 = (arr || []).map((e) => om[e]?.name).filter(Boolean);
        if (든것.length) t.포함.set(옵정규(nm), 든것);
      }
    }
  }
  return { 통, 옵정규 };
})();

/** 웰릭스 옵션 한 줄에 «관계»를 얹는다. 못 찾으면 이름·가격만 그대로 둔다. */
function 옵션꾸미기(slug, o) {
  const t = 옵션관계.통[slug];
  const k = 옵션관계.옵정규(o.name);
  const r = t?.옵션.get(k);
  const 묶음 = t?.묶음.get(k);
  const 포함 = t?.포함.get(k);
  return {
    이름: o.name, 값: o.price,
    ...(r?.설명 ? { 설명: r.설명 } : {}),
    ...(r?.선행?.length ? { 선행: r.선행 } : {}),
    ...(묶음 ? { 묶음 } : {}),
    ...(포함?.length ? { 포함 } : {}),
  };
}

// ── 정책에 보정 얹기 ───────────────────────────────────────────────────────
function 덮어쓰기(설정, 경로, 값) {
  const 길 = 경로.split('.');
  let 자리 = 설정;
  for (const k of 길.slice(0, -1)) {
    if (자리[k] == null) throw new Error(`보정 경로가 없다: ${경로}`);
    자리 = 자리[k];
  }
  자리[길.at(-1)] = 값;
}

// ── 만들기 ────────────────────────────────────────────────────────────────
const 엔진원문 = 읽기('src/lib/calc.js');
const 정책 = 읽JSON('public/data/company-config/welrix.json');
const 보정 = 읽JSON('scripts/promo-overrides.json');
const 웰릭스차 = 읽JSON(스냅샷);
const 카탈로그 = 읽JSON('_audit/welrix-netlify-20260917/catalog.json');
const 우리DB = 읽JSON('src/data/vehicles.json');
const 우리들 = Array.isArray(우리DB) ? 우리DB : (우리DB.vehicles || []);

for (const [경로, 값] of Object.entries(보정['덮어쓸 것'])) 덮어쓰기(정책, 경로, 값);

const 차량들 = [];
const 빠진것 = [];
for (const [브랜드, 차종들] of 광고차종) {
  for (const 차종 of 차종들) {
    // ★신차만 싣는다 — 이건 «신차 장기렌터카» 상품이다. 단종된 구형은 있을 수 없다.
    //   대표(2026-09-17): 「구형은 여기 있을 수가 없지, 이건 신차만 하는 건데」
    //   웰릭스 데이터에 플래그가 박혀 있다. 그쪽 견적기도 같은 기준으로 목록을 만든다:
    //     신차 목록 = !oldOnly  ·  재고(8월 이전) 목록 = !newOnly
    //   이걸 안 걸렀더니 그랜저가 「디 올 뉴 그랜저」(단종 구형)로 잡혀 있었다.
    const 후보 = 웰릭스차.filter((w) => w.brand === 브랜드 && w.carType === 차종 && !w.oldOnly);
    if (!후보.length) { 빠진것.push([차종, '웰릭스 신차 목록에 없다']); continue; }

    // 대표 = 웰릭스 목록의 첫 트림 (= 견적기 기본 선택 = 그 차종 입문 트림)
    const w = 후보[0];

    // 잔가율: ① 이름이 맞는 우리 트림  ② 없으면 같은 차종에서 «차량가가 가장 가까운» 우리 트림
    let 우리 = 우리차찾기(우리들, w.model);
    let 빌림 = null;
    if (!우리) {
      // ★연료가 같고 «용도 트림»이 아닌 것만 후보다.
      //   가격만 보고 고르면 「아반떼 1.6 LPG 렌터카 Modern」 같은 게 걸린다 —
      //   가격은 30만원 차이인데 잔가 등급이 달라 월 렌트료가 5만원 틀어졌다.
      const 용도트림 = /밴|렌터카|택시|선구매/;
      let 같은차종 = 우리들.filter((v) =>
        정규(v.name).includes(정규(차종))
        && !용도트림.test(`${v.name} ${v.trim}`)
        && (!w.fuel || v.fuel === w.fuel));
      if (!같은차종.length) {   // 연료까지 맞는 게 없으면 연료 조건만 푼다
        같은차종 = 우리들.filter((v) =>
          정규(v.name).includes(정규(차종)) && !용도트림.test(`${v.name} ${v.trim}`));
      }
      if (!같은차종.length) { 빠진것.push([차종, '우리 DB 에 이 차종 자체가 없다']); continue; }
      우리 = 같은차종.reduce((a, b) =>
        Math.abs(a.price - w.price) <= Math.abs(b.price - w.price) ? a : b);
      빌림 = `${우리.name} ${우리.trim} (${우리.price.toLocaleString()}원 · ${우리.fuel})`;
    }
    const s = 슬러그(차종);
    if (!s) 빠진것.push([차종, 'URL 슬러그를 못 찾았다 (slug.js)']);
    차량들.push({
      차종,
      slug: s,
      브랜드,
      이름: w.model,
      차량가: w.price,                       // ★웰릭스 최신가
      차량가_이전: w.priceOld ?? null,        // 8월 변동 이전 (참고용)
      // ↓ 엔진이 읽는 값 — 잔가율·군·면세는 «우리 DB» 것이다 (웰릭스는 서버에만 있다)
      trim: `${우리.name} ${우리.trim}`,
      model: 우리.model,
      disp: 우리.disp,
      fuel: 우리.fuel,
      tax_exempt: 우리.tax_exempt,
      group: 우리.group,
      multi_seat: 우리.multi_seat ?? null,
      r24: 우리.r24, r36: 우리.r36, r48: 우리.r48, r60: 우리.r60,
      strategic: 우리.strategic ?? 0,
      buyback_apply: 우리.buyback_apply ?? 0,
      // ★옵션 — 웰릭스 카탈로그 optionsByModel 의 «현행» 값.
      //   optionsByModelOld 는 8월 이전 것이라 안 쓴다 — 광고는 신차만 다룬다.
      옵션: (카탈로그.optionsByModel?.[w.model] || [])
        .filter((o) => o.price > 0).map((o) => 옵션꾸미기(s, o)),
      _잔가출처: 빌림 ? `빌림 ← ${빌림}` : '이름 일치',
    });
  }
}

const 오늘 = new Date().toISOString().slice(0, 10);
const 머리 = `// ============================================================================
//  ★자동 생성 파일이다. 여기서 고치지 마라 — 다음 생성 때 통째로 날아간다.
//    정본: C:\\dev\\welrixtable
//    다시 만들기: node scripts/build-promo-quote.mjs
// ----------------------------------------------------------------------------
//  생성      ${오늘}
//  계산엔진  src/lib/calc.js (엑셀 ${정책.excel_version} / ${정책.excel_version_date} 포팅)
//  차량가    웰릭스 견적기 2026-09-17 스냅샷 — ${차량들.length}종
//  잔가율·군 우리 차량DB (웰릭스는 서버에만 있어 받을 수 없다)
//  보정      금리 ${(정책.financial.credit_lookup['중신용'].interest * 100).toFixed(2)}% ← 원래 6.40%
//            ※ 2026-09-17 역산 보정값. 근거는 scripts/promo-overrides.json
//               웰릭스가 값을 또 바꾸면 이 파일이 틀린다. 다시 재고 다시 만든다.
// ============================================================================

`;

const 꼬리 = `

// ── 광고에 싣는 차 ─────────────────────────────────────────────────────────
export const 차량 = ${JSON.stringify(차량들, null, 1)};

// ── 손님이 못 고르는 값 (광고에서는 이걸로 고정한다) ────────────────────────
//  ★웰릭스 견적기의 기본값과 같게 맞춰 뒀다. 하나라도 바꾸면 값이 달라진다.
export const 고정조건 = {
  신용: '중신용',          // 손님에게 안 묻는다. 「신용상태에 따라 달라질 수 있습니다」로 고지한다
  정비: '웰스 Basic',
  대물: '1억',
  추가운전자: '없음',
  탁송료: 120000,          // 서울 기준
  썬팅블박: 0,             // 광고는 «기본형» 기준 — 썬팅·블박 없음
  수수료율: 7.0,          // ★대표 2026-09-17 「7% 수수료 7% 기준」. 웰릭스 입력 상한도 7% 다
};

// ── 손님이 고르는 값 ───────────────────────────────────────────────────────
export const 고를것 = {
  기간: [60, 48, 36],                    // 개월
  선납: [0, 5, 10, 15, 20, 25, 30],      // %
  보증금: [0, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // %
  약정: [2, 3],                          // 만km
};
//  ★보증금 기본을 0 으로 둔다 — 광고 문구가 「무보증 가능」이라서다.
//    보증금을 넣으면 월 렌트료가 «내려간다». 0 에서 시작해야 손님이 본 값보다
//    실제가 싸지, 비싸지지 않는다. (웰릭스 견적기 기본값은 10% 다 — 일부러 다르게 뒀다)
export const 기본값 = { 기간: 60, 선납: 0, 보증금: 0, 약정: 2, 옵션값: 0 };

setCompanyConfig(${JSON.stringify({ financial: 정책.financial }, null, 1)});

/** 월 렌트료 (VAT 포함) — 못 고른 값은 기본값을 쓴다.
 *  @param 차   위 «차량» 배열의 한 줄
 *  @returns {{월렌트료:number, 보증금액:number, 선납금액:number, 만기인수금액:number}}
 */
export function 견적(차, 고른것 = {}) {
  const c = { ...기본값, ...고른것 };
  const r = calcQuote({
    vehicle: {
      brand: 차.브랜드, model: 차.model, trim: 차.trim, price: 차.차량가,
      disp: 차.disp, fuel: 차.fuel, tax_exempt: 차.tax_exempt, group: 차.group,
      multi_seat: 차.multi_seat, r24: 차.r24, r36: 차.r36, r48: 차.r48, r60: 차.r60,
      strategic: 차.strategic, buyback_apply: 차.buyback_apply,
    },
    options: {
      optPrice: +c.옵션값 || 0, discount: 0,
      deliveryFee: 고정조건.탁송료, itemsFee: 고정조건.썬팅블박, etc: 0,
    },
    contract: { term: c.기간, km: c.약정 + '만km', dep: +c.보증금 || 0, pre: +c.선납 || 0 },
    customer: { creditGrade: 고정조건.신용 },
    insurance: {
      property: 고정조건.대물, extraDriver: 고정조건.추가운전자,
      exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
      deductible: '30만원~', emergency: '가입',
    },
    fees: { feeRatePct: 고정조건.수수료율, svc: 고정조건.정비 },
  });
  return {
    월렌트료: r.monthly,
    보증금액: r.depositAmt,
    선납금액: r.prePayAmt,
    만기인수금액: r.residualAmt,
  };
}

/** 카드에 쓰는 「월 OO만원」 — 60개월·보증금 0·선납 0 기준, 만원 단위 ★올림.
 *  ★내림이 아니라 올림이다. 광고가 실제보다 싸 보이면 상담에서 말이 바뀐다. */
export function 대표월액(차) {
  return Math.ceil(견적(차, { 기간: 60, 보증금: 0, 선납: 0 }).월렌트료 / 10000);
}
`;

writeFileSync(나갈곳, 머리 + 엔진원문 + 꼬리, 'utf-8');

// ── 차종별 «전체 신차 트림» — 견적 페이지가 「트림 고르기」 걸음에서 늦게 불러 쓴다 ──
//  ★광고 페이지(rent.html)는 이걸 안 받는다. 25종 대표 트림만으로 카드가 그려진다.
//    이 파일은 200KB 가 넘어 광고에 실으면 첫 화면이 느려진다.
//  ★렌터카 전용 트림(쏘나타 Business · K5/K8 LPi 렌터카)이 여기 들어온다 —
//    제조사가 «렌터카용»으로 따로 매긴 값이고 일반 트림보다 140~306만원 싸다(공식 가격표 확인).
//    우리가 렌터카 회사인데 그걸 안 보여 주면 견적이 그만큼 비싸진다.
const 트림나갈곳 = 나갈곳.replace(/quote-engine\.js$/, 'quote-trims.js');
const 트림들 = {};
let 트림수 = 0, 빌린트림 = 0;
for (const 차 of 차량들) {
  const 후보 = 웰릭스차.filter((w) => w.brand === 차.브랜드 && w.carType === 차.차종 && !w.oldOnly);
  트림들[차.slug] = 후보.map((w) => {
    let 우리 = 우리차찾기(우리들, w.model);
    let 빌림 = null;
    if (!우리) {
      const 용도트림 = /밴|택시|선구매/;      // ★「렌터카」는 빼지 않는다 — 우리가 쓸 트림이다
      let 같은차종 = 우리들.filter((v) => 정규(v.name).includes(정규(차.차종))
        && !용도트림.test(`${v.name} ${v.trim}`) && (!w.fuel || v.fuel === w.fuel));
      if (!같은차종.length) 같은차종 = 우리들.filter((v) => 정규(v.name).includes(정규(차.차종))
        && !용도트림.test(`${v.name} ${v.trim}`));
      if (!같은차종.length) return null;
      우리 = 같은차종.reduce((a, b) =>
        Math.abs(a.price - w.price) <= Math.abs(b.price - w.price) ? a : b);
      빌림 = `${우리.name} ${우리.trim}`;
      빌린트림++;
    }
    트림수++;
    return {
      이름: w.model, 차량가: w.price,
      렌터카전용: /렌터카|Business|비즈니스/i.test(w.model) || undefined,
      trim: `${우리.name} ${우리.trim}`, model: 우리.model, disp: 우리.disp, fuel: 우리.fuel,
      tax_exempt: 우리.tax_exempt, group: 우리.group, multi_seat: 우리.multi_seat ?? null,
      r24: 우리.r24, r36: 우리.r36, r48: 우리.r48, r60: 우리.r60,
      strategic: 우리.strategic ?? 0, buyback_apply: 우리.buyback_apply ?? 0,
      옵션: (카탈로그.optionsByModel?.[w.model] || [])
        .filter((o) => o.price > 0).map((o) => 옵션꾸미기(차.slug, o)),
      _잔가: 빌림 ? `빌림 ← ${빌림}` : '일치',
    };
  }).filter(Boolean).sort((a, b) => a.차량가 - b.차량가);
}
const 트림본문 =
  '// ★자동 생성 — 고치지 마라. 정본: C:\\\\dev\\\\welrixtable · node scripts/build-promo-quote.mjs\n' +
  `// 차종별 신차 전체 트림 (${오늘}). 견적 페이지가 「트림 고르기」 걸음에서 늦게 불러 쓴다.\n` +
  '// 잔가율은 우리 차량DB 것이다 — 이름이 안 맞는 트림은 같은 차종·같은 연료에서 «빌린다».\n\n' +
  `export const 트림 = ${JSON.stringify(트림들, null, 1)};\n`;
writeFileSync(트림나갈곳, 트림본문, 'utf-8');
console.log(`트림 파일 → ${트림나갈곳}`);
console.log(`  트림 ${트림수}개 (잔가 빌린 것 ${빌린트림}) · ${(트림본문.length / 1024).toFixed(0)}KB`);
const 렌 = Object.values(트림들).flat().filter((t) => t.렌터카전용);
console.log(`  ★렌터카 전용 트림 ${렌.length}개 포함: ` + 렌.map((t) => t.이름).join(' · '));
const 옵전부 = Object.values(트림들).flat().flatMap((t) => t.옵션 || []);
console.log(`  옵션 ${옵전부.length}개 · 설명 ${옵전부.filter((o) => o.설명).length}` +
  ` · 선행필수 ${옵전부.filter((o) => o.선행).length}` +
  ` · 배타묶음 ${옵전부.filter((o) => o.묶음).length}` +
  ` · 포함관계 ${옵전부.filter((o) => o.포함).length}`);

console.log(`만들었다 → ${나갈곳}`);
console.log(`  차량 ${차량들.length}종 · 엔진 ${엔진원문.split('\n').length}줄 · 모두 ${((머리 + 엔진원문 + 꼬리).length / 1024).toFixed(1)}KB`);
const 빌린것 = 차량들.filter((c) => c._잔가출처 !== '이름 일치');
if (빌린것.length) {
  console.log('\n잔가율을 «빌린» 차 (신형이라 우리 DB 에 없다 — 오차 ±1,000원으로 검증됨):');
  빌린것.forEach((c) => console.log(`  ${c.차종.padEnd(8)} ${c.이름}\n           ${c._잔가출처}`));
}
if (빠진것.length) {
  console.log('\n★못 실은 차:');
  빠진것.forEach(([a, b]) => console.log(`  ${a} — ${b}`));
  process.exitCode = 1;
}
