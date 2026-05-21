<script setup>
import { ref, computed } from 'vue';
import { quoteState } from '../../store.js';
import { calcQuote } from '../../lib/calc.js';
import { saveQuote, buildQuoteUrl } from '../../firebase/quotes.js';
import { buildOfficialQuoteHtml } from '../../lib/build-quote-html.js';
import { fmt, fmtTel } from '../../lib/format.js';
import { DELIVERY_REGIONS, ACCESSORIES, TINT_PRICES } from '../../data/lookups.js';

defineProps({ open: Boolean });
const emit = defineEmits(['close']);

function onStaffTelInput(e) {
  quoteState.staff.tel = fmtTel(e.target.value);
}

// 담당자 정보 완성 여부 — 비어있으면 펼친 상태, 있으면 collapsed
const staffFilled = computed(() => !!(quoteState.staff.name?.trim() && quoteState.staff.tel?.trim()));
const staffEditing = ref(false);

const sending = ref(false);
const sentLink = ref('');
const errorMsg = ref('');

const optPrice = computed(() => {
  const v = quoteState.vehicle;
  return (v?.options_price_manwon || 0) * 10000 + (quoteState.cond.colorIntPrice || 0);
});
const deliveryFee = computed(() => DELIVERY_REGIONS[quoteState.cond.deliveryRegion]?.[quoteState.cond.deliveryCity] || 0);
const tintFee = computed(() => {
  const p = quoteState.tint?.product; const areas = quoteState.tint?.areas;
  if (!p || !areas?.size || !TINT_PRICES[p]) return 0;
  let t = 0; areas.forEach(a => { t += TINT_PRICES[p][a] || 0; }); return t;
});
const accessoryFee = computed(() => {
  const e = quoteState.extras || {};
  return (ACCESSORIES.blackbox[e.blackbox] || 0) + (ACCESSORIES.navi[e.navi] || 0) + (ACCESSORIES.hipass[e.hipass] || 0);
});

const monthlyResults = computed(() => {
  const v = quoteState.vehicle;
  if (!v || !v._src) return [];
  const t = v._src;
  return (quoteState.scenarios || []).map((s, idx) => {
    try {
      const r = calcQuote({
        vehicle: {
          brand: t.brand, model: t.model, trim: t.trim, price: t.price,
          disp: t.disp, fuel: t.fuel, tax_exempt: t.tax_exempt, group: t.group,
          multi_seat: t.multi_seat,
          r24: t.r24, r36: t.r36, r48: t.r48, r60: t.r60,
          strategic: t.strategic, buyback_apply: t.buyback_apply,
        },
        options:  {
          optPrice: optPrice.value,
          discount: (quoteState.cond.discount || 0) * 10000,
          deliveryFee: deliveryFee.value,
          itemsFee: tintFee.value + accessoryFee.value, etc: 0,
        },
        contract: { term: s.term, km: (quoteState.cond.km || 2) + '만km', dep: s.dep ?? 10, pre: s.pre ?? 0 },
        customer: { creditGrade: quoteState.cond.credit || '중신용' },
        insurance: {
          property: quoteState.cond.insProperty || '1억',
          extraDriver: quoteState.cond.extraDriver || '없음',
          exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
          deductible: '30만원~', emergency: '가입',
        },
        fees: { feeRatePct: quoteState.cond.feeRatePct ?? 5.0, svc: quoteState.cond.svc || '웰스 Basic' },
      });
      return { idx, term: s.term, dep: s.dep ?? 10, pre: s.pre ?? 0,
        monthly: r.monthly, depAmt: r.depAmt, preAmt: r.preAmt,
        residualAmt: r.residualAmt, residualPct: r.residualPct };
    } catch { return null; }
  }).filter(Boolean);
});

async function ensureQuoteSaved() {
  if (sentLink.value) return sentLink.value;
  const v = quoteState.vehicle;
  if (!v) { errorMsg.value = '차량을 먼저 선택하세요'; return null; }
  errorMsg.value = '';
  sending.value = true;
  try {
    // 손님 이름 비어있으면 기본 "VIP 고객님" — 담당자는 staff localStorage 자동 영속
    const custCopy = { ...quoteState.cust };
    if (!custCopy.name?.trim()) custCopy.name = 'VIP 고객님';
    const payload = {
      customer: custCopy,
      staff:    { ...quoteState.staff },
      cond:     { ...quoteState.cond },
      vehicles: [{
        brand: v.brand, model: v.model, variant: v.variant, trim_name: v.trim_name,
        totalKrw: (v.total_manwon || 0) * 10000,
        trim_price_manwon: v.trim_price_manwon, options_price_manwon: v.options_price_manwon || 0,
        options: v.options || [], colorExt: v.colorExt, colorInt: v.colorInt,
        fuel: v.fuel, displacement_cc: v.displacement_cc,
        monthly: monthlyResults.value,
      }],
      send: [true, true, true],
      send_options: { ...quoteState.send_options },
      source: 'mobile',
    };
    const { url } = await saveQuote(payload);
    sentLink.value = url;
    return url;
  } catch (e) {
    errorMsg.value = '발송 실패: ' + (e?.message || e);
    return null;
  } finally {
    sending.value = false;
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed; left:-9999px; top:0; opacity:0;';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  return ok;
}

async function onCopyLink() {
  const url = await ensureQuoteSaved();
  if (!url) return;
  // 1. 시큐어 컨텍스트 + clipboard API
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      alert('링크 복사 완료\n' + url);
      return;
    } catch (e) { /* fallback */ }
  }
  // 2. textarea + execCommand
  if (fallbackCopyText(url)) {
    alert('링크 복사 완료\n' + url);
    return;
  }
  // 3. 최종 fallback — share API 또는 alert 표시
  if (navigator.share) {
    try { await navigator.share({ url, text: url }); return; } catch {}
  }
  // 최후 — 사용자가 직접 복사
  prompt('아래 링크를 복사해 손님에게 보내세요', url);
}

async function onShareNative() {
  const url = await ensureQuoteSaved();
  if (!url) return;
  const v = quoteState.vehicle;
  const text = `[${v?.brand} ${v?.model} ${v?.trim_name}] 견적서\n${url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '신차 장기렌터카 견적서', text, url });
    } catch {}
  } else {
    onCopyLink();
  }
}

const imgLoading = ref(false);
async function onSaveImage() {
  if (imgLoading.value) return;
  const v = quoteState.vehicle;
  if (!v) { errorMsg.value = '차량을 먼저 선택하세요'; return; }
  errorMsg.value = '';
  imgLoading.value = true;
  try {
    // 견적서 HTML 생성 (PC 와 동일)
    const today = new Date();
    const todayStr = today.toLocaleDateString('ko-KR');
    const expireStr = new Date(today.getTime() + 7*86400000).toLocaleDateString('ko-KR');
    const html = buildOfficialQuoteHtml({
      vehicles: [{
        ...v,
        totalKrw: (v.total_manwon || 0) * 10000,
        monthly: monthlyResults.value.map(r => ({ ...r, term: r.term, monthly: r.monthly, dep: r.dep, depAmt: r.depAmt, pre: r.pre, preAmt: r.preAmt, residualAmt: r.residualAmt, residualPct: r.residualPct })),
      }],
      customer: { name: quoteState.cust.name?.trim() || 'VIP 고객님', tel: quoteState.cust.tel },
      staff: { ...quoteState.staff },
      cond: { ...quoteState.cond },
      send: [true, true, true],
      quoteMeta: { quoteNo: today.toISOString().slice(0,10).replace(/-/g,'') + '-M' + String(Date.now()).slice(-4), todayStr, expireStr },
      companyConfig: window.__welrix_companyConfig || {},
      showLogo: quoteState.send_options.showLogo !== false,
    });

    // 오프스크린에 렌더 후 html2canvas 캡쳐
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm;';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const canvas = await window.html2canvas(wrap.firstElementChild, { scale: 2, backgroundColor: '#fff', useCORS: true });
    document.body.removeChild(wrap);

    // canvas → blob → clipboard 우선, fallback share/다운로드
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));

    // 1. clipboard 이미지 (사용자가 카톡에 직접 붙여넣기 가능)
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('이미지 복사 완료 — 카톡 채팅창에 붙여넣기 하세요');
        return;
      } catch {}
    }
    // 2. 네이티브 공유 (파일 첨부)
    const file = new File([blob], 'welrix-quote.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '견적서' });
      return;
    }
    // 3. 다운로드
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `welrix-quote-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    errorMsg.value = '이미지 생성 실패: ' + (e?.message || e);
  } finally {
    imgLoading.value = false;
  }
}

function close() { emit('close'); }
</script>

<template>
  <div v-if="open" class="ss-backdrop" @click.self="close">
    <div class="ss-sheet">
      <button class="ss-handle" @click="close" aria-label="닫기">
        <span class="ss-handle__bar"></span>
      </button>

      <h2 class="ss-title">견적서 보내기</h2>

      <div class="ss-field">
        <label class="ss-label">손님 성함</label>
        <input v-model="quoteState.cust.name" placeholder="VIP 고객님 (기본)" class="ss-input" />
      </div>

      <!-- 담당자 정보 — 한번 입력하면 영속 (localStorage) -->
      <div class="ss-staff" v-if="staffFilled && !staffEditing">
        <div class="ss-staff__row">
          <i class="ph ph-user-circle"></i>
          <span class="ss-staff__name">{{ quoteState.staff.name }}</span>
          <span class="ss-staff__sep">·</span>
          <span class="ss-staff__tel">{{ quoteState.staff.tel }}</span>
          <button class="ss-staff__edit" @click="staffEditing = true">수정</button>
        </div>
      </div>
      <div v-else class="ss-staff-edit">
        <div class="ss-staff-edit__title">담당자 정보 (한번만 입력)</div>
        <div class="ss-field">
          <label class="ss-label">담당자 이름</label>
          <input v-model="quoteState.staff.name" placeholder="홍길동 과장" class="ss-input" />
        </div>
        <div class="ss-field">
          <label class="ss-label">담당자 연락처</label>
          <input
            :value="quoteState.staff.tel"
            @input="onStaffTelInput"
            placeholder="010-0000-0000"
            inputmode="tel"
            class="ss-input"
          />
        </div>
        <button v-if="staffEditing" class="ss-staff__done" @click="staffEditing = false">완료</button>
      </div>

      <!-- CI 제외 토글 — 발송 액션 위에 명확하게 -->
      <label class="ss-ci">
        <div class="ss-ci__left">
          <div class="ss-ci__label">웰릭스 CI 제외하고 발송</div>
          <div class="ss-ci__hint">로고 없이 견적서 작성</div>
        </div>
        <input type="checkbox" class="ss-ci__input"
               :checked="!quoteState.send_options.showLogo"
               @change="quoteState.send_options.showLogo = !$event.target.checked" />
        <span class="ss-ci__switch"></span>
      </label>

      <div class="ss-actions">
        <button class="ss-action" :disabled="imgLoading" @click="onSaveImage">
          <i class="ph" :class="imgLoading ? 'ph-spinner' : 'ph-image'"></i>
          {{ imgLoading ? '이미지 생성 중…' : '이미지 복사하기' }}
        </button>
        <button class="ss-action" :disabled="sending" @click="onCopyLink">
          <i class="ph" :class="sending ? 'ph-spinner' : 'ph-link'"></i>
          {{ sending ? '준비 중…' : '링크 복사하기' }}
        </button>
        <button
          class="ss-action ss-action--primary"
          :disabled="sending"
          @click="onShareNative"
        >
          <i class="ph ph-chat-circle"></i>
          카톡으로 바로 전송
        </button>
      </div>

      <div v-if="sentLink" class="ss-link">
        <div class="ss-link__label">손님 링크</div>
        <div class="ss-link__url">{{ sentLink }}</div>
      </div>
      <div v-if="errorMsg" class="ss-error">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.ss-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
  animation: ssFadeIn .2s ease-out;
}
@keyframes ssFadeIn { from { opacity: 0; } to { opacity: 1; } }

.ss-sheet {
  width: 100%;
  background: var(--bg);
  border-radius: var(--r-sheet) var(--r-sheet) 0 0;
  padding: 0 20px calc(var(--safe-bottom) + 20px);
  max-height: 85vh;
  overflow-y: auto;
  animation: ssSlideUp .25s ease-out;
}
@keyframes ssSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.ss-handle {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 28px;
  border: 0; background: transparent;
  cursor: pointer;
}
.ss-handle__bar {
  width: 38px; height: 4px;
  background: var(--line-2);
  border-radius: 2px;
}

.ss-title {
  font-size: var(--fs-xl); font-weight: var(--fw-bold);
  color: var(--ink-1);
  letter-spacing: -0.3px;
  margin: 0 0 18px;
}

/* CI 제외 — iOS 스타일 토글 switch row */
.ss-ci {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  margin-top: 8px;
  background: var(--bg-soft);
  border-radius: var(--r-card);
  cursor: pointer;
  position: relative;
}
.ss-ci__left { flex: 1; min-width: 0; }
.ss-ci__label {
  font-size: var(--fs-lg); font-weight: var(--fw-semi);
  color: var(--ink-1); letter-spacing: -0.3px;
}
.ss-ci__hint {
  font-size: var(--fs-xs); color: var(--ink-3);
  margin-top: 2px;
}
.ss-ci__input {
  position: absolute; opacity: 0; pointer-events: none;
}
.ss-ci__switch {
  flex-shrink: 0;
  position: relative;
  width: 52px; height: 30px;
  background: var(--line-2);
  border-radius: 999px;
  transition: background .2s;
}
.ss-ci__switch::after {
  content: '';
  position: absolute;
  left: 3px; top: 3px;
  width: 24px; height: 24px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: transform .2s;
}
.ss-ci__input:checked ~ .ss-ci__switch {
  background: var(--brand);
}
.ss-ci__input:checked ~ .ss-ci__switch::after {
  transform: translateX(22px);
}

.ss-field { margin-bottom: 14px; }
.ss-label {
  display: block;
  font-size: var(--fs-sm); color: var(--ink-3); font-weight: var(--fw-medium);
  margin-bottom: 6px;
}

/* 담당자 정보 — collapsed 뷰 */
.ss-staff {
  padding: 12px 14px;
  background: var(--bg-soft);
  border-radius: var(--r-chip);
  margin-bottom: 14px;
}
.ss-staff__row {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--fs-md); color: var(--ink-2);
}
.ss-staff__row i { font-size: 18px; color: var(--ink-3); }
.ss-staff__name { font-weight: var(--fw-semi); color: var(--ink-1); }
.ss-staff__sep { color: var(--ink-4); }
.ss-staff__tel { font-variant-numeric: tabular-nums; }
.ss-staff__edit {
  margin-left: auto;
  background: transparent; border: 0;
  color: var(--brand); font-weight: var(--fw-semi);
  font-size: var(--fs-md); font-family: inherit;
  cursor: pointer;
}
/* 담당자 — editing 뷰 */
.ss-staff-edit {
  padding: 14px;
  background: var(--bg-soft);
  border-radius: var(--r-chip);
  margin-bottom: 14px;
}
.ss-staff-edit__title {
  font-size: var(--fs-sm); color: var(--ink-3); font-weight: var(--fw-medium);
  margin-bottom: 10px;
}
.ss-staff__done {
  width: 100%; height: 40px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: var(--r-chip);
  font-family: inherit; font-size: var(--fs-md); font-weight: var(--fw-semi);
  cursor: pointer; margin-top: 4px;
}
.ss-input {
  width: 100%;
  height: var(--h-input);
  padding: 0 14px;
  border: 1.5px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--bg);
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
}
.ss-input:focus { border-color: var(--brand); }

.ss-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
.ss-action {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: var(--h-cta);
  border: 1.5px solid var(--line);
  border-radius: var(--r-card);
  background: var(--bg);
  font-family: inherit; font-size: var(--fs-lg); font-weight: var(--fw-semi);
  color: var(--ink-1); cursor: pointer;
}
.ss-action i { font-size: 18px; }
.ss-action:active { background: var(--bg-soft); }
.ss-action--primary {
  background: var(--brand); color: #fff; border-color: var(--brand);
}
.ss-action--primary:active { background: var(--brand-700); }
.ss-action:disabled { opacity: 0.6; cursor: not-allowed; }

.ss-link {
  padding: 12px 14px;
  background: var(--brand-50);
  border-radius: 10px;
  margin-top: 12px;
}
.ss-link__label {
  font-size: 11.5px; color: var(--ink-3); font-weight: 500;
  margin-bottom: 4px;
}
.ss-link__url {
  font-size: 13px; color: var(--brand); font-weight: 500;
  word-break: break-all;
  font-family: ui-monospace, Menlo, monospace;
}
.ss-error {
  padding: 10px 14px;
  background: #fff1f1;
  color: #c62828;
  border-radius: 10px;
  font-size: 13px;
  margin-top: 12px;
}
</style>
