// wel2 견적 모듈 — wel 의 데이터/로직 활용 + estimator_4 톤
import { calcQuote, setCompanyConfig } from './src/lib/calc.js';
// 룩업 데이터 SSOT — Vue 컴포넌트와 공유 (이전에는 quote.js 에 박혀있고 window.__welrix_data 로 노출,
// 모듈 로드 순서로 컴포넌트가 빈 옵션 보던 문제 → 직접 import 으로 해결)
import {
  DELIVERY_REGIONS, FLAT_DELIVERY,
  TINT_AREAS, TINT_PRICES,
  ACCESSORIES, COLOR_INT,
} from './src/data/lookups.js';

// ============ 유틸 ============
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
const krw = (n) => `${fmt(n)}원`;
// 전화번호 자동 하이픈 — 010-1234-5678, 02-1234-5678, 1544-5678 등
function fmtTel(tel) {
  if (!tel) return '';
  const d = String(tel).replace(/\D/g, '');
  if (!d) return '';
  // 010 / 011-019 → 010-XXXX-XXXX
  if (/^01[016789]/.test(d)) {
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  }
  // 02-XXXX-XXXX
  if (d.startsWith('02')) {
    if (d.length === 10) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`;
    if (d.length === 9)  return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
  }
  // 031~064 (지역번호) — 0XX-XXX(X)-XXXX
  if (/^0[3-6]/.test(d)) {
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  }
  // 1544/1588 etc 전국 대표번호
  if (d.length === 8 && /^1[5-9]/.test(d)) return `${d.slice(0,4)}-${d.slice(4)}`;
  return tel; // 매치 안되면 원본
}

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
// 색상 hex 추정기를 글로벌로 노출 (CustomDropdown 에서 사용)
window.__welrix_guessColor = guessColor;
// Vue 컴포넌트가 사용할 데이터 상수
window.__welrix_data = {
  get DELIVERY_REGIONS() { return DELIVERY_REGIONS; },
  get FLAT_DELIVERY() { return FLAT_DELIVERY; },
  get TINT_AREAS() { return TINT_AREAS; },
  get TINT_PRICES() { return TINT_PRICES; },
  get ACCESSORIES() { return ACCESSORIES; },
};

// ============ 상태 — Vue 반응형 store와 공유 (마이그레이션 1단계) ============
import { quoteState as state, cartStore, addToCart, removeFromCart, clearCart, findCartItem } from './src/store.js';
import { saveQuote, buildQuoteUrl } from './src/firebase/quotes.js';
import { logQuoteSent } from './src/firebase/chat.js';
let VEHICLES = [];

// ============ 초기 로드 ============
async function loadCompanyConfig() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c') || 'welrix';
  try {
    const r = await fetch(`./data/company-config/${id}.json`);
    if (r.ok) {
      const cfg = await r.json();
      setCompanyConfig(cfg);
      window.__welrix_companyConfig = cfg;
      applyCompanyTheme(cfg);
      return cfg;
    }
  } catch {}
  return null;
}

// 회사별 브랜드 색을 CSS 변수로 주입 — :root 의 --brand/--brand-700/--brand-100/--brand-50 덮어씀
function applyCompanyTheme(cfg) {
  const brand = cfg?.brand_color;
  if (!brand) return;
  const r = document.documentElement;
  r.style.setProperty('--brand', brand);
  // hex → tone variants (간단 산정, alpha mix 대신 색 조정)
  r.style.setProperty('--brand-700', shadeColor(brand, -0.18));
  r.style.setProperty('--brand-100', mixWithWhite(brand, 0.82));
  r.style.setProperty('--brand-50',  mixWithWhite(brand, 0.94));
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : null;
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function shadeColor(hex, pct) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  return rgbToHex(...rgb.map(v => v * (1 + pct)));
}
function mixWithWhite(hex, white) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  return rgbToHex(...rgb.map(v => v + (255 - v) * white));
}
async function loadVehicles() {
  try {
    const r = await fetch(`./data/vehicles.json?t=${Date.now()}`);
    VEHICLES = await r.json();
  } catch {}
}
function findVehicleMeta(brand, model, trim_name, variant, trim_price_won) {
  if (!VEHICLES?.length) return {};
  // 0) ⭐ 가격 정확 매칭 (Excel 차량DB 가격과 1대1) — 최우선
  // 잔가율 r24/r36/r48/r60 정확성 보장 핵심
  if (trim_price_won) {
    const exact = VEHICLES.filter(v =>
      v.brand === brand && v.model === model && v.price === trim_price_won
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      // 같은 가격 트림이 여러개면 trim_name 텍스트로 추가 좁히기
      if (trim_name) {
        const tn = exact.find(v => (v.trim || '').includes(trim_name));
        if (tn) return tn;
      }
      // variant 토큰 (예: '하이브리드') 으로 좁히기
      const tokens = (variant || '').split(/[\s·,()]+/).filter(t => t.length > 1);
      if (tokens.length) {
        const scored = exact.map(m => ({
          m, score: tokens.reduce((s, t) => s + ((m.trim || '').includes(t) ? 1 : 0), 0)
        }));
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].m;
      }
      return exact[0];
    }
  }
  // 1) 텍스트 매칭 — brand + model + variant + trim_name (가격 없거나 미매치 시)
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
  // 2) 폴백 — brand + model 만
  return VEHICLES.find(v => v.brand === brand && v.model === model) || {};
}

// ============ UI 초기화 — Vue가 대부분 처리. 아직 남은 vanilla 만 ============
function initDropdowns() {
  // 탁송/선팅/용품/색상은 Vue 컴포넌트가 처리 — DOM 없으면 skip
  const dReg = $('q-delivery-region');
  if (dReg) {
    dReg.innerHTML = '<option value="">선택</option>' +
      Object.keys(DELIVERY_REGIONS).map((r) => `<option ${r === state.cond.deliveryRegion ? 'selected' : ''}>${r}</option>`).join('');
    rebuildDeliveryCity();
  }
  const tProd = $('q-tint-product');
  if (tProd) {
    tProd.innerHTML = '<option value="">없음</option>' +
      Object.keys(TINT_PRICES).map((p) => `<option value="${p}" ${p === state.tint.product ? 'selected' : ''}>${p}</option>`).join('');
    renderTintChips();
  }
  const bb = $('q-blackbox');
  if (bb) bb.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.blackbox).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const nv = $('q-navi');
  if (nv) nv.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.navi).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const hp = $('q-hipass');
  if (hp) hp.innerHTML = '<option value="">없음</option>' +
    Object.entries(ACCESSORIES.hipass).map(([k, v]) => `<option value="${k}">${k} (+${fmt(v)}원)</option>`).join('');
  const ddInt = $('dd-color-int');
  if (ddInt) {
    ddInt.innerHTML = COLOR_INT.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    ddInt.disabled = true;
  }
}

function rebuildDeliveryCity() {
  const reg = $('q-delivery-region');
  if (!reg) return;  // Vue가 처리
  const region = reg.value;
  const sel = $('q-delivery-city');
  if (!sel) return;
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
    const tip = a.desc ? `${a.desc} · ${price > 0 ? '+' + fmt(price) + '원' : '무료'}` : '';
    return `<label class="tint-chip ${checked ? 'on' : ''}" title="${tip}">
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
// renderSummary는 Vue SummaryPanel 컴포넌트가 자동으로 렌더링 (마이그레이션 1단계)
// 빈 함수로 유지 — 기존 호출처(recompute, renderQuoteDoc, renderEmpty)는 그대로 호출하지만 no-op
function renderSummary() { /* Vue가 처리 */ }

// === 이하 옛 DOM 조작 코드 (남겨두지만 호출 안됨) ===
function _legacy_renderSummary() {
  const mini = $('qp-summary-mini');
  if (!mini) return;
  const v = state.vehicle;
  const vEl = $('qp-vehicle');
  // 차량 정보가 부분이라도 있으면 표시
  const titleParts = v ? [v.brand, v.model, v.variant, v.trim_name].filter(Boolean) : [];
  if (titleParts.length) {
    const logo = v && BRAND_LOGOS_BY_KR[v.brand];
    const logoHtml = logo ? `<img class="qp-brand-logo" src="${logo}" alt="" />` : '';
    vEl.innerHTML = `${logoHtml}<span>${titleParts.join(' ')}</span>`;
    vEl.classList.remove('empty');
  } else {
    vEl.textContent = '차량 미선택';
    vEl.classList.add('empty');
  }
  // 가격 공식: 트림 X만 + 옵션 Y만 = 총 Z만원
  const trimManwon = v?.trim_price_manwon || 0;
  const optsManwon = v?.options_price_manwon || 0;
  const totalKrw = v && v.total_manwon ? v.total_manwon * 10000 + (state.cond.colorIntPrice || 0) : 0;
  const totalManwon = Math.round(totalKrw / 10000);
  const formulaEl = $('qp-formula');
  if (formulaEl) {
    if (trimManwon) {
      let html = `트림 <b>${fmt(trimManwon)}만</b>`;
      if (optsManwon) html += ` + 옵션 <b>${fmt(optsManwon)}만</b>`;
      html += ` = 총 <b class="total">${fmt(totalManwon)}만원</b>`;
      formulaEl.innerHTML = html;
    } else {
      formulaEl.textContent = '';
    }
  }
  // 개소세 라벨
  const taxLabel = $('qp-tax-label');
  if (taxLabel && v && v.tax_rate) {
    taxLabel.textContent = v.tax_rate === '3_5' ? '3.5%' : '5%';
  }
  // 옵션 — 뱃지로 노출 (라벨 없이 chips만)
  const opts = (v && v.options) || [];
  $('qp-summary-opts').innerHTML = opts.length
    ? `<div class="qp-opt-chips">${opts.map((n) => `<span class="badge badge--brand">${n}</span>`).join('')}</div>`
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
  const meta = findVehicleMeta(v.brand, v.model, v.trim_name, v.variant, (v.trim_price_manwon || 0) * 10000);
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

  // 엑셀 C14 식 = ROUND((BC15+BC17)/1.1, 0) — 썬팅 + 블박만 산출에 반영.
  // 내비/하이패스는 엑셀 BC18(기타비용)에 입력하더라도 어디에도 참조 안 됨 (영업 별도 안내 정책).
  // 우리도 엑셀과 동일하게 — 견적서 표시는 유지하되 calc 에는 썬팅+블박만 전달.
  const itemsFeeForCalc = tintFee + blackboxFee;  // 엑셀과 일치
  const itemsFeeDisplay = tintFee + blackboxFee + naviFee + hipassFee;  // 견적서 표시용

  const monthly = state.scenarios.map((sc, idx) => {
    const r = calcQuote({
      vehicle: vehicleRow,
      options: { optPrice: 0, discount: 0, deliveryFee, itemsFee: itemsFeeForCalc, etc: 0 },
      contract: { term: sc.term, km: state.cond.km + '만km', dep: +sc.dep || 0, pre: +sc.pre || 0 },
      customer: { creditGrade: state.cond.credit },
      insurance: { property: state.cond.insProperty, extraDriver: state.cond.extraDriver, exec: '미가입',
                   injury: '무한', self: '1억', uninsured: '2억', deductible: '30만원~', emergency: '가입' },
      fees: { feeRatePct: state.cond.feeRatePct ?? 5.0, svc: state.cond.svc },
    });
    return { idx, term: sc.term, dep: sc.dep, pre: sc.pre, monthly: r.monthly, residualAmt: r.residualAmt, residualPct: r.residualPct, depAmt: r.depositAmt, preAmt: r.prePayAmt };
  });

  // Vue TermsGrid 컴포넌트가 reactive 읽도록 state에 저장
  state.monthly = monthly;
  renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, itemsFee - tintFee);
}

// 외부(Vue 컴포넌트)에서 호출 가능하도록 노출
window.__welrix_recompute = recompute;

// === 현재 차량 → 장바구니 담기 ===
function snapshotCurrentVehicle() {
  if (!state.vehicle || !state.vehicle.total_manwon || !state.monthly?.length) return null;
  const v = state.vehicle;
  const tintPrice = TINT_PRICES[state.tint.product] || {};
  const tintFee = [...state.tint.areas].reduce((s, k) => s + (tintPrice[k] || 0), 0);
  const deliveryFee = FLAT_DELIVERY[state.cond.deliveryCity] || 0;
  const blackboxFee = ACCESSORIES.blackbox[state.extras.blackbox] || 0;
  const naviFee = ACCESSORIES.navi[state.extras.navi] || 0;
  const hipassFee = ACCESSORIES.hipass[state.extras.hipass] || 0;
  const accessoryFee = blackboxFee + naviFee + hipassFee;
  const totalKrw = v.total_manwon * 10000 + (state.cond.colorIntPrice || 0);
  return {
    brand: v.brand, model: v.model, variant: v.variant, trim_name: v.trim_name,
    options: [...(v.options || [])],
    colorExt: v.colorExt, colorInt: state.cond.colorInt,
    tax_rate: v.tax_rate,
    total_manwon: v.total_manwon,
    trim_price_manwon: v.trim_price_manwon,
    options_price_manwon: v.options_price_manwon,
    totalKrw,
    monthly: state.monthly.map(m => ({ ...m })),
    snapshot: {
      tint: { product: state.tint.product, areas: [...state.tint.areas] },
      extras: { ...state.extras },
      deliveryFee, deliveryCity: state.cond.deliveryCity,
      tintFee, accessoryFee,
    },
  };
}
/**
 * 현재 차량을 견적바구니에 담기.
 * @param {object} opts.silent — true 면 중복 confirm 안 띄우고 바로 갱신
 * @returns {{ id, updated, skipped }}
 *   - skipped: 중복이라 사용자가 취소함
 *   - updated: 같은 차종 있어서 옵션/조건 갱신
 *   - id: cart 안 항목 id
 */
window.__welrix_addCurrentToCart = (opts = {}) => {
  const snap = snapshotCurrentVehicle();
  if (!snap) { alert('차량을 선택하고 견적이 산출된 후 담을 수 있습니다'); return null; }
  const existing = findCartItem(snap);
  if (existing && !opts.silent) {
    const ok = confirm(
      `이미 견적바구니에 담긴 차종입니다.\n\n` +
      `${snap.brand} ${snap.model} ${snap.trim_name}\n\n` +
      `현재 옵션·조건으로 갱신할까요?`
    );
    if (!ok) return { skipped: true };
  }
  const result = addToCart(snap);
  return { ...result, skipped: false };
};
window.__welrix_removeCart = removeFromCart;
window.__welrix_clearCart = clearCart;

function renderEmpty() {
  // 4기간 카드는 Vue TermsGrid 컴포넌트가 자동 렌더 (state.monthly 비면 placeholder)
  state.monthly = [];
  $('quote-doc').innerHTML = '<div class="quote-doc__empty">차량과 트림을 선택하면 견적서가 생성됩니다.</div>';
  return;
  // 이하 옛 DOM 코드 (실행 안 됨, Vue가 대체)
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

// ============ 견적서 HTML v2 — 모바일 세로형 카드 레이아웃 (카톡 이미지용) ============
function renderQuoteDoc(monthly, totalKrw, tintFee, deliveryFee, accessoryFee = 0) {
  const v = state.vehicle;
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const expire = new Date(today.getTime() + 7*86400000);
  const expireStr = expire.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const quoteNo = todayStr.replace(/\./g,'') + '-' + String(Date.now()).slice(-4);
  // 체크된 시나리오
  const sent = monthly.filter((m) => state.send[m.idx] !== false);
  // best = 최저 월대여료 시나리오
  const bestIdx = sent.length ? sent.reduce((b, m) => m.monthly < b.monthly ? m : b, sent[0]).idx : -1;
  // 옵션 칩
  const opts = (v.options && v.options.length) ? v.options : [];
  // 색상 hex (외장)
  const extColorHex = v.colorExt ? guessColor(v.colorExt) : '#e5e5e5';
  const intColorHex = state.cond.colorInt ? guessColor(state.cond.colorInt) : '#e5e5e5';

  const cfg = window.__welrix_companyConfig || {};
  const logoUrl = cfg.logo_url;
  const showLogo = state.send_options?.showLogo !== false; // 기본 true, "CI 제외" 체크 시 false
  const html = `
    <div class="quote-doc" id="quote-doc-content">
      <!-- 헤더 -->
      <div class="qd-hero">
        ${showLogo && logoUrl ? `<img class="qd-hero__logo" src="${logoUrl}" alt="${cfg.name || ''}" />` : ''}
        <div class="qd-hero__title">신차 장기렌터카 견적서</div>
        <div class="qd-hero__meta">
          <span><b>견적번호</b> ${quoteNo}</span>
          <span><b>유효기간</b> ${expireStr}까지</span>
        </div>
      </div>

      <!-- 손님 / 담당자 -->
      <div class="qd-section">
        <div class="qd-people">
          <div class="qd-people__col">
            <h4>고객</h4>
            <div class="name">${[state.cust.name ? `${state.cust.name} 님` : '', fmtTel(state.cust.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
          <div class="qd-people__col">
            <h4>담당자</h4>
            <div class="name">${[state.staff.name, fmtTel(state.staff.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
        </div>
      </div>

      <!-- 차량 카드 -->
      <div class="qd-section">
        <div class="qd-section__label">VEHICLE</div>
        <div class="qd-vehicle">
          <div class="qd-vehicle__top">
            <div>
              <div class="qd-vehicle__title">${v.brand || ''}</div>
              <div class="qd-vehicle__name">${v.model || ''} ${v.trim_name || ''}</div>
              <div class="qd-vehicle__sub">${[v.variant, v.fuel, v.displacement_cc ? v.displacement_cc + 'cc' : null].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="qd-vehicle__price">
              <div class="label">TOTAL</div>
              <div class="value">${krw(totalKrw)}</div>
            </div>
          </div>
          <div class="qd-vehicle__rows">
            <div class="qd-vehicle__row"><span class="k">외장</span><span class="v color"><span class="swatch" style="background:${extColorHex}"></span>${v.colorExt || '-'}</span></div>
            <div class="qd-vehicle__row"><span class="k">내장</span><span class="v color"><span class="swatch" style="background:${intColorHex}"></span>${state.cond.colorInt || '-'}</span></div>
            ${tintFee ? `<div class="qd-vehicle__row"><span class="k">선팅</span><span class="v">${state.tint.product}</span></div>` : ''}
            ${deliveryFee ? `<div class="qd-vehicle__row"><span class="k">탁송</span><span class="v">${state.cond.deliveryCity}</span></div>` : ''}
            ${accessoryFee ? `<div class="qd-vehicle__row"><span class="k">용품</span><span class="v">${[state.extras.blackbox, state.extras.navi, state.extras.hipass].filter(Boolean).length}종</span></div>` : ''}
          </div>
          ${opts.length ? `
            <div class="qd-vehicle__opts">
              <div class="qd-vehicle__opts-label">옵션</div>
              ${opts.map(o => `<span class="opt-chip">${o}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 월 대여료 (핵심) -->
      <div class="qd-section">
        <div class="qd-section__label">MONTHLY PAYMENT · ${state.cond.km}만km/년 · ${state.cond.credit}</div>
        <div class="qd-monthly">
          ${sent.map(m => `
            <div class="qd-monthly__row ${m.idx === bestIdx && sent.length > 1 ? 'best' : ''}">
              ${m.idx === bestIdx && sent.length > 1 ? '<span class="qd-monthly__badge">BEST</span>' : ''}
              <div class="qd-monthly__term">${m.term}<em>개월</em></div>
              <div class="qd-monthly__cond">
                보증금 <b>${m.dep}%</b> · 선납 <b>${m.pre}%</b><br>
                만기인수 ${(m.residualPct*100).toFixed(0)}%
              </div>
              <div class="qd-monthly__price">
                <span class="price">${fmt(m.monthly)}</span><span class="unit">원</span>
                <div class="residual">만기 ${fmt(m.residualAmt)}원</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 보험 + 정비 -->
      <div class="qd-section">
        <div class="qd-section__label">INSURANCE · SERVICE</div>
        <div class="qd-info-grid">
          <div class="qd-info-card">
            <h5>보험</h5>
            <div class="kv"><span class="k">대인 Ⅰ/Ⅱ</span><span class="v">무한</span></div>
            <div class="kv"><span class="k">대물</span><span class="v">${state.cond.insProperty || '1억'}</span></div>
            <div class="kv"><span class="k">자손</span><span class="v">1억</span></div>
            <div class="kv"><span class="k">자상</span><span class="v">2억</span></div>
            <div class="kv"><span class="k">면책금</span><span class="v">30만원~</span></div>
            <div class="kv"><span class="k">추가운전자</span><span class="v">${state.cond.extraDriver || '없음'}</span></div>
          </div>
          <div class="qd-info-card">
            <h5>정비</h5>
            <div class="kv"><span class="k">상품</span><span class="v">${state.cond.svc}</span></div>
            <div class="kv"><span class="k">방식</span><span class="v">${state.cond.svc === '웰스 Self' ? '고객 자체정비' : '방문 점검'}</span></div>
            <div class="kv"><span class="k">주기</span><span class="v">${state.cond.svc === '웰스 Self' ? '없음' : '6개월 1회'}</span></div>
            <div class="kv"><span class="k">검사대행</span><span class="v">포함</span></div>
            <div class="kv"><span class="k">긴급출동</span><span class="v">5회/년</span></div>
            <div class="kv"><span class="k">사고처리</span><span class="v">1544-3871</span></div>
          </div>
        </div>
      </div>

      <!-- 주요 계약사항 -->
      <div class="qd-section">
        <div class="qd-section__label">NOTES</div>
        <ul class="qd-notes">
          <li>상기 견적은 제조사 사정·조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에 자동차보험·정비·검사·자동차세가 모두 포함됩니다.</li>
          <li>중도해지 시 수수료가 발생됩니다 (기간별 상이, 약정서 참고).</li>
        </ul>
      </div>

      <!-- 제출서류 -->
      <div class="qd-section">
        <div class="qd-section__label">REQUIRED DOCUMENTS</div>
        <div class="qd-docs">
          <div class="qd-docs__item"><b>공통</b>주민등록등본 · 운전면허증 사본 · 운전경력증명원 · 인감증명서 · 소득/재산 증빙 · 자동이체통장 사본</div>
          <div class="qd-docs__item"><b>사업자</b>사업자등록증 사본 · 법인등기부등본 · 법인인감증명서</div>
          <div class="qd-docs__item"><b>추가운전자</b>주민등록등본 · 운전면허증 사본 · 운전경력증명원</div>
        </div>
      </div>

      <!-- 푸터 -->
      <div class="qd-footer">
        <div class="qd-footer__bank">
          <span class="label">계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>
      </div>
    </div>
  `;
  $('quote-doc').innerHTML = html;
  renderSummary();
}

// ============================================================
// 정식 견적서 (엑셀 「견적서_고객」 시트 동일 양식, 웹 캡쳐용)
// 정보 위계: 회사 → 손님 → 담당 → 차량 → 기간별 가격
// 부가: 보험 · 정비 서비스 · 제출서류
// 다중 차종: 차량정보+월대여료 블록을 차종마다 반복
// ============================================================
function renderOfficialQuoteDoc(vehicles) {
  // 토글로 재렌더할 때 쓰려고 마지막 source 보관
  window.__welrix_lastQuoteSnaps = vehicles;
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR');
  const expire = new Date(today.getTime() + 7*86400000);
  const expireStr = expire.toLocaleDateString('ko-KR');
  const quoteNo = today.toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now()).slice(-4);
  const sentFlags = state.send;
  const cond = state.cond;

  // 차량 블록 (차량정보 + 월대여료) — 차종마다 반복
  const vehicleBlocks = vehicles.map((veh, vIdx) => {
    const sent = (veh.monthly || []).filter((m) => sentFlags[m.idx] !== false);
    const bestVal = sent.length > 1 ? Math.min(...sent.map(m => m.monthly)) : -1;
    const trimKrw = (veh.trim_price_manwon || 0) * 10000;
    const optsKrw = (veh.options_price_manwon || 0) * 10000;
    const tintFee = veh.snapshot?.tintFee || 0;
    const deliveryFee = veh.snapshot?.deliveryFee || 0;
    const extras = veh.snapshot?.extras || {};
    const extrasNames = [extras.blackbox, extras.navi, extras.hipass].filter(Boolean);
    const optList = (veh.options || []).join(', ') || '-';

    return `
      <div class="ofq-section">
        ${vehicles.length > 1 ? `
          <div class="ofq-vehicle-head">
            <span>견적 ${vIdx + 1} / ${vehicles.length}</span>
            <span class="sep">|</span>
            <b>${veh.brand || ''} ${veh.model || ''}</b>
            <span class="sep">·</span>
            <span>${veh.trim_name || ''}</span>
          </div>
        ` : ''}
        <div class="ofq-section__title">차량 정보 <span class="unit">[VAT 포함]</span></div>
        <div class="ofq-vcard">
          <div class="ofq-vcard__head">
            <div class="ofq-vcard__title">
              <div class="vname">${[veh.brand, veh.model, veh.trim_name].filter(Boolean).join(' ')}</div>
              <div class="vmeta">${[veh.variant, veh.fuel || cond._fuel, veh.displacement_cc ? veh.displacement_cc + 'cc' : null].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="ofq-vcard__total">
              <div class="label">총 차량가격</div>
              <div class="value">${krw(veh.totalKrw || 0)}</div>
              <div class="breakdown">
                트림 <b>${krw(trimKrw)}</b>${optsKrw ? ` · 옵션 +<b>${krw(optsKrw)}</b>` : ''}
              </div>
            </div>
          </div>

          ${(veh.options || []).length ? `
            <div class="ofq-vcard__row">
              <span class="row-key"><i class="ph ph-list-checks"></i>옵션</span>
              <div class="qp-opt-chips">${veh.options.map(o => `<span class="badge badge--brand">${o}</span>`).join('')}</div>
            </div>
          ` : ''}

          <div class="ofq-vcard__row">
            <span class="row-key"><i class="ph ph-palette"></i>색상</span>
            <div class="ofq-vcard__colors">
              <span class="color-inline"><span class="swatch-dot" style="background:${guessColor(veh.colorExt)}"></span>외장 ${veh.colorExt || '-'}</span>
              <span class="color-inline"><span class="swatch-dot" style="background:${guessColor(veh.colorInt)}"></span>내장 ${veh.colorInt || '-'}</span>
            </div>
          </div>

          ${(deliveryFee || tintFee || extrasNames.length) ? `
            <div class="ofq-vcard__row ofq-vcard__row--side">
              <span class="row-key"><i class="ph ph-plus-square"></i>부가</span>
              <div>${[
                deliveryFee ? `탁송 ${veh.snapshot?.deliveryCity}` : null,
                tintFee ? `선팅 ${veh.snapshot?.tint?.product}` : null,
                extrasNames.length ? `용품 ${extrasNames.join(', ')}` : null,
              ].filter(Boolean).join(' · ')}</div>
            </div>
          ` : ''}
        </div>

        <div class="ofq-section__title" style="margin-top:14px;">계약 정보 (월 대여료) <span class="unit">[VAT 포함 · ${cond.km}만km/년]</span></div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-terms-table">
            <thead>
              <tr>
                <th class="row-label">구분</th>
                ${sent.map(m => `<th>${m.term}개월</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr><th class="row-label">약정주행</th>${sent.map(() => `<td>${cond.km}만km/년</td>`).join('')}</tr>
              <tr><th class="row-label">만기처리</th>${sent.map(() => `<td>만기 협의</td>`).join('')}</tr>
              <tr><th class="row-label">만기인수금액</th>${sent.map(m => `<td>${(m.residualPct*100).toFixed(0)}% · ${fmt(m.residualAmt)}원</td>`).join('')}</tr>
              <tr><th class="row-label">정비서비스</th>${sent.map(() => `<td>${cond.svc}</td>`).join('')}</tr>
              <tr><th class="row-label">보증금</th>${sent.map(m => `<td>${m.dep}% · ${fmt(m.depAmt)}원</td>`).join('')}</tr>
              <tr><th class="row-label">선납금</th>${sent.map(m => `<td>${m.pre}% · ${fmt(m.preAmt)}원</td>`).join('')}</tr>
              <tr class="monthly">
                <th class="row-label">월 대여료</th>
                ${sent.map(m => `<td class="${m.monthly === bestVal && sent.length > 1 ? 'best' : ''}">${fmt(m.monthly)}원</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <div class="quote-doc official" id="quote-doc-content">
      <!-- 헤더 (회사 + 견적서 메타) -->
      <div class="ofq-hero">
        <div class="ofq-hero__left">
          ${(() => {
            const cfg = window.__welrix_companyConfig || {};
            const showLogo = state.send_options?.showLogo !== false;
            const logoUrl = cfg.logo_url;
            return (showLogo && logoUrl)
              ? `<img class="ofq-hero__logo" src="${logoUrl}" alt="${cfg.name || ''}" />`
              : '';
          })()}
          <div class="title">신차 장기렌터카 견적서</div>
        </div>
        <div class="ofq-hero__right">
          <div><b>견적번호</b> ${quoteNo}</div>
          <div><b>견적일자</b> ${todayStr}</div>
          <div><b>유효기간</b> ${expireStr} 까지</div>
        </div>
      </div>

      <!-- 수신·담당 한 줄 인라인 정보 바 -->
      <div class="ofq-infobar">
        <div class="ofq-infobar__item">
          <span class="ofq-infobar__label">수신</span>
          <span class="ofq-infobar__value">${[state.cust.name ? `<b>${state.cust.name}</b> 귀하` : '', fmtTel(state.cust.tel)].filter(Boolean).join(' · ') || '-'}</span>
        </div>
        <div class="ofq-infobar__divider"></div>
        <div class="ofq-infobar__item">
          <span class="ofq-infobar__label">담당</span>
          <span class="ofq-infobar__value">${[state.staff.name, fmtTel(state.staff.tel)].filter(Boolean).join(' · ') || '-'}</span>
        </div>
      </div>

      <!-- 차량 + 월대여료 (차종마다 반복) -->
      ${vehicleBlocks}

      <!-- 보험가입 내역 -->
      <div class="ofq-section">
        <div class="ofq-section__title">보험가입 내역 <span class="unit">사고처리 1544-3871</span></div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-ins-table">
            <tr>
              <th>운전연령</th><td>만 26세 이상</td>
              <th>대인 Ⅰ/Ⅱ</th><td>무한</td>
              <th>대물</th><td>${cond.insProperty || '1억'}</td>
              <th>자손</th><td>1억</td>
            </tr>
            <tr>
              <th>무보험자상해</th><td>2억</td>
              <th>사고면책금</th><td>30만원~</td>
              <th>임직원특약</th><td>미가입</td>
              <th>추가운전자</th><td>${cond.extraDriver || '없음'}</td>
            </tr>
            <tr>
              <th>긴급출동</th><td colspan="7" class="full">가입 (5회/년, 10km · 등본/가족관계증명서 직계가족 1인 추가비용 없음, 그 외 1인 5만원)</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 정비상품 — 선택된 상품만 표시 -->
      <div class="ofq-section">
        <div class="ofq-section__title">부가서비스 · 정비상품 (${cond.svc || '웰스 Basic'})</div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-svc-table">
            <thead>
              <tr>
                <th>정비 방식</th><th>정비 주기</th><th>소모품 교환</th>
                <th>사고처리</th><th>검사대행</th><th>사고대차</th><th>고장대차</th>
              </tr>
            </thead>
            <tbody>
              ${cond.svc === '웰스 Self' ? `
              <tr>
                <td>정비제외 (고객 자체정비)</td><td>없음</td>
                <td>없음</td><td>지원</td><td>O</td><td>X</td><td>X</td>
              </tr>
              ` : `
              <tr>
                <td>방문 점검 (정비사 방문)</td><td>6개월 1회</td>
                <td>엔진오일 등 한정</td><td>지원</td><td>O</td><td>X</td><td>X</td>
              </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 제출서류 -->
      <div class="ofq-section">
        <div class="ofq-section__title">제출서류 안내</div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-docs-table">
            <tr>
              <th>공통</th>
              <td>① 주민등록등본 ② 운전면허증 사본 ③ 운전경력증명원 ④ 인감증명서 ⑤ 소득/재산 증빙 서류 ⑥ 자동이체통장 사본
                  <br><small>* 소득서류 — 개인: 건강보험납입증명서·급여통장 사본 / 사업자: 부가세과세표준증명원·소득금액증명원</small></td>
            </tr>
            <tr>
              <th>사업자</th><td>① 사업자등록증 사본 ② 법인등기부등본 ③ 법인인감증명서</td>
            </tr>
            <tr>
              <th>추가운전자</th><td>① 주민등록등본 ② 운전면허증 사본 ③ 운전경력증명원</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 주요 계약사항 -->
      <div class="ofq-section">
        <div class="ofq-section__title">주요 계약사항</div>
        <ol class="ofq-notes">
          <li>상기 견적은 제조사 사정, 조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 신용 또는 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에는 자동차 보험료, 정비서비스/차량검사비, 자동차세가 포함됩니다.</li>
          <li>중도해지 시 중도해지수수료가 발생되며, 기간별 상이합니다. (약정서 참고)</li>
        </ol>
      </div>

      <!-- 푸터 -->
      <div class="ofq-footer">
        <div class="ofq-footer__bank">
          <span>계약금 입금계좌</span> · <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>
        <div class="ofq-footer__sign">
          <div class="seal">웰릭스모빌리티㈜</div>
        </div>
      </div>
    </div>
  `;
  $('quote-modal-body').innerHTML = html;

  // 차종 제외 버튼은 official 양식엔 안 둠 (캡쳐 깔끔하게)
  // 필요하면 미리보기 위에 별도 컨트롤 바 추가 가능
}

// ============ 다중 차종 견적서 — 모바일 카드형 (손님 페이지 전용 / 백업) ============
// 헤더(고객·담당자) 1회 + 차종 카드 N개 + 공통 보험/정비/노트/푸터
function renderMultiQuoteDoc(vehicles) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const expire = new Date(today.getTime() + 7*86400000);
  const expireStr = expire.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g,'.').replace(/\.$/,'');
  const quoteNo = todayStr.replace(/\./g,'') + '-' + String(Date.now()).slice(-4);

  // === 비교표 (가로) — 차종이 2+ 일 때만 표시 ===
  // 행: 차량가격 / 외장 / 옵션수 / 24·36·48·60개월
  // 컬럼: 차종 N개. 각 기간 행에서 최저가 차종에 BEST 표시
  const sentFlags = state.send;
  const visibleTerms = (vehicles[0]?.monthly || []).filter((m) => sentFlags[m.idx] !== false).map(m => m.idx);

  function termCell(veh, termIdx) {
    const m = (veh.monthly || []).find(x => x.idx === termIdx);
    if (!m) return { html: '<td>-</td>', val: Infinity };
    return { val: m.monthly, raw: m, idx: termIdx };
  }

  const compareTableHtml = vehicles.length > 1 ? `
    <div class="qd-section">
      <div class="qd-section__label">COMPARISON</div>
      <div class="qd-compare">
        <table>
          <thead>
            <tr>
              <th class="row-label"></th>
              ${vehicles.map(veh => `
                <th>
                  <span class="brand-tiny">${veh.brand || ''}</span>
                  ${veh.model || ''}<br>${veh.trim_name || ''}
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="price">
              <th>차량가</th>
              ${vehicles.map(veh => `<td>${fmt(veh.totalKrw || 0)}</td>`).join('')}
            </tr>
            <tr>
              <th>외장</th>
              ${vehicles.map(veh => `<td>${veh.colorExt || '-'}</td>`).join('')}
            </tr>
            <tr>
              <th>옵션</th>
              ${vehicles.map(veh => `<td>${(veh.options || []).length ? (veh.options.length + '개') : '-'}</td>`).join('')}
            </tr>
            ${visibleTerms.map(termIdx => {
              const cells = vehicles.map(v => termCell(v, termIdx));
              const minVal = Math.min(...cells.map(c => c.val));
              const termLabel = vehicles[0]?.monthly?.find(m => m.idx === termIdx)?.term + '개월';
              return `
                <tr class="term">
                  <th>${termLabel}</th>
                  ${cells.map(c => {
                    if (!c.raw) return '<td>-</td>';
                    const isBest = c.val === minVal && vehicles.length > 1;
                    return `<td class="${isBest ? 'cell-best' : ''}">
                      <span class="${isBest ? 'best-mark' : ''}">${fmt(c.val)}</span>${isBest ? '<span class="best-tag">BEST</span>' : ''}
                    </td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  // === 차량 카드 (디테일, 차량 정보에 집중) ===
  const vehicleCards = vehicles.map((veh, vIdx) => {
    const sent = (veh.monthly || []).filter((m) => sentFlags[m.idx] !== false);
    const bestIdx = sent.length > 1 ? sent.reduce((b, m) => m.monthly < b.monthly ? m : b, sent[0]).idx : -1;
    const extColorHex = veh.colorExt ? guessColor(veh.colorExt) : '#e5e5e5';
    const intColorHex = veh.colorInt ? guessColor(veh.colorInt) : '#e5e5e5';
    const opts = veh.options || [];
    const removeBtn = vehicles.length > 1
      ? `<button class="qd-vehicle__remove" data-cart-id="${veh.id}" title="제외"><i class="ph ph-x"></i></button>`
      : '';
    // 차량별 부가 (선팅/탁송/용품) — 카드 하단 작게
    const tintFee = veh.snapshot?.tintFee || 0;
    const deliveryFee = veh.snapshot?.deliveryFee || 0;
    const accessoryFee = veh.snapshot?.accessoryFee || 0;
    const extrasList = veh.snapshot?.extras || {};
    const extrasNames = [extrasList.blackbox, extrasList.navi, extrasList.hipass].filter(Boolean);
    const sideBits = [];
    if (tintFee) sideBits.push(`선팅 ${veh.snapshot?.tint?.product || ''}`);
    if (deliveryFee) sideBits.push(`탁송 ${veh.snapshot?.deliveryCity || ''}`);
    if (extrasNames.length) sideBits.push(`용품 ${extrasNames.length}종`);
    return `
      <div class="qd-section qd-section--card" data-vehicle-idx="${vIdx}">
        <div class="qd-section__label">VEHICLE ${vehicles.length > 1 ? (vIdx + 1) + ' / ' + vehicles.length : ''}</div>
        <div class="qd-vehicle">
          ${removeBtn}
          <div class="qd-vehicle__top">
            <div>
              <div class="qd-vehicle__title">${veh.brand || ''}</div>
              <div class="qd-vehicle__name">${veh.model || ''} ${veh.trim_name || ''}</div>
              <div class="qd-vehicle__sub">${[veh.variant].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="qd-vehicle__price">
              <div class="label">TOTAL</div>
              <div class="value">${krw(veh.totalKrw || 0)}</div>
            </div>
          </div>
          <div class="qd-vehicle__rows">
            <div class="qd-vehicle__row"><span class="k">외장</span><span class="v color"><span class="swatch" style="background:${extColorHex}"></span>${veh.colorExt || '-'}</span></div>
            <div class="qd-vehicle__row"><span class="k">내장</span><span class="v color"><span class="swatch" style="background:${intColorHex}"></span>${veh.colorInt || '-'}</span></div>
          </div>
          ${opts.length ? `
            <div class="qd-vehicle__opts">
              <div class="qd-vehicle__opts-label">옵션</div>
              ${opts.map(o => `<span class="opt-chip">${o}</span>`).join('')}
            </div>
          ` : ''}
          ${sideBits.length ? `
            <div class="qd-vehicle__side">
              ${sideBits.map(s => `<span>${s}</span>`).join(' · ')}
            </div>
          ` : ''}
        </div>
        <!-- 월 대여료 (이 차종 한정) — 단일 차종일 때만 노출, 다중일 때는 위 비교표가 대신 -->
        ${vehicles.length === 1 ? `
          <div class="qd-monthly" style="margin-top:14px;">
            ${sent.map(m => `
              <div class="qd-monthly__row ${m.idx === bestIdx ? 'best' : ''}">
                ${m.idx === bestIdx ? '<span class="qd-monthly__badge">BEST</span>' : ''}
                <div class="qd-monthly__term">${m.term}<em>개월</em></div>
                <div class="qd-monthly__cond">
                  보증금 <b>${m.dep}%</b> · 선납 <b>${m.pre}%</b><br>
                  만기인수 ${(m.residualPct*100).toFixed(0)}%
                </div>
                <div class="qd-monthly__price">
                  <span class="price">${fmt(m.monthly)}</span><span class="unit">원</span>
                  <div class="residual">만기 ${fmt(m.residualAmt)}원</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const cfg = window.__welrix_companyConfig || {};
  const logoUrl = cfg.logo_url;
  const showLogo = state.send_options?.showLogo !== false;
  const html = `
    <div class="quote-doc" id="quote-doc-content">
      <div class="qd-hero">
        ${showLogo && logoUrl ? `<img class="qd-hero__logo" src="${logoUrl}" alt="${cfg.name || ''}" />` : ''}
        <div class="qd-hero__title">신차 장기렌터카 견적서</div>
        <div class="qd-hero__meta">
          <span><b>견적번호</b> ${quoteNo}</span>
          <span><b>유효기간</b> ${expireStr}까지</span>
        </div>
      </div>

      <div class="qd-section">
        <div class="qd-people">
          <div class="qd-people__col">
            <h4>고객</h4>
            <div class="name">${[state.cust.name ? `${state.cust.name} 님` : '', fmtTel(state.cust.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
          <div class="qd-people__col">
            <h4>담당자</h4>
            <div class="name">${[state.staff.name, fmtTel(state.staff.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
        </div>
      </div>

      <!-- 공통 견적 조건 -->
      <div class="qd-section">
        <div class="qd-section__label">CONDITION</div>
        <div class="qd-info-grid">
          <div class="qd-info-card">
            <h5>견적 조건</h5>
            <div class="kv"><span class="k">신용등급</span><span class="v">${state.cond.credit}</span></div>
            <div class="kv"><span class="k">약정주행</span><span class="v">${state.cond.km}만km/년</span></div>
            <div class="kv"><span class="k">보증금</span><span class="v">${state.cond.dep}%</span></div>
            <div class="kv"><span class="k">선납금</span><span class="v">${state.cond.pre}%</span></div>
          </div>
          <div class="qd-info-card">
            <h5>보험 · 정비</h5>
            <div class="kv"><span class="k">대물</span><span class="v">${state.cond.insProperty || '1억'}</span></div>
            <div class="kv"><span class="k">추가운전자</span><span class="v">${state.cond.extraDriver || '없음'}</span></div>
            <div class="kv"><span class="k">정비</span><span class="v">${state.cond.svc}</span></div>
            <div class="kv"><span class="k">긴급출동</span><span class="v">5회/년</span></div>
          </div>
        </div>
      </div>

      ${compareTableHtml}

      ${vehicleCards}

      <!-- 공통 노트 -->
      <div class="qd-section">
        <div class="qd-section__label">NOTES</div>
        <ul class="qd-notes">
          <li>상기 견적은 제조사 사정·조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에 자동차보험·정비·검사·자동차세가 모두 포함됩니다.</li>
          <li>중도해지 시 수수료가 발생됩니다 (기간별 상이, 약정서 참고).</li>
        </ul>
      </div>

      <div class="qd-section">
        <div class="qd-section__label">REQUIRED DOCUMENTS</div>
        <div class="qd-docs">
          <div class="qd-docs__item"><b>공통</b>주민등록등본 · 운전면허증 · 운전경력증명원 · 인감증명서 · 소득/재산 증빙 · 자동이체통장</div>
          <div class="qd-docs__item"><b>사업자</b>사업자등록증 · 법인등기부등본 · 법인인감증명서</div>
          <div class="qd-docs__item"><b>추가운전자</b>주민등록등본 · 운전면허증 · 운전경력증명원</div>
        </div>
      </div>

      <div class="qd-footer">
        <div class="qd-footer__bank">
          <span class="label">계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>
      </div>
    </div>
  `;
  $('quote-modal-body').innerHTML = html;

  // 차종 제외 버튼 위임
  $('quote-modal-body').querySelectorAll('[data-cart-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cartId;
      removeFromCart(id);
      // 다시 그리기 (남은 차량 / 비었으면 닫기)
      if (cartStore.vehicles.length === 0) {
        $('quote-modal-bd').classList.remove('open');
      } else {
        renderMultiQuoteDoc(cartStore.vehicles);
      }
    });
  });
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
  // 손님 / 담당자 입력 — state에만 저장 (계산엔 영향 없음, 견적서/카톡 텍스트에 활용)
  [['q-cust-name','cust','name'], ['q-cust-tel','cust','tel'],
   ['q-staff-name','staff','name'], ['q-staff-tel','staff','tel']].forEach(([id, role, field]) => {
    $(id)?.addEventListener('input', (e) => { state[role][field] = e.target.value; });
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

  // === 견적바구니 카운트 뱃지 (Vue reactive 브릿지) ===
  function syncCartBadge() {
    const badge = $('cart-badge');
    if (!badge) return;
    const n = cartStore.vehicles.length;
    badge.textContent = n;
    badge.style.display = 'inline-flex';
    badge.classList.toggle('is-empty', n === 0);
  }
  syncCartBadge();
  // Vue reactive는 inline JS에서 watch 못 하니까 가벼운 polling 유지 (250ms)
  setInterval(syncCartBadge, 250);

  $('btn-add-to-cart')?.addEventListener('click', () => {
    const result = window.__welrix_addCurrentToCart?.();
    if (!result) return;  // 차량 미선택
    const btn = $('btn-add-to-cart');
    const orig = btn._origHTML || (btn._origHTML = btn.innerHTML);
    if (result.skipped) {
      // 사용자가 confirm 취소 — 피드백 없음
      return;
    }
    if (result.updated) {
      btn.innerHTML = '<i class="ph ph-arrow-clockwise"></i>갱신됨';
      btn.style.color = '#f59e0b';
    } else {
      btn.innerHTML = '<i class="ph ph-check"></i>담김';
      btn.style.color = '#10b981';
    }
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1400);
    syncCartBadge();
  });

  // === [현재 견적] — 화면에서 본 차종 1대만 즉시 미리보기 (cart 미경유) ===
  $('btn-preview-quote')?.addEventListener('click', () => {
    const currentSnap = snapshotCurrentVehicle();
    if (!currentSnap) {
      alert('차량을 선택하고 견적이 산출된 후 미리보기 가능합니다');
      return;
    }
    renderOfficialQuoteDoc([currentSnap]);
    $('quote-modal-bd').classList.add('open');
  });

  // === [견적바구니] 열기 — CartPanel.vue ===
  $('btn-open-cart')?.addEventListener('click', () => {
    if (typeof window.__welrix_openCart === 'function') {
      window.__welrix_openCart();
    } else {
      console.warn('[cart] CartPanel not ready yet');
    }
  });

  // === CartPanel 에서 호출: 통합 발송 액션 핸들러 ===
  // action: 'preview' | 'image-save' | 'image-copy' | 'text-copy' | 'link-send'
  window.__welrix_cartAction = async (action, selectedVehicles) => {
    if (!selectedVehicles || !selectedVehicles.length) {
      alert('발송할 차종을 1개 이상 체크하세요');
      return;
    }
    // 견적서 모달 N차종으로 렌더 + 열기 (영업이 결과 확인 가능)
    renderOfficialQuoteDoc(selectedVehicles);
    $('quote-modal-bd').classList.add('open');
    // DOM/이미지 안정 대기
    await new Promise(r => setTimeout(r, 80));
    // 액션별 자동 트리거 — 영업이 한 번 클릭으로 발송 완료
    switch (action) {
      case 'preview':
        // 그대로 모달 열어두기 (사용자가 직접 확인 후 추가 액션)
        break;
      case 'image-save':
        $('btn-modal-save-image')?.click();
        break;
      case 'image-copy':
        $('btn-modal-copy-image')?.click();
        break;
      case 'text-copy':
        $('btn-modal-copy-text')?.click();
        break;
      case 'link-send':
        $('btn-modal-send-link')?.click();
        setTimeout(() => {
          const sendBtn = $('btn-modal-send-link');
          if (sendBtn) sendBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
        break;
    }
  };
  $('btn-modal-close')?.addEventListener('click', () => $('quote-modal-bd').classList.remove('open'));

  // 견적서 출력 — 새 창에서 견적서 HTML 만 격리해서 print
  $('btn-modal-print')?.addEventListener('click', () => {
    const docEl = $('quote-doc-content');
    if (!docEl) { alert('출력할 견적서가 없습니다.'); return; }
    // 메인 페이지의 견적서 관련 style 만 추출 (.quote-doc / .qd- / .ofq- prefix 등)
    const allStyles = Array.from(document.querySelectorAll('style, link[rel=stylesheet]'))
      .map(el => el.outerHTML).join('\n');
    const html = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<title>견적서 출력</title>
${allStyles}
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: block !important; }
</style>
</head><body>
${docEl.outerHTML}
<script>
window.addEventListener('load', () => {
  setTimeout(() => { window.print(); }, 300);
  window.addEventListener('afterprint', () => window.close());
});
<\/script>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) { alert('팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  });

  // === 모달 옵션: 로고 제외 토글 ===
  const optExcludeLogo = $('opt-exclude-logo');
  if (optExcludeLogo) {
    if (!state.send_options) state.send_options = { showLogo: true };
    optExcludeLogo.checked = state.send_options.showLogo === false;
    optExcludeLogo.addEventListener('change', () => {
      state.send_options.showLogo = !optExcludeLogo.checked;
      // 현재 모달이 열려있으면 즉시 재렌더
      if ($('quote-modal-bd').classList.contains('open')) {
        // cart 또는 single preview 어느 쪽이든 마지막 source 로 재렌더
        const snap = window.__welrix_lastQuoteSnaps || (state.vehicle ? [snapshotCurrentVehicle()].filter(Boolean) : []);
        if (snap.length) renderOfficialQuoteDoc(snap);
      }
    });
  }
  $('quote-modal-bd')?.addEventListener('click', (e) => {
    if (e.target === $('quote-modal-bd')) $('quote-modal-bd').classList.remove('open');
  });

  // 텍스트 복사 (모달 안)
  $('btn-modal-copy-text')?.addEventListener('click', () => $('btn-copy-text')?.click());

  // 견적서 이미지 캡처 — html2canvas (실제 quote-doc 폭으로 캡쳐, scale=2 로 고해상도)
  async function captureQuoteImage() {
    const el = document.querySelector('#quote-modal-body .quote-doc');
    if (!el) { alert('견적서가 아직 생성되지 않았습니다'); return null; }
    if (typeof html2canvas !== 'function') { alert('이미지 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.'); return null; }
    const body = $('quote-modal-body');
    const prevScroll = body.scrollTop;
    body.scrollTop = 0;
    const elWidth = el.offsetWidth || 820;  // 엑셀 양식(official) 820, 카드형 540
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: elWidth,
        windowWidth: elWidth,
        logging: false,
      });
      return canvas;
    } finally {
      body.scrollTop = prevScroll;
    }
  }

  // 이미지 저장 (다운로드)
  $('btn-modal-save-image')?.addEventListener('click', async () => {
    const btn = $('btn-modal-save-image');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 처리중...';
    btn.disabled = true;
    try {
      const canvas = await captureQuoteImage();
      if (!canvas) return;
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const name = state.cust.name || '견적서';
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        a.href = url;
        a.download = `welrix_견적서_${name}_${today}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (e) {
      console.error(e); alert('이미지 저장 실패: ' + e.message);
    } finally {
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // 링크 발송 — Firebase 저장 → URL + 카톡 메시지 클립보드 복사
  $('btn-modal-send-link')?.addEventListener('click', async () => {
    const btn = $('btn-modal-send-link');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 저장 중...';
    btn.disabled = true;
    try {
      // payload 구성: 현재 cart 또는 현재 차량 1대
      const cartHas = cartStore.vehicles.length > 0;
      const currentSnap = snapshotCurrentVehicle();
      const vehicles = cartHas ? cartStore.vehicles : (currentSnap ? [currentSnap] : []);
      if (!vehicles.length) { alert('차량을 먼저 선택하세요'); return; }
      const payload = {
        customer: { name: state.cust.name || '', tel: state.cust.tel || '' },
        staff:    { name: state.staff.name || '', tel: state.staff.tel || '' },
        cond:     { ...state.cond },
        scenarios: state.scenarios.map(s => ({ ...s })),
        send:     [...state.send],
        vehicles,
      };
      const { id, url } = await saveQuote(payload);
      // 채팅에 시스템 메시지 자동 push — "📤 견적 발송 — ..."
      const summary = vehicles.map(v => `${v.model} ${v.trim_name}`).join(', ');
      logQuoteSent(id, summary).catch(() => {});
      // 카톡 메시지 본문 — 손님이 받는 텍스트
      const custName = state.cust.name || 'VIP 고객';
      const vNames = vehicles.map(v => `· ${v.model} ${v.trim_name}`).join('\n');
      const text =
`[웰릭스모빌리티 견적서]
${custName}님, 안녕하세요. 요청하신 견적을 보내드립니다.

${vNames}

상세 견적 확인하기 ↓
${url}

— ${state.staff.name || '웰릭스 모빌리티'} (${state.staff.tel || ''})`;
      await navigator.clipboard.writeText(text);
      btn.innerHTML = '<i class="ph ph-check-circle"></i> 카톡 메시지 복사됨';
      btn.style.color = '#10b981';
      // 발송 후 견적 ID 표시 (영업사원 확인용)
      const noteEl = document.createElement('div');
      noteEl.style.cssText = 'padding:10px 14px; background:#10b98115; color:#0e8d62; font-size:11.5px; border-bottom:1px solid #d6f0e3;';
      noteEl.innerHTML = `<b>발송 준비 완료</b> · ID: <code>${id}</code> · 카톡에 붙여넣기(Ctrl+V) 하세요`;
      const body = $('quote-modal-body');
      body.insertBefore(noteEl, body.firstChild);
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; btn.disabled = false; }, 3000);
    } catch (e) {
      console.error('[send-link]', e);
      alert('링크 발송 실패: ' + (e.message || e));
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // 이미지 클립보드 복사 (카톡 붙여넣기용)
  $('btn-modal-copy-image')?.addEventListener('click', async () => {
    const btn = $('btn-modal-copy-image');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> 처리중...';
    btn.disabled = true;
    try {
      const canvas = await captureQuoteImage();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          btn.innerHTML = '<i class="ph ph-check"></i> 복사됨';
          btn.style.color = '#10b981';
          setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; btn.disabled = false; }, 1500);
        } catch (err) {
          alert('클립보드 복사 실패 — 브라우저가 지원하지 않거나 권한 거부됨.\n"이미지 저장"으로 다운로드 후 첨부하세요.');
          btn.innerHTML = orig; btn.disabled = false;
        }
      }, 'image/png');
    } catch (e) {
      console.error(e); alert('이미지 캡처 실패: ' + e.message);
      btn.innerHTML = orig; btn.disabled = false;
    }
  });

  // [링크 저장] 버튼 제거됨 — 견적바구니 → 손님 발송 으로 통합 (Firebase 저장 + 링크 발송)

  // 조회동의 링크 복사 — 매번 호출 가능, 명확한 피드백 (영업 도구로 자주 씀)
  let signLinkResetTimer = null;
  $('btn-copy-sign-link')?.addEventListener('click', async () => {
    const url = window.__welrix_companyConfig?.signature_link;
    if (!url) { alert('이 회사는 조회동의 링크가 설정되어 있지 않습니다.'); return; }
    const btn = $('btn-copy-sign-link');
    if (!btn._origHTML) btn._origHTML = btn.innerHTML;
    try {
      await navigator.clipboard.writeText(url);
      btn.innerHTML = '<i class="ph ph-check-circle"></i>복사 완료 (재복사 가능)';
      btn.style.color = '#10b981';
      btn.style.fontWeight = '500';
      if (signLinkResetTimer) clearTimeout(signLinkResetTimer);
      signLinkResetTimer = setTimeout(() => {
        btn.innerHTML = btn._origHTML;
        btn.style.color = '';
        btn.style.fontWeight = '';
        signLinkResetTimer = null;
      }, 3500);
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
    const meta = findVehicleMeta(v.brand, v.model, v.trim_name, v.variant, (v.trim_price_manwon || 0) * 10000);
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
        fees: { feeRatePct: state.cond.feeRatePct ?? 5.0, svc: state.cond.svc },
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
