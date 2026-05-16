// wel2 견적 모듈 — wel 의 데이터/로직 활용 + estimator_4 톤
import { calcQuote, setCompanyConfig } from './src/lib/calc.js';

// ============ 데이터 (wel/app.js 에서 가져옴, 검증된 값) ============
const DELIVERY_REGIONS = {
  '광역시': { '서울': 99000, '인천': 99000, '대전': 121000, '광주': 176000, '대구': 176000, '부산': 198000, '울산': 198000 },
  '경기도': { '수원': 77000, '평택': 66000, '오산': 66000, '화성': 66000, '용인': 88000, '성남': 88000, '안양': 88000, '안성': 88000, '의왕': 88000, '하남': 88000, '경기광주': 88000, '군포': 88000, '과천': 88000, '안산': 99000, '시흥': 99000, '구리': 99000, '광명': 99000, '부천': 99000, '고양': 110000, '김포': 110000, '남양주': 110000, '동두천': 110000, '양주': 110000, '양평': 110000, '여주': 110000, '의정부': 110000, '이천': 110000, '가평': 121000, '파주': 121000, '연천': 132000, '포천': 132000 },
  '강원도': { '원주': 121000, '춘천': 143000, '평창': 154000, '홍천': 154000, '횡성': 154000, '양구': 165000, '영월': 165000, '강릉': 187000, '동해': 187000, '삼척': 187000, '양양': 187000, '인제': 187000, '정선': 187000, '철원': 187000, '태백': 187000, '화천': 187000, '고성': 198000, '속초': 198000 },
  '충청북도': { '청주': 121000, '청원': 121000, '음성': 121000, '진천': 121000, '증평': 121000, '괴산': 132000, '보은': 132000, '영동': 132000, '옥천': 132000, '충주': 132000, '단양': 143000, '제천': 143000 },
  '충청남도': { '천안': 110000, '아산': 110000, '공주': 121000, '당진': 121000, '연기': 121000, '홍성': 121000, '부여': 132000, '서산': 132000, '예산': 132000, '청양': 132000, '논산': 143000, '금산': 143000, '보령': 143000, '서천': 154000, '태안': 154000 },
  '경상북도': { '경산': 165000, '경주': 176000, '고령': 165000, '구미': 165000, '군위': 165000, '김천': 165000, '문경': 165000, '봉화': 165000, '상주': 165000, '성주': 165000, '안동': 165000, '영양': 165000, '영주': 165000, '영천': 165000, '예천': 165000, '의성': 165000, '청도': 165000, '청송': 165000, '칠곡': 165000, '영덕': 187000, '울진': 187000, '포항': 198000 },
  '경상남도': { '거제': 209000, '거창': 187000, '경남고성': 198000, '김해': 198000, '남해': 209000, '마산': 198000, '밀양': 198000, '사천': 198000, '산청': 198000, '양산': 198000, '의령': 198000, '진주': 198000, '진해': 198000, '창녕': 198000, '창원': 198000, '통영': 209000, '하동': 198000, '함안': 198000, '함양': 198000, '합천': 198000 },
  '전라북도': { '고창': 176000, '군산': 165000, '김제': 165000, '남원': 176000, '무주': 165000, '부안': 165000, '순창': 165000, '완주': 165000, '익산': 165000, '임실': 165000, '장수': 165000, '전주': 165000, '정읍': 165000, '진안': 165000 },
  '전라남도': { '강진': 209000, '고흥': 209000, '곡성': 165000, '광양': 209000, '구례': 165000, '나주': 176000, '담양': 165000, '목포': 198000, '무안': 198000, '보성': 176000, '순천': 209000, '여수': 209000, '영광': 165000, '영암': 198000, '완도': 209000, '장성': 165000, '장흥': 198000, '진도': 209000, '함평': 165000, '해남': 209000, '화순': 198000 },
};
const FLAT_DELIVERY = (() => {
  const m = {};
  for (const r in DELIVERY_REGIONS) for (const c in DELIVERY_REGIONS[r]) m[c] = DELIVERY_REGIONS[r][c];
  return m;
})();

const TINT_AREAS = [
  { key: 'front',                 label: '전면' },
  { key: 'side_rear_no_coupon',   label: '측후면(쿠폰 X)' },
  { key: 'side_rear_with_coupon', label: '측후면(쿠폰 O)' },
  { key: 'sunroof_normal',        label: '썬루프 일반' },
  { key: 'sunroof_pano',          label: '썬루프 파노' },
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
  blackbox: {
    'DF7 (딥플라이)': 175000, 'DF9 (딥플라이)': 220000,
    'LX8800 (파인드라이브)': 220000,
    'Z1000 (아이나비)': 240000, 'QXD8000 (아이나비)': 446000,
  },
  navi: {
    'RG-i8 (아이나비)': 220000, 'RG-i8 + 후방카메라': 308000,
  },
  hipass: {
    'SET-550 (엠피온)': 110000,
  },
};

const COLOR_INT = [
  { value: '|0',           label: '내장 선택', price: 0 },
  { value: '블랙|0',       label: '블랙 (기본)', price: 0 },
  { value: '그레이|0',     label: '그레이 (기본)', price: 0 },
  { value: '베이지|0',     label: '베이지 (기본)', price: 0 },
  { value: '브라운|0',     label: '브라운 (기본)', price: 0 },
  { value: '투톤|500000',  label: '투톤 (+500,000원)', price: 500000 },
];

// ============ 유틸 ============
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
const krw = (n) => `${fmt(n)}원`;

// 색상 이름 → hex 추정
function guessColor(name) {
  if (!name) return '#e5e5e5';
  const n = name.toLowerCase();
  if (n.includes('블랙') || n.includes('어비스') || n.includes('잉크')) return '#1a1a1a';
  if (n.includes('화이트') || n.includes('아틀라스') || n.includes('스노우')) return '#f5f5f5';
  if (n.includes('펄')) {
    if (n.includes('블루') || n.includes('네이비')) return '#3a5d8f';
    if (n.includes('레드') || n.includes('적')) return '#a83232';
    return '#e8e6e1';
  }
  if (n.includes('그레이') || n.includes('그래핀') || n.includes('실버')) return '#9aa0a6';
  if (n.includes('블루') || n.includes('네이비') || n.includes('스카이')) return '#3a5d8f';
  if (n.includes('레드') || n.includes('적') || n.includes('루비')) return '#a83232';
  if (n.includes('그린') || n.includes('미라지') || n.includes('세이지')) return '#4a6d4e';
  if (n.includes('베이지') || n.includes('샌드')) return '#c9b896';
  if (n.includes('브라운') || n.includes('초콜릿')) return '#5c3d28';
  if (n.includes('매트')) return '#444';
  if (n.includes('투톤')) return 'linear-gradient(90deg, #1a1a1a 50%, #e8e6e1 50%)';
  if (n.includes('아마존')) return '#5a6b58';
  if (n.includes('사이버')) return '#4a4f5a';
  if (n.includes('에코트로닉')) return '#7d8a93';
  return '#9aa0a6';
}
function setSwatch(el, hex) {
  if (!el) return;
  if (hex.startsWith('linear-gradient')) {
    el.style.background = hex;
  } else {
    el.style.backgroundColor = hex;
    el.style.backgroundImage = 'none';
  }
}
// 외장 swatch 갱신 (estimator_4 의 state.color 인덱스 기반)
window.__welrix_updateExtSwatch = (name) => setSwatch($('swatch-ext'), guessColor(name));
window.__welrix_updateIntSwatch = (name) => setSwatch($('swatch-int'), guessColor(name));

// ============ 상태 ============
let VEHICLES = [];
const state = {
  // estimator_4 가 알려준 가격 정보
  vehicle: null,
  // 견적 조건
  cond: {
    credit: '중신용', km: 2, dep: 10, pre: 0,
    deliveryRegion: '광역시', deliveryCity: '서울',
    svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음',
    colorInt: '', colorIntPrice: 0,
  },
  // 선팅
  tint: { product: '루마 GG', areas: new Set(['front', 'side_rear_with_coupon']) },
  // 용품 (블박/내비/하이패스)
  extras: { blackbox: '', navi: '', hipass: '' },
  // 손님/담당자
  cust:  { name: '', tel: '' },
  staff: { name: '', tel: '' },
  // 발송 체크 (시나리오 인덱스 기준)
  send: [true, true, true, true],
  // 4개 시나리오 — 각각 독립적인 기간/보증금/선납금
  scenarios: [
    { term: 24, dep: 10, pre: 0 },
    { term: 36, dep: 10, pre: 0 },
    { term: 48, dep: 10, pre: 0 },
    { term: 60, dep: 10, pre: 0 },
  ],
};

// ============ 초기 로드 ============
async function loadCompanyConfig() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c') || 'welrix';
  try {
    const r = await fetch(`./src/data/company-config/${id}.json`);
    if (r.ok) { const cfg = await r.json(); setCompanyConfig(cfg); window.__welrix_companyConfig = cfg; return cfg; }
  } catch {}
  return null;
}
async function loadVehicles() {
  try {
    const r = await fetch(`./src/data/vehicles.json?t=${Date.now()}`);
    VEHICLES = await r.json();
  } catch {}
}
function findVehicleMeta(brand, model) {
  return VEHICLES.find((v) => v.brand === brand && v.model === model) || {};
}

// ============ UI 초기화 ============
function initDropdowns() {
  // 탁송 — 광역시/도
  $('q-delivery-region').innerHTML = '<option value="">선택</option>' +
    Object.keys(DELIVERY_REGIONS).map((r) => `<option ${r === state.cond.deliveryRegion ? 'selected' : ''}>${r}</option>`).join('');
  rebuildDeliveryCity();
  // 선팅 제품
  $('q-tint-product').innerHTML = '<option value="">없음</option>' +
    Object.keys(TINT_PRICES).map((p) => `<option value="${p}" ${p === state.tint.product ? 'selected' : ''}>${p}</option>`).join('');
  renderTintChips();
  // 용품 — 블박/내비/하이패스
  $('q-blackbox').innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.blackbox).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  $('q-navi').innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.navi).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  $('q-hipass').innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.hipass).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  // 내장 색상 — 트림 선택 전엔 비활성 (estimator_4 syncDropdowns 가 갱신)
  const ddInt = $('dd-color-int');
  if (ddInt) {
    ddInt.innerHTML = COLOR_INT.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    ddInt.disabled = true;  // 초기 비활성
  }
}

function rebuildDeliveryCity() {
  const region = $('q-delivery-region').value;
  const sel = $('q-delivery-city');
  if (!region) { sel.innerHTML = '<option value="">시/군 선택</option>'; return; }
  const cities = DELIVERY_REGIONS[region] || {};
  sel.innerHTML = '<option value="">시/군 선택</option>' +
    Object.entries(cities).map(([c, fee]) =>
      `<option value="${c}" ${c === state.cond.deliveryCity ? 'selected' : ''}>${c} (${fee > 0 ? '+' + fmt(fee) + '원' : '무료'})</option>`
    ).join('');
}

function renderTintChips() {
  const wrap = $('tint-chips');
  const product = $('q-tint-product').value;
  if (!wrap) return;
  if (!product) { wrap.innerHTML = '<span style="font-size:11px; color:#aaa;">제품을 선택하면 부위가 표시됩니다</span>'; return; }
  const priceMap = TINT_PRICES[product] || {};
  wrap.innerHTML = TINT_AREAS.map((a) => {
    const price = priceMap[a.key] || 0;
    const checked = state.tint.areas.has(a.key);
    return `<label class="tint-chip ${checked ? 'on' : ''}">
      <input type="checkbox" data-tint-area="${a.key}" ${checked ? 'checked' : ''} />
      <span class="tn">${a.label}</span>
      <em class="tp">${price > 0 ? '+' + fmt(price) : '무료'}</em>
    </label>`;
  }).join('');
}

// ============ estimator_4 가격 변경 hook ============
window.__welrix_onPriceChange = (data) => {
  state.vehicle = data;
  recompute();
};

// ============ 견적 계산 ============
function renderSummary() {
  const mini = $('qp-summary-mini');
  if (!mini) return;
  const v = state.vehicle;
  const vEl = $('qp-vehicle');
  // 차량 정보가 부분이라도 있으면 표시
  const titleParts = v ? [v.brand, v.model, v.variant, v.trim_name].filter(Boolean) : [];
  if (titleParts.length) {
    vEl.textContent = titleParts.join(' · ');
    vEl.classList.remove('empty');
  } else {
    vEl.textContent = '차량 미선택';
    vEl.classList.add('empty');
  }
  // 가격 (총계는 차량가 + 내장색)
  const totalKrw = v && v.total_manwon ? v.total_manwon * 10000 + (state.cond.colorIntPrice || 0) : 0;
  $('qp-price-num').textContent = totalKrw ? krw(totalKrw) : '';
  // breakdown: 트림 / 옵션 (총계는 상단 가격으로 통합 — 중복 표시 X)
  const trimManwon = v?.trim_price_manwon || 0;
  const optsManwon = v?.options_price_manwon || 0;
  $('qp-bd-trim').textContent = trimManwon ? `${fmt(trimManwon)}만` : '—';
  $('qp-bd-opts').textContent = optsManwon ? `${fmt(optsManwon)}만` : '—';
  // 개소세 라벨
  const taxLabel = $('qp-tax-label');
  if (taxLabel && v && v.tax_rate) {
    taxLabel.textContent = v.tax_rate === '3_5' ? '3.5%' : '5%';
  }
  // 옵션 — 뱃지로 노출 (라벨 분리 → wrap 시 chips는 같은 col에서 시작)
  const opts = (v && v.options) || [];
  $('qp-summary-opts').innerHTML = opts.length
    ? `<span class="qp-opt-label">옵션</span><div class="qp-opt-chips">${opts.map((n) => `<span class="badge badge--brand">${n}</span>`).join('')}</div>`
    : '';
  // 색상
  const colorBits = [];
  if (v && v.colorExt) {
    const hex = guessColor(v.colorExt);
    colorBits.push(`<span class="color-item"><span class="swatch" style="background:${hex}"></span>외장 ${v.colorExt}</span>`);
  }
  if (state.cond.colorInt) {
    const hex = guessColor(state.cond.colorInt);
    colorBits.push(`<span class="color-item"><span class="swatch" style="background:${hex}"></span>내장 ${state.cond.colorInt}</span>`);
  }
  $('qp-summary-colors').innerHTML = colorBits.join('');
}

function recompute() {
  // 부분 선택이어도 요약은 즉시 반영
  renderSummary();
  if (!state.vehicle || !state.vehicle.total_manwon) {
    renderEmpty();
    return;
  }
  const v = state.vehicle;
  const meta = findVehicleMeta(v.brand, v.model);
  // 회사 옵션가 (선팅) — wel calc.js 에 itemsFee 로 전달
  const tintPrice = TINT_PRICES[state.tint.product] || {};
  const tintFee = [...state.tint.areas].reduce((s, k) => s + (tintPrice[k] || 0), 0);
  const deliveryFee = FLAT_DELIVERY[state.cond.deliveryCity] || 0;
  // 용품 합계 (블박/내비/하이패스)
  const blackboxFee = ACCESSORIES.blackbox[state.extras.blackbox] || 0;
  const naviFee = ACCESSORIES.navi[state.extras.navi] || 0;
  const hipassFee = ACCESSORIES.hipass[state.extras.hipass] || 0;
  const itemsFee = tintFee + blackboxFee + naviFee + hipassFee;

  const totalKrw = v.total_manwon * 10000 + state.cond.colorIntPrice;

  const vehicleRow = {
    brand: meta.brand || v.brand,
    model: meta.model || v.model,
    trim: meta.trim || `${v.brand} ${v.model} ${v.trim_name}`,
    price: totalKrw,
    disp: meta.disp || 2000,
    fuel: meta.fuel || '가솔린',
    tax_exempt: v.tax_rate === '5%' ? '과세' : (meta.tax_exempt || '과세'),
    group: meta.group || 'A군',
    multi_seat: meta.multi_seat,
    r24: meta.r24 ?? 0.65, r36: meta.r36 ?? 0.55, r48: meta.r48 ?? 0.48, r60: meta.r60 ?? 0.40,
    buyback_apply: meta.buyback_apply ?? 0,
  };

  const monthly = state.scenarios.map((sc, idx) => {
    const r = calcQuote({
      vehicle: vehicleRow,
      options: { optPrice: 0, discount: 0, deliveryFee, itemsFee, etc: 0 },
      contract: { term: sc.term, km: state.cond.km + '만km', dep: +sc.dep || 0, pre: +sc.pre || 0 },
      customer: { creditGrade: state.cond.credit },
      insurance: { property: state.cond.insProperty, extraDriver: state.cond.extraDriver, exec: '미가입',
                   injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: 5.0, svc: state.cond.svc },
    });
    return { idx, term: sc.term, dep: sc.dep, pre: sc.pre, monthly: r.monthly, residualAmt: r.residualAmt, depAmt: r.depositAmt, preAmt: r.prePayAmt };
  });

  renderTerms(monthly);
  renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, itemsFee - tintFee);
}

function renderEmpty() {
  // 4기간 카드 골격은 항상 노출 (값만 빈 placeholder)
  const grid = $('terms-grid');
  if (grid) {
    grid.innerHTML = state.scenarios.map((sc, idx) => `
      <div class="term-card term-card--empty" data-idx="${idx}">
        <div class="term-card__head">
          <select class="term-card__term-dd" disabled><option>${sc.term}개월</option></select>
          <label class="term-card__check"><input type="checkbox" checked disabled/></label>
        </div>
        <div class="term-card__monthly">—<em>원</em></div>
        <div class="term-card__cond">
          <label><span>보증금</span><span class="pct-cell pct-cell--static">${sc.dep}%</span></label>
          <label><span>선납금</span><span class="pct-cell pct-cell--static">${sc.pre}%</span></label>
        </div>
        <div class="term-card__row"><span>만기인수</span><b>—</b></div>
        <div class="term-card__row"><span>보증금</span><b>—</b></div>
        <div class="term-card__row"><span>선납금</span><b>—</b></div>
      </div>
    `).join('');
  }
  // 요약은 renderSummary가 별도로 처리 (recompute에서 호출됨, 또는 직접 호출)
  $('quote-doc').innerHTML = '<div class="quote-doc__empty">차량과 트림을 선택하면 견적서가 생성됩니다.</div>';
}
// 페이지 로드 시 즉시 빈 상태 그리기
renderEmpty();
// renderSummary는 renderEmpty와 별도로 항상 노출 (초기 차량 미선택 텍스트 표시)
if (typeof renderSummary === 'function') renderSummary();

const TERM_OPTIONS = [12, 24, 36, 48, 60];
function renderTerms(monthly) {
  const grid = $('terms-grid');
  grid.innerHTML = monthly.map((m) => {
    const sent = state.send[m.idx] !== false;
    return `
      <div class="term-card ${sent ? '' : 'unchecked'}" data-idx="${m.idx}">
        <div class="term-card__head">
          <select class="term-card__term-dd" data-idx="${m.idx}">
            ${TERM_OPTIONS.map((t) => `<option value="${t}" ${t === m.term ? 'selected' : ''}>${t}개월</option>`).join('')}
          </select>
          <label class="term-card__check"><input type="checkbox" data-idx="${m.idx}" ${sent ? 'checked' : ''}/></label>
        </div>
        <div class="term-card__monthly">${fmt(m.monthly)}<em>원</em></div>
        <div class="term-card__cond">
          <label>
            <span>보증금</span>
            <span class="pct-cell"><input type="number" class="term-card__dep" data-idx="${m.idx}" value="${m.dep}" min="0" max="100" />%</span>
          </label>
          <label>
            <span>선납금</span>
            <span class="pct-cell"><input type="number" class="term-card__pre" data-idx="${m.idx}" value="${m.pre}" min="0" max="100" />%</span>
          </label>
        </div>
        <div class="term-card__row"><span>만기인수</span><b>${fmt(m.residualAmt)}</b></div>
        <div class="term-card__row"><span>보증금</span><b>${fmt(m.depAmt)}</b></div>
        <div class="term-card__row"><span>선납금</span><b>${fmt(m.preAmt)}</b></div>
      </div>
    `;
  }).join('');
  // term dropdown 변경
  grid.querySelectorAll('.term-card__term-dd').forEach((el) => {
    el.addEventListener('change', (e) => {
      state.scenarios[+e.target.dataset.idx].term = +e.target.value;
      recompute();
    });
  });
  // 보증금/선납금 입력
  grid.querySelectorAll('.term-card__dep').forEach((el) => {
    el.addEventListener('change', (e) => {
      state.scenarios[+e.target.dataset.idx].dep = +e.target.value || 0;
      recompute();
    });
  });
  grid.querySelectorAll('.term-card__pre').forEach((el) => {
    el.addEventListener('change', (e) => {
      state.scenarios[+e.target.dataset.idx].pre = +e.target.value || 0;
      recompute();
    });
  });
  // 발송 체크
  grid.querySelectorAll('input[type=checkbox]').forEach((el) => {
    el.addEventListener('change', (e) => {
      state.send[+e.target.dataset.idx] = e.target.checked;
      recompute();
    });
  });
}

// ============ 견적서 HTML (정식 미리보기, wel preview-doc 톤) ============
function renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, accessoryFee = 0) {
  const v = state.vehicle;
  const today = new Date().toLocaleDateString('ko-KR');
  const sentList = monthly.filter((m) => state.send[m.idx] !== false);
  const html = `
    <div class="quote-doc">
      <div class="quote-doc__brand">
        <div>
          <div class="quote-doc__brand-name">웰릭스 모빌리티</div>
          <div style="font-size:11px; color:#888;">신차 장기렌터카 견적</div>
        </div>
        <div>
          <div class="quote-doc__doc-title">QUOTATION</div>
          <div class="quote-doc__meta">${today}</div>
        </div>
      </div>

      <div class="quote-doc__section">
        <div class="quote-doc__section-title">차량 정보</div>
        <table class="quote-doc__table">
          <tr><th>모델</th><td>${v.brand} ${v.model} ${v.variant || ''}</td></tr>
          <tr><th>트림</th><td>${v.trim_name}</td></tr>
          <tr><th>색상</th><td>${state.cond.colorInt || '-'}</td></tr>
          <tr><th>차량가격</th><td class="price">${krw(totalKrw)}</td></tr>
          <tr><th>탁송</th><td>${state.cond.deliveryCity} (${krw(deliveryFee)})</td></tr>
          ${tintFee ? `<tr><th>선팅</th><td>${state.tint.product} · ${[...state.tint.areas].map((k) => TINT_AREAS.find((a) => a.key === k)?.label).filter(Boolean).join(', ')} (+${krw(tintFee)})</td></tr>` : ''}
          ${accessoryFee ? `<tr><th>용품</th><td>${[state.extras.blackbox, state.extras.navi, state.extras.hipass].filter(Boolean).join(', ')} (+${krw(accessoryFee)})</td></tr>` : ''}
        </table>
      </div>

      <div class="quote-doc__section">
        <div class="quote-doc__section-title">공통 조건</div>
        <table class="quote-doc__table">
          <tr><th>신용</th><td>${state.cond.credit}</td><th>약정</th><td>${state.cond.km}만km/년</td></tr>
          <tr><th>점검</th><td>${state.cond.svc}</td><th>대물</th><td>${state.cond.insProperty}</td></tr>
        </table>
      </div>

      <div class="quote-doc__section">
        <div class="quote-doc__section-title">시나리오 비교 (${sentList.length}개)</div>
        <table class="quote-doc__terms-table">
          <thead>
            <tr>
              <th class="row-label">구분</th>
              ${monthly.map((m) => `<th class="${state.send[m.idx] !== false ? '' : 'col-off'}">${m.term}개월<br><small>보${m.dep}% / 선${m.pre}%</small></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="monthly">
              <th>월 대여료</th>
              ${monthly.map((m) => `<td class="${state.send[m.idx] !== false ? '' : 'col-off'}">${fmt(m.monthly)}원</td>`).join('')}
            </tr>
            <tr>
              <td class="row-label">만기인수</td>
              ${monthly.map((m) => `<td class="${state.send[m.idx] !== false ? '' : 'col-off'}">${fmt(m.residualAmt)}</td>`).join('')}
            </tr>
            <tr>
              <td class="row-label">보증금</td>
              ${monthly.map((m) => `<td class="${state.send[m.idx] !== false ? '' : 'col-off'}">${fmt(m.depAmt)}</td>`).join('')}
            </tr>
            <tr>
              <td class="row-label">선납금</td>
              ${monthly.map((m) => `<td class="${state.send[m.idx] !== false ? '' : 'col-off'}">${fmt(m.preAmt)}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="quote-doc__footer">
        ※ 본 견적은 참고용이며 실 계약 시 변동될 수 있습니다.<br>
        ※ 보험료/취득세/등록비 등 부대비용 포함된 가격입니다.<br>
        ※ 자세한 사항은 담당자에게 문의 바랍니다.
        <div class="staff">담당자 · <b>웰릭스 모빌리티</b> · 010-0000-0000</div>
      </div>
    </div>
  `;
  $('quote-doc').innerHTML = html;
  // 작은 정보 줄 갱신 (renderSummary와 동일 로직 — 가격 포함)
  renderSummary();
}

// 텍스트 형식 (카톡 전송용)
function buildPlainText(monthly, totalKrw) {
  const v = state.vehicle;
  const lines = [];
  lines.push('【 웰릭스 모빌리티 견적 】');
  lines.push('');
  lines.push(`▣ 차량: ${v.brand} ${v.model} ${v.variant || ''}`);
  lines.push(`▣ 트림: ${v.trim_name}`);
  if (state.cond.colorInt) lines.push(`▣ 내장: ${state.cond.colorInt}`);
  lines.push(`▣ 차량가격: ${krw(totalKrw)}`);
  lines.push('');
  lines.push(`▣ 조건: 신용 ${state.cond.credit} / 약정 ${state.cond.km}만km`);
  lines.push('');
  lines.push('▣ 월 대여료');
  monthly.forEach((m) => {
    if (state.send[m.idx] === false) return;
    lines.push(`  · ${m.term}개월 (보${m.dep}%/선${m.pre}%): ${fmt(m.monthly)}원 (만기 ${fmt(m.residualAmt)})`);
  });
  lines.push('');
  lines.push('— 웰릭스 모빌리티');
  return lines.join('\n');
}

// ============ 이벤트 ============
function attach() {
  // 공통 조건 변경 (신용/약정/서비스/보험/추가운전자)
  ['q-credit','q-km','q-svc','q-ins','q-extra'].forEach((id) => {
    const el = $(id); if (!el) return;
    const key = id.replace('q-','');
    const map = { 'credit':'credit','km':'km','svc':'svc','ins':'insProperty','extra':'extraDriver' };
    const handler = () => { state.cond[map[key]] = el.value; recompute(); };
    el.addEventListener('change', handler);
    el.addEventListener('input', handler);
  });
  // 전체 보증금/선납금 — 입력시 4기간 시나리오 일괄 적용
  $('q-dep')?.addEventListener('change', (e) => {
    const v = Math.max(0, Math.min(100, +e.target.value || 0));
    e.target.value = v;
    state.cond.dep = v;
    state.scenarios.forEach((sc) => { sc.dep = v; });
    if (state.vehicle && state.vehicle.total_manwon) recompute();
    else renderEmpty();
  });
  $('q-pre')?.addEventListener('change', (e) => {
    const v = Math.max(0, Math.min(100, +e.target.value || 0));
    e.target.value = v;
    state.cond.pre = v;
    state.scenarios.forEach((sc) => { sc.pre = v; });
    if (state.vehicle && state.vehicle.total_manwon) recompute();
    else renderEmpty();
  });
  // 탁송 cascade
  $('q-delivery-region')?.addEventListener('change', () => {
    state.cond.deliveryRegion = $('q-delivery-region').value;
    state.cond.deliveryCity = '';
    rebuildDeliveryCity();
    recompute();
  });
  $('q-delivery-city')?.addEventListener('change', () => {
    state.cond.deliveryCity = $('q-delivery-city').value;
    recompute();
  });
  // 선팅 제품
  $('q-tint-product')?.addEventListener('change', () => {
    state.tint.product = $('q-tint-product').value;
    state.tint.areas = new Set();  // 제품 변경 시 부위 초기화
    renderTintChips();
    recompute();
  });
  // 선팅 부위 (위임) — 측후면은 쿠폰X/O 배타그룹
  const SIDE_REAR_GROUP = ['side_rear_no_coupon', 'side_rear_with_coupon'];
  $('tint-chips')?.addEventListener('change', (e) => {
    if (!e.target.matches('input[data-tint-area]')) return;
    const k = e.target.dataset.tintArea;
    if (e.target.checked) {
      if (SIDE_REAR_GROUP.includes(k)) {
        SIDE_REAR_GROUP.filter((x) => x !== k).forEach((x) => state.tint.areas.delete(x));
      }
      state.tint.areas.add(k);
    } else {
      state.tint.areas.delete(k);
    }
    renderTintChips();
    recompute();
  });
  // 용품 — 블박/내비/하이패스
  ['blackbox','navi','hipass'].forEach((k) => {
    const el = $(`q-${k}`);
    if (!el) return;
    el.addEventListener('change', () => {
      state.extras[k] = el.value;
      recompute();
    });
  });

  // 손님 · 담당자 입력
  ['cust-name','cust-tel','staff-name','staff-tel'].forEach((k) => {
    const el = $(`q-${k}`); if (!el) return;
    el.addEventListener('input', () => {
      const [who, field] = k.split('-');
      state[who][field === 'name' ? 'name' : 'tel'] = el.value;
      recompute();
    });
  });

  // 견적서 모달
  $('btn-preview-quote')?.addEventListener('click', () => {
    const doc = $('quote-doc');
    if (!doc || !doc.innerHTML.includes('quote-doc__brand')) {
      alert('차량과 트림을 먼저 선택하세요');
      return;
    }
    $('quote-modal-body').innerHTML = doc.innerHTML;
    $('quote-modal-bd').classList.add('open');
  });
  $('btn-modal-close')?.addEventListener('click', () => $('quote-modal-bd').classList.remove('open'));
  $('quote-modal-bd')?.addEventListener('click', (e) => {
    if (e.target === $('quote-modal-bd')) $('quote-modal-bd').classList.remove('open');
  });

  // 텍스트 복사 (모달 안)
  $('btn-modal-copy-text')?.addEventListener('click', () => $('btn-copy-text')?.click());
  // 이미지 저장 (모달 안) — 추후 html2canvas
  $('btn-modal-save-image')?.addEventListener('click', () => alert('이미지 저장 기능은 곧 추가됩니다'));

  // 링크 저장 (Firebase — 추후)
  $('btn-save-link')?.addEventListener('click', () => alert('견적 링크 저장 기능은 곧 추가됩니다 (Firebase)'));

  // 모듀사인 서명 링크 복사
  $('btn-copy-sign-link')?.addEventListener('click', async () => {
    const url = window.__welrix_companyConfig?.signature_link;
    if (!url) { alert('이 회사는 모듀사인 서명 링크가 설정되어 있지 않습니다.'); return; }
    try {
      await navigator.clipboard.writeText(url);
      const btn = $('btn-copy-sign-link');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="ph ph-check"></i>복사됨';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
      btn.style.color = '#fff';
      setTimeout(() => { btn.innerHTML = orig; btn.style.cssText = ''; }, 1500);
    } catch (err) {
      prompt('아래 링크를 복사해 손님께 전달하세요:', url);
    }
  });

  // 내장 색상
  $('dd-color-int')?.addEventListener('change', () => {
    const v = $('dd-color-int').value;
    const [name, price] = v.split('|');
    state.cond.colorInt = name || '';
    state.cond.colorIntPrice = +price || 0;
    window.__welrix_updateIntSwatch?.(name);
    recompute();
  });
  // 외장 색상 swatch 갱신 (estimator_4 가 dd-color-ext change 처리하므로 hook 추가)
  $('dd-color-ext')?.addEventListener('change', () => {
    const sel = $('dd-color-ext');
    const text = sel.options[sel.selectedIndex]?.text || '';
    const name = text.split('·')[0].trim();
    window.__welrix_updateExtSwatch?.(name);
  });
  // 복사 (텍스트)
  $('btn-copy-text')?.addEventListener('click', async () => {
    if (!state.vehicle) return alert('차량을 먼저 선택하세요');
    const v = state.vehicle;
    const totalKrw = v.total_manwon * 10000 + state.cond.colorIntPrice;
    const monthly = [];  // 텍스트만 위한 재계산은 생략 (기존 결과 활용)
    // 단순화 — recompute() 결과 활용 위해 quote-doc 의 데이터 추출 또는 재호출
    // 빠른 fix — 텍스트 다시 계산
    const meta = findVehicleMeta(v.brand, v.model);
    const tintPrice = TINT_PRICES[state.tint.product] || {};
    const tintFee = [...state.tint.areas].reduce((s, k) => s + (tintPrice[k] || 0), 0);
    const deliveryFee = FLAT_DELIVERY[state.cond.deliveryCity] || 0;
    const vehicleRow = {
      brand: meta.brand || v.brand, model: meta.model || v.model,
      trim: meta.trim || v.trim_name, price: totalKrw,
      disp: meta.disp || 2000, fuel: meta.fuel || '가솔린',
      tax_exempt: 'tax_exempt' in meta ? meta.tax_exempt : '과세',
      group: meta.group || 'A군', multi_seat: meta.multi_seat,
      r24: meta.r24 ?? 0.65, r36: meta.r36 ?? 0.55, r48: meta.r48 ?? 0.48, r60: meta.r60 ?? 0.40,
      buyback_apply: meta.buyback_apply ?? 0,
    };
    state.scenarios.forEach((sc, idx) => {
      const r = calcQuote({
        vehicle: vehicleRow,
        options: { optPrice: 0, discount: 0, deliveryFee, itemsFee: tintFee, etc: 0 },
        contract: { term: sc.term, km: state.cond.km + '만km', dep: +sc.dep || 0, pre: +sc.pre || 0 },
        customer: { creditGrade: state.cond.credit },
        insurance: { property: state.cond.insProperty, extraDriver: state.cond.extraDriver, exec: '미가입',
                     injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
        fees: { feeRatePct: 5.0, svc: state.cond.svc },
      });
      monthly.push({ idx, term: sc.term, dep: sc.dep, pre: sc.pre, monthly: r.monthly, residualAmt: r.residualAmt });
    });
    const text = buildPlainText(monthly, totalKrw);
    try { await navigator.clipboard.writeText(text); alert('견적 텍스트가 복사되었습니다.'); }
    catch { alert('복사 실패'); }
  });
  // 이미지 복사 (자리만 — html2canvas 필요)
  $('btn-copy-image')?.addEventListener('click', () => {
    alert('이미지 저장은 다음 버전에서 지원 예정입니다.');
  });
}

// ============ Init ============
(async function init() {
  await loadCompanyConfig();
  await loadVehicles();
  initDropdowns();
  attach();
  renderEmpty();
  console.log('[wel2] quote module ready');
})();
