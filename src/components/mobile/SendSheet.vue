<script setup>
import { ref, computed } from 'vue';
import { quoteState } from '../../store.js';
import { calcQuote } from '../../lib/calc.js';
import { buildOfficialQuoteHtml } from '../../lib/build-quote-html.js';
import { fmt, fmtTel } from '../../lib/format.js';
import * as Fees from '../../lib/compute-fees.js';

defineProps({ open: Boolean });
const emit = defineEmits(['close']);

function onStaffTelInput(e) {
  const v = fmtTel(e.target.value);
  quoteState.staff.tel = v;
  if (e.target.value !== v) e.target.value = v;
}

// 담당자 정보 완성 여부 — 비어있으면 펼친 상태, 있으면 collapsed
const staffFilled = computed(() => !!(quoteState.staff.name?.trim() && quoteState.staff.tel?.trim()));
const staffEditing = ref(false);

const errorMsg = ref('');

const optPrice = computed(() => Fees.optPrice(quoteState));
const deliveryFee = computed(() => Fees.deliveryFee(quoteState));
const itemsFee = computed(() => Fees.itemsFee(quoteState));

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
          itemsFee: itemsFee.value, etc: 0,
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

const imgLoading = ref(false);

// 견적서 이미지(PNG blob) 생성 — 공통 (복사/전송이 같이 씀)
async function buildQuoteBlob() {
  const v = quoteState.vehicle;
  if (!v) { errorMsg.value = '차량을 먼저 선택하세요'; return null; }
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
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  const canvas = await window.html2canvas(wrap.firstElementChild, { scale: 2, backgroundColor: '#fff', useCORS: true });
  document.body.removeChild(wrap);
  return await new Promise(r => canvas.toBlob(r, 'image/png'));
}

// 이미지 바로 전송 — 견적서 이미지 파일을 폰 기본 공유(카톡/문자 등)로
async function onShareImage() {
  if (imgLoading.value) return;
  errorMsg.value = ''; imgLoading.value = true;
  try {
    const blob = await buildQuoteBlob(); if (!blob) return;
    const file = new File([blob], 'welrix-견적서.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '신차 장기렌터카 견적서' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // 파일 공유 미지원 → 클립보드 복사로 대체
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('이 기기는 이미지 바로전송 미지원 — 이미지 복사됨, 카톡에 붙여넣기 하세요'); return; } catch {}
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `welrix-견적서-${Date.now()}.png`; a.click(); URL.revokeObjectURL(a.href);
  } catch (e) { errorMsg.value = '이미지 생성 실패: ' + (e?.message || e); }
  finally { imgLoading.value = false; }
}

// 이미지 복사 — 클립보드 (카톡 채팅창 붙여넣기용)
async function onCopyImage() {
  if (imgLoading.value) return;
  errorMsg.value = ''; imgLoading.value = true;
  try {
    const blob = await buildQuoteBlob(); if (!blob) return;
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('이미지 복사 완료 — 카톡 채팅창에 붙여넣기 하세요'); return; } catch {}
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `welrix-견적서-${Date.now()}.png`; a.click(); URL.revokeObjectURL(a.href);
  } catch (e) { errorMsg.value = '이미지 생성 실패: ' + (e?.message || e); }
  finally { imgLoading.value = false; }
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
        <!-- PRIMARY: 견적이미지 공유 → 견적서 이미지를 폰 기본 공유(카톡/문자)로 바로 -->
        <button
          class="ss-action ss-action--primary"
          :disabled="imgLoading"
          @click="onShareImage"
        >
          <i class="ph" :class="imgLoading ? 'ph-spinner' : 'ph-share-network'"></i>
          {{ imgLoading ? '견적서 생성 중…' : '견적이미지 공유' }}
        </button>

        <!-- 견적이미지 복사 (카톡 채팅창 붙여넣기) -->
        <button class="ss-action ss-action--ghost" :disabled="imgLoading" @click="onCopyImage">
          <i class="ph" :class="imgLoading ? 'ph-spinner' : 'ph-image'"></i>
          {{ imgLoading ? '생성 중…' : '견적이미지 복사' }}
        </button>
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
.ss-actions-row { display: flex; gap: 8px; }
.ss-actions-row .ss-action { flex: 1; }
.ss-action {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: var(--h-cta);
  border: 1.5px solid var(--line);
  border-radius: var(--r-card);
  background: var(--bg);
  font-family: inherit; font-size: var(--fs-lg); font-weight: var(--fw-semi);
  color: var(--ink-1); cursor: pointer;
  transition: background .12s, border-color .12s;
}
.ss-action i { font-size: 18px; }
.ss-action:active { background: var(--bg-soft); }
.ss-action--primary {
  background: var(--brand); color: #fff; border-color: var(--brand);
}
.ss-action--primary:active { background: var(--brand-700); }
.ss-action--ghost {
  font-size: var(--fs-md);
  color: var(--ink-2);
  background: var(--bg-soft);
  border-color: transparent;
}
.ss-action--ghost:active { background: var(--line); }
.ss-action:disabled { opacity: 0.5; cursor: not-allowed; }

.ss-link {
  padding: 12px 14px;
  background: var(--brand-50);
  border-radius: var(--r-chip);
  margin-top: 12px;
}
.ss-link__label {
  font-size: var(--fs-sm); color: var(--ink-3); font-weight: var(--fw-medium);
  margin-bottom: 4px;
}
.ss-link__url {
  font-size: var(--fs-md); color: var(--brand); font-weight: var(--fw-medium);
  word-break: break-all;
  font-family: ui-monospace, Menlo, monospace;
}
.ss-error {
  padding: 10px 14px;
  background: var(--bg-soft);
  color: var(--ink-1);
  border: 1px solid var(--line-2);
  border-radius: var(--r-chip);
  font-size: var(--fs-md);
  margin-top: 12px;
}
</style>
