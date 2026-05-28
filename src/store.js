// 공용 reactive store — Vue 컴포넌트와 기존 vanilla JS 모두 같은 참조 사용
// 기존 state 객체 구조 유지, Vue의 reactive() 로 감싸서 양방향 자동 동기화
import { reactive } from 'vue';

// === 차량 선택 (cascade) 상태 ===
// index.html 인라인 스크립트 'state' 와 syncToVueStore() 로 동기화됨
export const vehicleState = reactive({
  manufacturer: null,
  model: null,
  variant: null,
  trim: null,
  options: new Set(),
  color: null,
  tax_rate: '5',
  optionsForCurrentTrim: [],
  // 각 cascade 단계의 dropdown options (인라인이 채움)
  manufacturerOptions: [],  // [{ value, label, iconUrl }]
  modelOptions: [],         // [{ value, label }]
  variantOptions: [],       // [{ value, label }]
  trimOptions: [],          // [{ value, label }]
  exteriorColorOptions: [], // [{ value, label, swatch }]
  // 모바일 wizard sub-step 진행 — brand | model | variant | trim | options | colors
  subStep: 'brand',
});

// === 견적 조건 / 사용자 정보 / 기타 ===
// quote.js의 'state' 와 동일 모양
// 담당자 정보(이름·연락처·수수료율) — 영업자 본인 거라 매번 입력 번거로움 → localStorage 영속화
const STAFF_KEY = 'welrix_staff_v1';
const FEE_KEY = 'welrix_fee_v1';
const SEND_OPTS_KEY = 'welrix_send_opts_v1';
function loadSendOpts() {
  try {
    const raw = localStorage.getItem(SEND_OPTS_KEY);
    return raw ? JSON.parse(raw) : { showLogo: true };
  } catch { return { showLogo: true }; }
}
function persistSendOpts(o) {
  try { localStorage.setItem(SEND_OPTS_KEY, JSON.stringify(o)); } catch {}
}
function loadStaff() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : { name: '', tel: '' };
  } catch { return { name: '', tel: '' }; }
}
function persistStaff(s) {
  try { localStorage.setItem(STAFF_KEY, JSON.stringify(s)); } catch {}
}

// 영업이 제출한 계약 심사 요청 ID 목록 — 영업 브라우저에서 자기 요청 추적
const MY_CONTRACTS_KEY = 'welrix_my_contracts_v1';
function loadMyContracts() {
  try {
    const raw = localStorage.getItem(MY_CONTRACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function persistMyContracts(arr) {
  try { localStorage.setItem(MY_CONTRACTS_KEY, JSON.stringify(arr)); } catch {}
}
function loadFeeRate() {
  try {
    const v = parseFloat(localStorage.getItem(FEE_KEY));
    return isFinite(v) ? v : 5.0;
  } catch { return 5.0; }
}
function persistFeeRate(v) {
  try { localStorage.setItem(FEE_KEY, String(v)); } catch {}
}

export const quoteState = reactive({
  vehicle: null,            // {brand, model, variant, trim_name, total_manwon, ...}
  cond: {
    credit: '중신용', km: 2, dep: 10, pre: 0,
    feeRatePct: loadFeeRate(),
    deliveryRegion: '광역시', deliveryCity: '서울',
    svc: '웰스 Basic', insProperty: '1억', extraDriver: '없음',
    colorInt: '', colorIntPrice: 0,
    discount: 0,
  },
  _lastSentQuoteId: null,
  myContracts: loadMyContracts(),  // 내가 제출한 계약 심사 요청 id 들
  tint: { product: '루마 GG', areas: new Set(['front', 'side_rear_with_coupon']) },
  extras: { blackbox: '', navi: '', hipass: '' },
  cust:  { name: '', tel: '' },
  staff: loadStaff(),  // ← 영업 본인 정보 자동 로드
  send: [true, true, true],
  send_options: loadSendOpts(),  // { showLogo: bool }
  scenarios: [
    { term: 60, dep: 10, pre: 0 },
    { term: 48, dep: 10, pre: 0 },
    { term: 36, dep: 10, pre: 0 },
  ],  // 24개월 운영 안 함
  // 계산된 월대여료 결과 (recompute가 채움) — TermsGrid 컴포넌트가 reactive 읽음
  monthly: [],
  // 기본 견적 — 36/48/60 × 보증금10% 선납0% 고정 (recompute 가 같이 채움)
  // ReferenceGrid 컴포넌트가 read-only 로 표시
  referenceMonthly: [],
});

// 담당자 정보(이름/연락처) + 수수료율 + 발송옵션 자동 저장
import { watch } from 'vue';
watch(() => ({ name: quoteState.staff.name, tel: quoteState.staff.tel }),
      (newVal) => persistStaff(newVal),
      { deep: true });
watch(() => quoteState.cond.feeRatePct,
      (v) => { if (typeof v === 'number' && isFinite(v)) persistFeeRate(v); });
watch(() => ({ ...quoteState.send_options }),
      (v) => persistSendOpts(v),
      { deep: true });
watch(() => [...quoteState.myContracts],
      (v) => persistMyContracts(v),
      { deep: true });

// 위쪽 조건 폼의 보증금/선납금이 바뀌면
//   1) 손님용 시나리오 일괄 sync (사용자는 그 뒤 각 시나리오 개별 override 가능)
//   2) 기본 견적 섹션 타이틀의 힌트 span 즉시 갱신 (차량 미선택 상태에서도)
//   3) recompute 호출 → 기본/손님 견적 양쪽 재계산 (차량 있을 때만 실효)
watch(() => quoteState.cond.dep, (raw) => {
  const v = +raw;
  if (!isFinite(v)) return;
  quoteState.scenarios.forEach((sc) => { sc.dep = v; });
  window.__welrix_recompute?.();
});
watch(() => quoteState.cond.pre, (raw) => {
  const v = +raw;
  if (!isFinite(v)) return;
  quoteState.scenarios.forEach((sc) => { sc.pre = v; });
  window.__welrix_recompute?.();
});

// === 견적 장바구니 — 한 손님에게 N차종 보낼 때 ===
// localStorage 영속화 (수동 삭제 전까지 유지)
const CART_KEY = 'welrix_cart_v1';
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { vehicles: [] };
    const parsed = JSON.parse(raw);
    return { vehicles: parsed.vehicles || [] };
  } catch { return { vehicles: [] }; }
}
export const cartStore = reactive({
  // [{ id, brand, model, variant, trim_name, total_manwon, options[], colorExt,
  //    colorInt, tax_rate, monthly[], snapshot: {tint, extras, deliveryFee, accessoryFee, tintFee}, addedAt }]
  vehicles: loadCart().vehicles,
});

function persistCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify({ vehicles: cartStore.vehicles })); } catch {}
}

function cartKey(item) {
  return `${item.brand}|${item.model}|${item.variant}|${item.trim_name}`;
}
export function findCartItem(item) {
  const k = cartKey(item);
  return cartStore.vehicles.find(v => cartKey(v) === k) || null;
}
export function addToCart(item) {
  // 같은 차종(brand+model+variant+trim) 이미 있으면 monthly 등을 갱신
  const idx = cartStore.vehicles.findIndex(v => cartKey(v) === cartKey(item));
  // selected 기본값 true — 견적바구니에서 발송 대상으로 자동 체크
  const enriched = {
    ...item,
    id: idx >= 0 ? cartStore.vehicles[idx].id : (item.id || `c-${Date.now()}-${Math.random().toString(36).slice(2,7)}`),
    addedAt: Date.now(),
    selected: item.selected !== false,
  };
  const wasExisting = idx >= 0;
  if (idx >= 0) cartStore.vehicles.splice(idx, 1, enriched);
  else cartStore.vehicles.push(enriched);
  persistCart();
  return { id: enriched.id, updated: wasExisting };
}
export function removeFromCart(id) {
  const i = cartStore.vehicles.findIndex(v => v.id === id);
  if (i >= 0) { cartStore.vehicles.splice(i, 1); persistCart(); }
}
export function clearCart() {
  cartStore.vehicles.splice(0, cartStore.vehicles.length);
  persistCart();
}
export function toggleCartItem(id) {
  const v = cartStore.vehicles.find(x => x.id === id);
  if (v) { v.selected = !(v.selected !== false); persistCart(); }
}
export function setCartAllSelected(val) {
  cartStore.vehicles.forEach(v => v.selected = !!val);
  persistCart();
}

// === 계약 접수 (서류 업로드) ===
export const docStore = reactive({
  license: null,           // File | null
  attachments: [],         // File[]
});

// === 채팅 대화명 — 자동 부여 후 영속 (사용자가 직접 바꾸기 전까지 동일)
// 패턴: '영업담당자' + 4자리 random (예: 영업담당자4821)
const CHAT_NICK_KEY = 'welrix_chat_nick_v1';
function loadChatNick() {
  try {
    const v = localStorage.getItem(CHAT_NICK_KEY);
    if (v) return v;
  } catch {}
  // 첫 접속 — 자동 부여 + 영속
  const n = String(Math.floor(1000 + Math.random() * 9000));
  const generated = `영업담당자${n}`;
  try { localStorage.setItem(CHAT_NICK_KEY, generated); } catch {}
  return generated;
}
function persistChatNick(v) {
  try { localStorage.setItem(CHAT_NICK_KEY, v); } catch {}
}
export const chatStore = reactive({
  messages: [],            // [{ id, sender, name, text, at, uid }]
  nickname: loadChatNick(),
});
// 변경 즉시 저장
watch(() => chatStore.nickname, (v) => {
  if (v && typeof v === 'string') persistChatNick(v.trim());
});

// 글로벌 노출 — 기존 vanilla JS 코드에서 window.__welrix_store 로 접근
if (typeof window !== 'undefined') {
  window.__welrix_store = { vehicleState, quoteState, docStore, chatStore, cartStore };
  window.__welrix_cart = { addToCart, removeFromCart, clearCart, toggleCartItem, setCartAllSelected, findCartItem, cartStore };
}
