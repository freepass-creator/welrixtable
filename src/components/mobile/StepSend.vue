<script setup>
import { ref, computed } from 'vue';
import { quoteState } from '../../store.js';
import { calcQuote } from '../../lib/calc.js';
import { saveQuote, buildQuoteUrl } from '../../firebase/quotes.js';
import { DELIVERY_REGIONS, ACCESSORIES, TINT_PRICES } from '../../data/lookups.js';

const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));

function fmtTel(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (/^01[016789]/.test(d) && d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.startsWith('02') && d.length === 10) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`;
  return t;
}
function onTelInput(e, key) {
  const v = fmtTel(e.target.value);
  if (key === 'cust') quoteState.cust.tel = v;
  else quoteState.staff.tel = v;
}

const sending = ref(false);
const sentLink = ref('');
const errorMsg = ref('');

// 비용 합산 (StickyQuote 와 동일 로직)
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

// 시나리오 계산 결과 (저장 시 함께 보냄)
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
          optPrice: optPrice.value, discount: 0,
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
      return {
        idx, term: s.term, dep: s.dep ?? 10, pre: s.pre ?? 0,
        monthly: r.monthly, depAmt: r.depAmt, preAmt: r.preAmt,
        residualAmt: r.residualAmt, residualPct: r.residualPct,
      };
    } catch { return null; }
  }).filter(Boolean);
});

async function buildPayload() {
  const v = quoteState.vehicle;
  return {
    customer: { ...quoteState.cust },
    staff:    { ...quoteState.staff },
    cond:     { ...quoteState.cond },
    vehicles: v ? [{
      brand: v.brand, model: v.model, variant: v.variant, trim_name: v.trim_name,
      totalKrw: (v.total_manwon || 0) * 10000,
      trim_price_manwon: v.trim_price_manwon, options_price_manwon: v.options_price_manwon || 0,
      options: v.options || [], colorExt: v.colorExt, colorInt: v.colorInt,
      fuel: v.fuel, displacement_cc: v.displacement_cc,
      monthly: monthlyResults.value,
    }] : [],
    send: [true, true, true],
    send_options: { showLogo: true },
    source: 'mobile',
  };
}

async function onSend() {
  if (!quoteState.vehicle) { errorMsg.value = '차량을 먼저 선택하세요'; return; }
  errorMsg.value = '';
  sending.value = true;
  try {
    const payload = await buildPayload();
    const { id, url } = await saveQuote(payload);
    sentLink.value = url;
  } catch (e) {
    errorMsg.value = '발송 실패: ' + (e?.message || e);
  } finally {
    sending.value = false;
  }
}

async function onCopyLink() {
  if (!sentLink.value) return;
  try {
    await navigator.clipboard.writeText(sentLink.value);
    alert('링크 복사 완료');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = sentLink.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('링크 복사 완료');
  }
}

async function onShareNative() {
  if (!sentLink.value) return;
  const text = `[${quoteState.vehicle?.brand} ${quoteState.vehicle?.model} ${quoteState.vehicle?.trim_name}] 견적서\n월 대여료부터 한 번에 확인하세요\n${sentLink.value}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: '신차 장기렌터카 견적서',
        text,
        url: sentLink.value,
      });
    } catch {}
  } else {
    onCopyLink();
  }
}
</script>

<template>
  <div class="ss">
    <h2 class="ss-title">손님께<br>견적서를 보낼게요</h2>

    <div class="ss-field">
      <label class="ss-label">손님 성함</label>
      <input v-model="quoteState.cust.name" placeholder="홍길동" class="ss-input" />
    </div>

    <div class="ss-field">
      <label class="ss-label">손님 연락처</label>
      <input
        :value="quoteState.cust.tel"
        @input="(e) => onTelInput(e, 'cust')"
        placeholder="010-0000-0000"
        inputmode="tel"
        class="ss-input"
      />
    </div>

    <div class="ss-divider"></div>

    <h3 class="ss-subtitle">담당자 정보</h3>
    <div class="ss-field">
      <label class="ss-label">담당자 이름</label>
      <input v-model="quoteState.staff.name" placeholder="홍길동 과장" class="ss-input" />
    </div>
    <div class="ss-field">
      <label class="ss-label">담당자 연락처</label>
      <input
        :value="quoteState.staff.tel"
        @input="(e) => onTelInput(e, 'staff')"
        placeholder="010-0000-0000"
        inputmode="tel"
        class="ss-input"
      />
    </div>

    <!-- 발송 액션 -->
    <div class="ss-actions">
      <button
        class="ss-action ss-action--primary"
        :disabled="sending"
        @click="sentLink ? onShareNative() : onSend()"
      >
        <i class="ph" :class="sending ? 'ph-spinner' : (sentLink ? 'ph-share-network' : 'ph-paper-plane-tilt')"></i>
        {{ sending ? '발송 중…' : (sentLink ? '공유하기' : '견적 링크 만들기') }}
      </button>

      <button v-if="sentLink" class="ss-action" @click="onCopyLink">
        <i class="ph ph-link"></i>
        링크 복사
      </button>

      <div v-if="sentLink" class="ss-link">
        <div class="ss-link__label">손님 링크</div>
        <div class="ss-link__url">{{ sentLink }}</div>
      </div>

      <div v-if="errorMsg" class="ss-error">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.ss-title {
  font-size: 22px; font-weight: 700;
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.ss-subtitle {
  font-size: 14px; font-weight: 600;
  color: var(--ink-2); margin: 0 0 14px;
}
.ss-divider { height: 1px; background: var(--line); margin: 24px 0; }

.ss-field { margin-bottom: 16px; }
.ss-label {
  display: block;
  font-size: 12.5px; color: var(--ink-3); font-weight: 500;
  margin-bottom: 6px;
}
.ss-input {
  width: 100%;
  height: 50px;
  padding: 0 14px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  font-family: inherit; font-size: 16px;
  color: var(--ink-1);
  outline: none;
  transition: border-color .12s;
}
.ss-input::placeholder { color: var(--ink-4); }
.ss-input:focus { border-color: var(--brand); }

.ss-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
.ss-action {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 52px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: var(--bg);
  font-family: inherit; font-size: 15px; font-weight: 600;
  color: var(--ink-1);
  cursor: pointer;
  transition: background .12s, border-color .12s;
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
  margin-top: 4px;
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
}
</style>
