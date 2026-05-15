// welrix 견적기 v2 — 영업자 워크플로 중심
// wel 의 calc.js + 데이터 그대로 활용 (엑셀 일치 검증 완료)

import { calcQuote, setCompanyConfig } from './src/lib/calc.js';

// ===== 상수 (wel/app.js 에서 가져옴 — 엑셀 일치 검증된 데이터) =====
const CURRENT_LINEUP = {
  '현대':    ['그랜저', '캐스퍼', '싼타페', '팰리세이드', '투싼', '쏘나타', '아반떼', '코나', '베뉴', '포터2'],
  '기아':    ['쏘렌토', '카니발', '스포티지', 'K5', 'K8', '셀토스', '니로', '모닝', '레이', 'K9'],
  '제네시스': ['GV80', 'G80', 'GV70', 'G90', 'G70'],
};

const MODEL_TO_CHASSIS = {
  '그랜저':'hyundai_grandeur_gn7_fl','쏘나타':'hyundai_sonata_dn8_edge','아반떼':'hyundai_avante_cn7',
  '캐스퍼':'hyundai_casper','코나':'hyundai_kona_sx2','투싼':'hyundai_tucson_nx4',
  '싼타페':'hyundai_santafe_mx5','팰리세이드':'hyundai_palisade_lx3','베뉴':'hyundai_venue','포터2':'hyundai_porter',
  'K5':'kia_k5_dl3_facelift','K8':'kia_k8_gl3','K9':'kia_k9_rj','니로':'kia_niro_sg2',
  '레이':'kia_ray','모닝':'kia_morning_ja','셀토스':'kia_seltos_sp3',
  '스포티지':'kia_sportage_nq5','쏘렌토':'kia_sorento_mq4_facelift','카니발':'kia_carnival_ka4_facelift',
  'G70':'genesis_g70','G80':'genesis_g80_rg3','G90':'genesis_g90_rs4','GV70':'genesis_gv70','GV80':'genesis_gv80',
};

const DELIVERY_REGIONS = {
  '광역시': { '서울': 99000, '인천': 99000, '대전': 121000, '광주': 176000, '대구': 176000, '부산': 198000, '울산': 198000 },
  '경기도': { '수원': 77000, '용인': 88000, '성남': 88000, '안양': 88000, '안성': 88000, '의왕': 88000, '하남': 88000, '경기광주': 88000, '군포': 88000, '과천': 88000, '평택': 66000, '오산': 66000, '화성': 66000, '안산': 99000, '시흥': 99000, '구리': 99000, '광명': 99000, '부천': 99000, '고양': 110000, '김포': 110000, '남양주': 110000, '동두천': 110000, '양주': 110000, '양평': 110000, '여주': 110000, '의정부': 110000, '이천': 110000, '가평': 121000, '파주': 121000, '연천': 132000, '포천': 132000 },
  '강원도': { '강릉': 187000, '동해': 187000, '삼척': 187000, '양양': 187000, '인제': 187000, '정선': 187000, '철원': 187000, '태백': 187000, '고성': 198000, '속초': 198000, '양구': 165000, '영월': 165000, '원주': 121000, '춘천': 143000, '평창': 154000, '홍천': 154000, '화천': 187000, '횡성': 154000 },
  '충청북도': { '청주': 121000, '청원': 121000, '음성': 121000, '진천': 121000, '증평': 121000, '괴산': 132000, '보은': 132000, '영동': 132000, '옥천': 132000, '충주': 132000, '단양': 143000, '제천': 143000 },
  '충청남도': { '천안': 110000, '아산': 110000, '공주': 121000, '당진': 121000, '연기': 121000, '홍성': 121000, '논산': 143000, '금산': 143000, '보령': 143000, '부여': 132000, '서산': 132000, '예산': 132000, '청양': 132000, '서천': 154000, '태안': 154000 },
  '경상북도': { '경산': 165000, '경주': 176000, '고령': 165000, '구미': 165000, '군위': 165000, '김천': 165000, '문경': 165000, '봉화': 165000, '상주': 165000, '성주': 165000, '안동': 165000, '영양': 165000, '영주': 165000, '영천': 165000, '예천': 165000, '의성': 165000, '청도': 165000, '청송': 165000, '칠곡': 165000, '영덕': 187000, '울진': 187000, '포항': 198000 },
  '경상남도': { '거제': 209000, '거창': 187000, '경남고성': 198000, '김해': 198000, '남해': 209000, '마산': 198000, '밀양': 198000, '사천': 198000, '산청': 198000, '양산': 198000, '의령': 198000, '진주': 198000, '진해': 198000, '창녕': 198000, '창원': 198000, '통영': 209000, '하동': 198000, '함안': 198000, '함양': 198000, '합천': 198000 },
  '전라북도': { '고창': 176000, '군산': 165000, '김제': 165000, '남원': 176000, '무주': 165000, '부안': 165000, '순창': 165000, '완주': 165000, '익산': 165000, '임실': 165000, '장수': 165000, '전주': 165000, '정읍': 165000, '진안': 165000 },
  '전라남도': { '강진': 209000, '고흥': 209000, '곡성': 165000, '광양': 209000, '구례': 165000, '나주': 176000, '담양': 165000, '목포': 198000, '무안': 198000, '보성': 176000, '순천': 209000, '여수': 209000, '영광': 165000, '영암': 198000, '완도': 209000, '장성': 165000, '장흥': 198000, '진도': 209000, '함평': 165000, '해남': 209000, '화순': 198000 },
};
const DELIVERY = (() => {
  const m = {};
  for (const r in DELIVERY_REGIONS) for (const c in DELIVERY_REGIONS[r]) m[c] = DELIVERY_REGIONS[r][c];
  return m;
})();

const TINT_AREAS = [
  { key: 'front',                 label: '전면' },
  { key: 'side_rear_no_coupon',   label: '측후면 (쿠폰 미포함)' },
  { key: 'side_rear_with_coupon', label: '측후면 (쿠폰 포함)' },
  { key: 'sunroof_normal',        label: '썬루프 (일반)' },
  { key: 'sunroof_pano',          label: '썬루프 (파노라마)' },
];
const TINT_PRICES = {
  '루마 GG':    { front: 105000, side_rear_no_coupon:  50000, side_rear_with_coupon:      0, sunroof_normal:  55000, sunroof_pano: 110000 },
  '버텍스 300': { front: 165000, side_rear_no_coupon: 165000, side_rear_with_coupon: 110000, sunroof_normal:  82500, sunroof_pano: 165000 },
  '버텍스 500': { front: 220000, side_rear_no_coupon: 275000, side_rear_with_coupon: 220000, sunroof_normal: 110000, sunroof_pano: 220000 },
  '레이노 F5':  { front: 165000, side_rear_no_coupon: 165000, side_rear_with_coupon: 110000, sunroof_normal:  82500, sunroof_pano: 165000 },
  '레이노 S7':  { front: 220000, side_rear_no_coupon: 275000, side_rear_with_coupon: 220000, sunroof_normal: 110000, sunroof_pano: 220000 },
  '레이노 S9':  { front: 260000, side_rear_no_coupon: 365000, side_rear_with_coupon: 310000, sunroof_normal: 150000, sunroof_pano: 275000 },
};
const ACCESSORIES = {
  blackbox: { 'DF7 (딥플라이)': 175000, 'DF9 (딥플라이)': 220000, 'LX8800 (파인드라이브)': 220000, 'Z1000 (아이나비)': 240000, 'QXD8000 (아이나비)': 446000 },
  navi:     { 'RG-i8 (아이나비)': 220000, 'RG-i8 + 후방카메라': 308000 },
  hipass:   { 'SET-550 (엠피온)': 110000 },
};

const COLORS_EXT = [
  { value: '', label: '선택', price: 0 },
  { value: '화이트', label: '화이트 (기본)', price: 0 },
  { value: '블랙', label: '블랙 (기본)', price: 0 },
  { value: '그레이', label: '그레이 (기본)', price: 0 },
  { value: '실버 메탈릭', label: '실버 메탈릭 (+50,000)', price: 50000 },
  { value: '펄 화이트', label: '펄 화이트 (+50,000)', price: 50000 },
  { value: '매트 그레이', label: '매트 그레이 (+300,000)', price: 300000 },
];
const COLORS_INT = [
  { value: '', label: '선택', price: 0 },
  { value: '블랙', label: '블랙 (기본)', price: 0 },
  { value: '그레이', label: '그레이 (기본)', price: 0 },
  { value: '베이지', label: '베이지 (기본)', price: 0 },
  { value: '브라운', label: '브라운 (기본)', price: 0 },
  { value: '투톤', label: '투톤 (+500,000)', price: 500000 },
];

// ===== 데이터 로드 =====
let VEHICLES_FLAT = [];
let VEHICLE_CATALOG = {};
const CATALOG_CACHE = {};
let selectedPackages = new Set();

async function loadCatalog() {
  const res = await fetch(`./src/data/vehicles.json?t=${Date.now()}`);
  const all = await res.json();
  VEHICLES_FLAT = all.filter((v) => CURRENT_LINEUP[v.brand]?.includes(v.model));
  VEHICLE_CATALOG = {};
  for (const v of VEHICLES_FLAT) {
    VEHICLE_CATALOG[v.brand] ??= {};
    VEHICLE_CATALOG[v.brand][v.model] ??= [];
    VEHICLE_CATALOG[v.brand][v.model].push(v);
  }
  console.log(`[wel2] 차량 ${VEHICLES_FLAT.length} 대 로드`);
}

async function loadChassisCatalog(model, trim) {
  let chassis = MODEL_TO_CHASSIS[model];
  if (!chassis) return null;
  if (trim && /하이브리드/.test(trim)) {
    const hybridChassis = `${chassis}_hybrid`;
    if (CATALOG_CACHE[hybridChassis] !== undefined) return CATALOG_CACHE[hybridChassis];
    try {
      const r = await fetch(`./src/data/car-master/${hybridChassis}.json`);
      if (r.ok) { const d = await r.json(); CATALOG_CACHE[hybridChassis] = d; return d; }
    } catch {}
  }
  if (CATALOG_CACHE[chassis] !== undefined) return CATALOG_CACHE[chassis];
  try {
    const r = await fetch(`./src/data/car-master/${chassis}.json`);
    if (!r.ok) { CATALOG_CACHE[chassis] = null; return null; }
    const d = await r.json();
    CATALOG_CACHE[chassis] = d;
    return d;
  } catch { CATALOG_CACHE[chassis] = null; return null; }
}

async function loadCompanyConfig() {
  const params = new URLSearchParams(location.search);
  const sub = location.hostname.split('.')[0];
  const candidates = [];
  if (params.get('c')) candidates.push(params.get('c'));
  if (sub && !['welrix','localhost'].includes(sub) && !/^\d/.test(sub)) candidates.push(sub);
  candidates.push('welrix');
  for (const id of candidates) {
    try {
      const r = await fetch(`./src/data/company-config/${id}.json`);
      if (r.ok) { const cfg = await r.json(); setCompanyConfig(cfg); console.log(`[wel2] config: ${cfg.name}`); return cfg; }
    } catch {}
  }
  return null;
}

// ===== 상태 =====
const state = {
  cust: { name: '', tel: '', type: '개인', credit: '중신용' },
  vehicle: {
    maker: '', model: '', trim: '', basePrice: 0,
    disp: 0, fuel: '', tax_exempt: '과세', group: '',
    colorExt: '', colorExtPrice: 0,
    colorInt: '', colorIntPrice: 0,
    deliveryArea: '서울', deliveryFee: 99000,
    tint: '루마 GG', tintAreas: new Set(['front', 'side_rear_with_coupon']), tintFee: 0,
    blackbox: '', blackboxFee: 0,
    navi: '', naviFee: 0,
    hipass: '', hipassFee: 0,
    optPrice: 0, discount: 0, etc: 0,
  },
  insurance: { property: '1억', extraDriver: '없음', exec: '미가입',
               injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
  feeRate: 5.0,
  svc: '웰스 Basic',
  // 공통 조건 (4기간 동일 적용)
  km: 2, dep: 10, pre: 0,
  // 4기간 send 체크
  send: { 24: true, 36: true, 48: true, 60: true },
};

// ===== 유틸 =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
const krw = (n) => `${fmt(n)}원`;

// ===== Dropdown 초기 채우기 =====
function buildBrandOptions() {
  const sel = $('#f-maker');
  sel.innerHTML = '<option value="">선택</option>' +
    Object.keys(CURRENT_LINEUP).map((b) => `<option value="${b}">${b}</option>`).join('');
}
function buildModelOptions() {
  const maker = state.vehicle.maker;
  const sel = $('#f-model');
  const ordered = (CURRENT_LINEUP[maker] || []).filter((m) => VEHICLE_CATALOG[maker]?.[m]);
  sel.innerHTML = '<option value="">선택</option>' +
    ordered.map((m) => {
      const v = VEHICLE_CATALOG[maker][m][0];
      return `<option value="${m}">${v?.model_name_kr || m}</option>`;
    }).join('');
}
function buildEngineOptions() {
  const list = VEHICLE_CATALOG[state.vehicle.maker]?.[state.vehicle.model] || [];
  const engines = [...new Set(list.map((v) => v.engine_label).filter(Boolean))];
  const sel = $('#f-engine');
  sel.innerHTML = '<option value="">선택</option>' +
    engines.map((e) => `<option value="${e}">${e}</option>`).join('');
}
function buildTrimOptions() {
  const list = VEHICLE_CATALOG[state.vehicle.maker]?.[state.vehicle.model] || [];
  const eng = state.vehicle.engine;
  const filtered = list.filter((v) => v.engine_label === eng);
  const sel = $('#f-trim');
  sel.innerHTML = '<option value="">선택</option>' +
    filtered.map((v) =>
      `<option value="${v.trim}">${v.trim_detail} · ${krw(v.price)}</option>`
    ).join('');
}

function buildStaticDropdowns() {
  // 색상
  $('#f-color-ext').innerHTML = COLORS_EXT.map((c) => `<option value="${c.value}|${c.price}">${c.label}</option>`).join('');
  $('#f-color-int').innerHTML = COLORS_INT.map((c) => `<option value="${c.value}|${c.price}">${c.label}</option>`).join('');

  // 탁송 — 광역시 그룹 평면
  const deliveryOpts = ['<option value="">선택</option>'];
  for (const region of Object.keys(DELIVERY_REGIONS)) {
    deliveryOpts.push(`<optgroup label="${region}">`);
    for (const city of Object.keys(DELIVERY_REGIONS[region])) {
      const fee = DELIVERY_REGIONS[region][city];
      const label = fee > 0 ? `${city} (+${fmt(fee)}원)` : `${city} (무료)`;
      deliveryOpts.push(`<option value="${city}">${label}</option>`);
    }
    deliveryOpts.push(`</optgroup>`);
  }
  $('#f-delivery').innerHTML = deliveryOpts.join('');
  $('#f-delivery').value = '서울';

  // 선팅 (제품만)
  $('#f-tint').innerHTML = '<option value="">없음</option>' +
    Object.keys(TINT_PRICES).map((p) => `<option value="${p}" ${p === '루마 GG' ? 'selected' : ''}>${p}</option>`).join('');

  // 블박
  $('#f-blackbox').innerHTML = '<option value="">없음</option>' +
    Object.keys(ACCESSORIES.blackbox).map((k) => `<option value="${k}">${k} (+${fmt(ACCESSORIES.blackbox[k])}원)</option>`).join('');

  // 내비·하이패스 통합
  $('#f-navi').innerHTML = '<option value="">없음</option>' +
    Object.keys(ACCESSORIES.navi).map((k) => `<option value="navi:${k}">내비 — ${k} (+${fmt(ACCESSORIES.navi[k])}원)</option>`).join('') +
    Object.keys(ACCESSORIES.hipass).map((k) => `<option value="hipass:${k}">하이패스 — ${k} (+${fmt(ACCESSORIES.hipass[k])}원)</option>`).join('');
}

// ===== 4기간 카드 렌더 =====
function renderTermCards(monthly) {
  const grid = $('#terms-grid');
  if (!grid) return;
  const html = [24, 36, 48, 60].map((term, i) => {
    const m = monthly[i];
    const sent = state.send[term] !== false;
    const recommended = sent && (term === 60);  // 60M 기본 추천
    return `
      <div class="term-card ${sent ? '' : 'unchecked'} ${recommended ? 'recommended' : ''}">
        <label class="term-card__check">
          <input type="checkbox" data-term="${term}" ${sent ? 'checked' : ''} />
        </label>
        <div class="term-card__term">${term}개월</div>
        <div class="term-card__monthly">${fmt(m?.monthly || 0)}<em>원</em></div>
        <div class="term-card__divider"></div>
        <div class="term-card__row"><span>만기인수</span><b>${fmt(m?.residualAmt || 0)}</b></div>
        <div class="term-card__row"><span>보증금</span><b>${fmt(m?.depAmt || 0)}</b></div>
        <div class="term-card__row"><span>선납금</span><b>${fmt(m?.preAmt || 0)}</b></div>
      </div>
    `;
  }).join('');
  grid.innerHTML = html;
  // send 체크 핸들러
  $$('#terms-grid input[type=checkbox]').forEach((el) => {
    el.addEventListener('change', (e) => {
      const t = +e.target.dataset.term;
      state.send[t] = e.target.checked;
      render();
    });
  });
}

// ===== 손님 텍스트 견적 =====
function buildQuoteText(monthly, totalPrice) {
  const v = state.vehicle;
  if (!v.trim) return '차량을 선택하면 견적이 산출됩니다.';
  const lines = [];
  const cust = state.cust.name ? `${state.cust.name} 님 ` : '';
  lines.push(`【 ${cust}장기렌터카 견적 】`);
  lines.push('');
  lines.push(`차량 : ${v.trim}`);
  if (v.colorExt || v.colorInt) lines.push(`색상 : ${v.colorExt || '-'} / ${v.colorInt || '-'}`);
  if (selectedPackages.size) lines.push(`옵션 : ${[...selectedPackages].join(', ')}`);
  lines.push(`차량가격 : ${krw(totalPrice)}`);
  lines.push('');
  lines.push(`보증금 ${state.dep}% / 선납 ${state.pre}% / 약정 ${state.km}만km`);
  lines.push('');
  for (let i = 0; i < 4; i++) {
    const term = [24, 36, 48, 60][i];
    if (state.send[term] === false) continue;
    const m = monthly[i];
    lines.push(`[ ${term}개월 ] 월 ${fmt(m.monthly)}원`);
    lines.push(`  만기인수 ${fmt(m.residualAmt)}원 / 보증금 ${fmt(m.depAmt)}원 / 선납 ${fmt(m.preAmt)}원`);
  }
  lines.push('');
  lines.push('— 웰릭스 모빌리티');
  return lines.join('\n');
}

// ===== 입력 → 상태 갱신 =====
function readInputs() {
  const v = state.vehicle;
  v.maker = $('#f-maker').value;
  v.model = $('#f-model').value;
  v.engine = $('#f-engine').value;
  v.trim = $('#f-trim').value;
  // 차량 메타
  if (v.trim) {
    const row = VEHICLES_FLAT.find((x) => x.trim === v.trim);
    if (row) {
      v.basePrice = row.price;
      v.disp = row.disp;
      v.fuel = row.fuel;
      v.tax_exempt = row.tax_exempt;
      v.group = row.group;
      v.multi_seat = row.multi_seat;
      v.r24 = row.r24; v.r36 = row.r36; v.r48 = row.r48; v.r60 = row.r60;
      v.buyback_apply = row.buyback_apply;
    }
  }
  // 색상
  const [cextV, cextP] = ($('#f-color-ext').value || '|0').split('|');
  v.colorExt = cextV; v.colorExtPrice = +cextP || 0;
  const [cintV, cintP] = ($('#f-color-int').value || '|0').split('|');
  v.colorInt = cintV; v.colorIntPrice = +cintP || 0;
  v.colorPrice = v.colorExtPrice + v.colorIntPrice;
  // 탁송
  v.deliveryArea = $('#f-delivery').value;
  v.deliveryFee = DELIVERY[v.deliveryArea] || 0;
  // 용품
  v.tint = $('#f-tint').value;
  v.blackbox = $('#f-blackbox').value;
  v.blackboxFee = ACCESSORIES.blackbox[v.blackbox] || 0;
  const naviRaw = $('#f-navi').value;
  v.navi = ''; v.naviFee = 0; v.hipass = ''; v.hipassFee = 0;
  if (naviRaw.startsWith('navi:')) {
    v.navi = naviRaw.slice(5);
    v.naviFee = ACCESSORIES.navi[v.navi] || 0;
  } else if (naviRaw.startsWith('hipass:')) {
    v.hipass = naviRaw.slice(7);
    v.hipassFee = ACCESSORIES.hipass[v.hipass] || 0;
  }
  // 선팅 부위 (기본 2개)
  if (!(v.tintAreas instanceof Set)) v.tintAreas = new Set(v.tintAreas || []);
  const tintInputs = $$('input[data-tint-area]');
  if (tintInputs.length > 0) {
    v.tintAreas = new Set();
    tintInputs.forEach((el) => { if (el.checked) v.tintAreas.add(el.dataset.tintArea); });
  }
  const tp = TINT_PRICES[v.tint] || {};
  v.tintFee = [...v.tintAreas].reduce((s, k) => s + (tp[k] || 0), 0);

  // 보험·점검
  state.insurance.property = $('#f-ins-property').value;
  state.insurance.extraDriver = $('#f-ins-extra').value;
  state.insurance.exec = $('#f-ins-exec').value;
  state.svc = $('#f-svc').value;

  // 고객
  state.cust.name = $('#f-cust-name').value;
  state.cust.tel = $('#f-cust-tel').value;
  state.cust.type = $('#f-cust-type').value;
  state.cust.credit = $('#f-credit').value;

  // 공통 조건
  state.km = +$('#f-km').value || 2;
  state.dep = +$('#f-dep').value || 0;
  state.pre = +$('#f-pre').value || 0;

  // 옵션 패키지 합계
  v.optPrice = computePkgTotal() + v.colorPrice;
}

function computePkgTotal() {
  const model = state.vehicle.model;
  if (!model) return 0;
  const chassis = MODEL_TO_CHASSIS[model];
  if (!chassis) return 0;
  const catalog = CATALOG_CACHE[chassis] || CATALOG_CACHE[`${chassis}_hybrid`];
  if (!catalog) return 0;
  let sum = 0;
  for (const tn in catalog.trims) {
    for (const g of catalog.trims[tn].select_groups || []) {
      if (selectedPackages.has(g.name)) sum += (g.price || 0);
    }
  }
  return sum;
}

// ===== 계산 =====
function compute() {
  const v = state.vehicle;
  if (!v.maker || !v.model || !v.trim) {
    return { totalPrice: 0, monthly: [0,1,2,3].map(() => ({ monthly: 0, residualAmt: 0, depAmt: 0, preAmt: 0 })) };
  }
  const vRow = VEHICLES_FLAT.find((x) => x.trim === v.trim);
  if (!vRow) return { totalPrice: 0, monthly: [0,1,2,3].map(() => ({ monthly: 0, residualAmt: 0, depAmt: 0, preAmt: 0 })) };

  const monthly = [24, 36, 48, 60].map((term) => {
    const r = calcQuote({
      vehicle: vRow,
      options: {
        optPrice: v.optPrice, discount: v.discount,
        deliveryFee: v.deliveryFee, tintFee: v.tintFee,
        blackboxFee: v.blackboxFee, naviFee: v.naviFee, hipassFee: v.hipassFee,
        etc: v.etc,
      },
      contract: { term, km: state.km + '만km', dep: state.dep, pre: state.pre },
      customer: { creditGrade: state.cust.credit },
      insurance: state.insurance,
      fees: { feeRatePct: state.feeRate, svc: state.svc },
    });
    return {
      term, monthly: r.monthly,
      residualAmt: r.residualAmt, depAmt: r.depositAmt, preAmt: r.prePayAmt,
    };
  });
  return { totalPrice: vRow.price + v.optPrice, monthly };
}

// ===== 렌더 =====
function render() {
  const v = state.vehicle;
  const { totalPrice, monthly } = compute();

  // 차량 요약
  $('#vehicle-summary').hidden = !v.trim;
  $('#v-price').textContent = krw(totalPrice);
  $('#v-meta').textContent = v.trim ? `${v.fuel} ${v.disp}cc` : '';

  // 결과 헤더
  $('#result-brand').textContent = v.model_name_kr || (v.trim ? v.trim.split(' ').slice(0, 4).join(' ') : '차량 미선택');
  $('#result-trim').textContent = v.trim_detail || '';
  $('#result-price').textContent = krw(totalPrice);

  // 4기간 카드
  renderTermCards(monthly);

  // 손님 텍스트
  $('#quote-text').textContent = buildQuoteText(monthly, totalPrice);
}

function onAnyInput() { readInputs(); render(); }

// ===== 옵션 패키지 렌더 =====
async function loadAndRenderPackages() {
  const v = state.vehicle;
  if (!v.trim) {
    $('#pkg-card').hidden = true;
    return;
  }
  selectedPackages = new Set();
  const catalog = await loadChassisCatalog(v.model, v.trim);
  const trimData = catalog?.trims?.[v.trim_key_for_catalog] || Object.values(catalog?.trims || {})[0];
  const groups = trimData?.select_groups || [];
  if (!groups.length) { $('#pkg-card').hidden = true; return; }
  $('#pkg-card').hidden = false;
  $('#pkg-grid').innerHTML = groups.map((g) =>
    `<div class="pkg-card" data-pkg="${g.name}">
       <span class="pkg-card__name">${g.name}</span>
       <span class="pkg-card__price">+${fmt(g.price || 0)}원</span>
     </div>`
  ).join('');
  $$('#pkg-grid .pkg-card').forEach((el) => {
    el.addEventListener('click', () => {
      const name = el.dataset.pkg;
      if (selectedPackages.has(name)) selectedPackages.delete(name);
      else selectedPackages.add(name);
      el.classList.toggle('selected');
      onAnyInput();
    });
  });
}

// ===== 클립보드 복사 =====
async function copyQuoteText() {
  try {
    await navigator.clipboard.writeText($('#quote-text').textContent);
    alert('견적 텍스트가 복사되었습니다');
  } catch { alert('복사 실패'); }
}

// ===== 이벤트 =====
function attachListeners() {
  $('#f-maker').addEventListener('change', () => {
    state.vehicle.maker = $('#f-maker').value;
    buildModelOptions();
    state.vehicle.model = ''; state.vehicle.engine = ''; state.vehicle.trim = '';
    buildEngineOptions(); buildTrimOptions(); onAnyInput();
  });
  $('#f-model').addEventListener('change', () => {
    state.vehicle.model = $('#f-model').value;
    state.vehicle.engine = ''; state.vehicle.trim = '';
    buildEngineOptions(); buildTrimOptions(); onAnyInput();
  });
  $('#f-engine').addEventListener('change', () => {
    state.vehicle.engine = $('#f-engine').value;
    state.vehicle.trim = '';
    buildTrimOptions(); onAnyInput();
  });
  $('#f-trim').addEventListener('change', () => {
    state.vehicle.trim = $('#f-trim').value;
    // catalog 매칭용 키 — trim_detail + engine_label
    const row = VEHICLES_FLAT.find((x) => x.trim === state.vehicle.trim);
    if (row) state.vehicle.trim_key_for_catalog = `${row.trim_detail} ${row.engine_label}`;
    loadAndRenderPackages();
    onAnyInput();
  });

  // 모든 기타 입력 → onAnyInput
  ['f-color-ext','f-color-int','f-delivery','f-tint','f-blackbox','f-navi',
   'f-ins-property','f-ins-extra','f-ins-exec','f-svc',
   'f-cust-name','f-cust-tel','f-cust-type','f-credit',
   'f-km','f-dep','f-pre'].forEach((id) => {
    const el = $('#' + id); if (!el) return;
    el.addEventListener('input', onAnyInput);
    el.addEventListener('change', onAnyInput);
  });

  // 복사 버튼
  $('#btn-copy')?.addEventListener('click', copyQuoteText);
  $('#btn-copy-text')?.addEventListener('click', copyQuoteText);
}

// ===== Init =====
(async function init() {
  await loadCompanyConfig();
  await loadCatalog();
  buildBrandOptions();
  buildStaticDropdowns();
  attachListeners();
  readInputs();
  render();
  console.log('[wel2] 견적기 v2 — 영업자 워크플로');
})();
