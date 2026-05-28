<script setup>
import { ref, computed } from 'vue';
import { quoteState, vehicleState } from '../../store.js';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import * as Fees from '../../lib/compute-fees.js';

const expanded = ref(false);
function toggle() { expanded.value = !expanded.value; }

// 스와이프 제스처 — 손잡이/요약 영역에서 위로 끌면 펼침, 아래로 끌면 접힘
const SWIPE_THRESHOLD = 30;  // px — 이 이상 움직여야 스와이프로 인식
let touchStartY = 0;
let touchStartT = 0;
function onTouchStart(e) {
  touchStartY = e.touches[0].clientY;
  touchStartT = Date.now();
}
function onTouchEnd(e) {
  const endY = (e.changedTouches?.[0] || {}).clientY ?? touchStartY;
  const dy = endY - touchStartY;
  const dt = Date.now() - touchStartT;
  // 짧은 탭(움직임 작고 빠른 터치) 은 무시 — @click 이 처리
  if (Math.abs(dy) < SWIPE_THRESHOLD || dt > 500) return;
  if (dy < 0) expanded.value = true;     // 위로 → 펼침
  else        expanded.value = false;    // 아래로 → 접힘
  e.preventDefault();  // tap 으로 토글되지 않도록
}

// 비용 — lib/compute-fees.js 통합 함수 사용
const optPrice = computed(() => Fees.optPrice(quoteState));
const deliveryFee = computed(() => Fees.deliveryFee(quoteState));
const itemsFee = computed(() => Fees.itemsFee(quoteState));

// 전체 기간 (체크 안된 것도 카드는 표시) — 60 / 48 / 36 항상
const ALL_TERMS = [60, 48, 36];

function isChecked(term) {
  return (quoteState.scenarios || []).some(s => s.term === term);
}

function toggleTerm(term) {
  const list = quoteState.scenarios || [];
  const idx = list.findIndex(s => s.term === term);
  if (idx >= 0) {
    if (list.length === 1) return;  // 최소 1개 유지
    list.splice(idx, 1);
  } else {
    list.push({ term, dep: quoteState.cond.dep || 10, pre: quoteState.cond.pre || 0 });
    list.sort((a, b) => b.term - a.term);
  }
}

// 모든 기간에 대해 계산 (선택 여부와 무관)
const scenarios = computed(() => {
  const v = quoteState.vehicle;
  if (!v || !v._src) return [];
  const t = v._src;
  return ALL_TERMS.map((term) => {
    const s = (quoteState.scenarios || []).find(x => x.term === term)
              || { term, dep: quoteState.cond.dep || 10, pre: quoteState.cond.pre || 0 };
    try {
      const result = calcQuote({
        vehicle: {
          brand: t.brand, model: t.model, trim: t.trim, price: t.price,
          disp: t.disp, fuel: t.fuel, tax_exempt: t.tax_exempt, group: t.group,
          multi_seat: t.multi_seat,
          r24: t.r24, r36: t.r36, r48: t.r48, r60: t.r60,
          strategic: t.strategic, buyback_apply: t.buyback_apply,
        },
        options: {
          optPrice: optPrice.value,
          discount: (quoteState.cond.discount || 0) * 10000,  // 만원 → 원
          deliveryFee: deliveryFee.value,
          itemsFee: itemsFee.value,
          etc: 0,
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
        term: s.term, dep: s.dep, pre: s.pre,
        monthly: result.monthly,
        residualAmt: result.residualAmt, residualPct: result.residualPct,
        depAmt: result.depAmt, preAmt: result.preAmt,
        checked: isChecked(s.term),
      };
    } catch (e) {
      return { term: s.term, monthly: null, checked: isChecked(s.term) };
    }
  });
});
</script>

<template>
  <div class="sq" :class="{ 'sq--expanded': expanded }">
    <button
      class="sq-handle"
      @click="toggle"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      aria-label="견적 펼치기 (탭 또는 위로 스와이프)"
    >
      <span class="sq-handle__bar"></span>
    </button>

    <!-- 라벨 — 탭 + 스와이프 둘 다 지원 -->
    <div
      class="sq-summary"
      @click="toggle"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="sq-summary__label">
        월 대여료
        <span class="sq-summary__hint">VAT 포함 · 체크된 기간만 발송</span>
      </div>
      <i class="ph sq-summary__caret" :class="expanded ? 'ph-caret-down' : 'ph-caret-up'"></i>
    </div>

    <!-- 기간별 카드 — 클릭으로 체크/해제, 체크된 것만 발송 -->
    <div class="sq-terms" v-if="scenarios.length">
      <button
        v-for="s in scenarios" :key="s.term"
        class="sq-term-card"
        :class="{ 'is-checked': s.checked }"
        @click="toggleTerm(s.term)"
      >
        <i class="ph sq-term-card__check"
           :class="s.checked ? 'ph-check-circle-fill' : 'ph-circle'"></i>
        <div class="sq-term-card__term">{{ s.term }}개월</div>
        <div class="sq-term-card__monthly">
          <template v-if="s.monthly">{{ fmt(s.monthly) }}<em>원</em></template>
          <template v-else><span class="muted">—</span></template>
        </div>
      </button>
    </div>
    <div v-else class="sq-empty">차량 선택 후 계산</div>

    <!-- 펼침 — PC 견적표 (약정주행/만기인수/보증금/선납/정비) -->
    <div v-if="expanded && scenarios.length" class="sq-detail">
      <table class="sq-table">
        <thead>
          <tr>
            <th class="sq-table__rowlabel">구분</th>
            <th v-for="s in scenarios" :key="s.term"
                :class="{ 'is-dim': !s.checked }">{{ s.term }}개월</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="quoteState.cond.discount">
            <th class="sq-table__rowlabel">추가 할인</th>
            <td v-for="s in scenarios" :key="s.term" class="sq-table__discount">
              −{{ fmt(quoteState.cond.discount) }}만원
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">약정주행</th>
            <td v-for="s in scenarios" :key="s.term">{{ quoteState.cond.km || 2 }}만km/년</td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">만기인수</th>
            <td v-for="s in scenarios" :key="s.term">
              <template v-if="s.residualAmt">
                {{ (s.residualPct * 100).toFixed(0) }}%<br>
                <small>{{ fmt(s.residualAmt) }}원</small>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">정비서비스</th>
            <td v-for="s in scenarios" :key="s.term">{{ quoteState.cond.svc || '웰스 Basic' }}</td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">보증금</th>
            <td v-for="s in scenarios" :key="s.term">
              {{ s.dep || quoteState.cond.dep || 0 }}%<br>
              <small v-if="s.depAmt">{{ fmt(s.depAmt) }}원</small>
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">선납금</th>
            <td v-for="s in scenarios" :key="s.term">
              {{ s.pre || quoteState.cond.pre || 0 }}%<br>
              <small v-if="s.preAmt">{{ fmt(s.preAmt) }}원</small>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="sq-meta">
        <div class="sq-meta__row">
          <span class="sq-meta__key">차량</span>
          <span class="sq-meta__val">{{ quoteState.vehicle?.brand }} {{ quoteState.vehicle?.model }} {{ quoteState.vehicle?.trim_name }}</span>
        </div>
        <div class="sq-meta__row">
          <span class="sq-meta__key">신용</span>
          <span class="sq-meta__val">{{ quoteState.cond.credit || '중신용' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sq {
  position: fixed; bottom: 78px; left: 0; right: 0;
  background: var(--bg);
  border-top: 1px solid var(--line);
  border-radius: var(--r-sheet) var(--r-sheet) 0 0;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.06);
  padding-bottom: 8px;
  z-index: 25;
  transition: max-height .25s;
  max-height: 175px;
  overflow: hidden;
}
.sq--expanded {
  max-height: 75vh; overflow-y: auto;
}

.sq-handle {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 18px;
  border: 0; background: transparent;
  cursor: pointer;
}
.sq-handle__bar {
  width: 38px; height: 4px;
  background: var(--line-2);
  border-radius: 2px;
}

.sq-summary {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 20px 8px;
  cursor: pointer;
}
.sq-summary__label {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 11.5px; color: var(--ink-3); font-weight: 500;
}
.sq-summary__hint { font-size: 10px; color: var(--ink-4); }
.sq-summary__caret { font-size: 16px; color: var(--ink-3); }

/* 기간 카드 grid — 항상 표시 */
.sq-terms {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
  padding: 0 16px 6px;
}
.sq-term-card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 6px 8px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: var(--r-card);
  font-family: inherit;
  cursor: pointer;
  transition: background .12s, border-color .12s;
}
.sq-term-card:active { background: var(--brand-50); }
.sq-term-card.is-checked {
  border-color: var(--brand);
  background: var(--brand-50);
}
.sq-term-card__check {
  font-size: 16px;
  color: var(--ink-4);
}
.sq-term-card.is-checked .sq-term-card__check { color: var(--brand); }
.sq-term-card__term {
  font-size: 11px; color: var(--ink-3); font-weight: 500;
}
.sq-term-card__monthly {
  font-size: 15px; font-weight: 700; color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.4px;
}
.sq-term-card__monthly em {
  font-style: normal; font-size: 10px; color: var(--ink-3);
  font-weight: 500;
  margin-left: 1px;
}
.sq-term-card.is-checked .sq-term-card__monthly { color: var(--brand); }

.sq-empty {
  padding: 20px 16px;
  text-align: center;
  color: var(--ink-4); font-size: 13px;
}

/* 펼침 표 — PC 견적표 형태 */
.sq-detail {
  border-top: 1px solid var(--line);
  padding: 12px 16px;
}
.sq-table {
  width: 100%; border-collapse: collapse;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}
.sq-table th, .sq-table td {
  padding: 7px 4px;
  text-align: center;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
  line-height: 1.3;
}
.sq-table thead th {
  background: var(--bg-soft);
  font-weight: 600; color: var(--ink-1);
  font-size: 11.5px;
  border-bottom: 1.5px solid var(--brand);
}
.sq-table__rowlabel {
  text-align: left !important;
  color: var(--ink-3); font-weight: 500;
  font-size: 11px;
  background: var(--bg-soft);
  width: 60px;
  padding-left: 8px !important;
}
.sq-table small {
  font-size: 10px; color: var(--ink-3); font-weight: 400;
}
.sq-table tbody tr:last-child th,
.sq-table tbody tr:last-child td {
  border-bottom: 0;
}
.sq-table thead th.is-dim {
  color: var(--ink-4);
  opacity: 0.5;
}
.sq-table__discount {
  color: var(--brand); font-weight: var(--fw-semi);
}

/* 메타 */
.sq-meta { padding-top: 4px; }
.sq-meta__row {
  display: flex; justify-content: space-between;
  padding: 5px 0;
  font-size: 12.5px;
}
.sq-meta__key { color: var(--ink-3); }
.sq-meta__val {
  color: var(--ink-1); font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  max-width: 65%;
}
</style>
