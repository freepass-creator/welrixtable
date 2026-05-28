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

// 선택 가능한 기간 — PC TermsGrid 와 동일
const TERM_OPTIONS = [12, 24, 36, 48, 60];

// state.scenarios 가 3슬롯 미만이면 채워서 항상 3개 유지
while (quoteState.scenarios.length < 3) {
  quoteState.scenarios.push({ term: 36, dep: 10, pre: 0 });
}
if (!Array.isArray(quoteState.send) || quoteState.send.length < quoteState.scenarios.length) {
  quoteState.send = quoteState.scenarios.map(() => true);
}

function onTermChange(idx, e) {
  quoteState.scenarios[idx].term = +e.target.value;
}
function onDepChange(idx, e) {
  const v = Math.max(0, Math.min(100, +e.target.value || 0));
  e.target.value = v;
  quoteState.scenarios[idx].dep = v;
}
function onPreChange(idx, e) {
  const v = Math.max(0, Math.min(100, +e.target.value || 0));
  e.target.value = v;
  quoteState.scenarios[idx].pre = v;
}
function onSendToggle(idx) {
  quoteState.send[idx] = !quoteState.send[idx];
}

// 각 시나리오 슬롯(0/1/2)에 대해 계산
const cards = computed(() => {
  const v = quoteState.vehicle;
  return quoteState.scenarios.map((sc, idx) => {
    const base = {
      idx, term: sc.term, dep: sc.dep ?? 10, pre: sc.pre ?? 0,
      sent: quoteState.send[idx] !== false,
      monthly: null, residualAmt: null, residualPct: null,
      depAmt: null, preAmt: null,
    };
    if (!v || !v._src) return base;
    const t = v._src;
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
          discount: (quoteState.cond.discount || 0) * 10000,
          deliveryFee: deliveryFee.value,
          itemsFee: itemsFee.value,
          etc: 0,
        },
        contract: { term: sc.term, km: (quoteState.cond.km || 2) + '만km', dep: sc.dep ?? 10, pre: sc.pre ?? 0 },
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
        ...base,
        monthly: result.monthly,
        residualAmt: result.residualAmt, residualPct: result.residualPct,
        depAmt: result.depAmt, preAmt: result.preAmt,
      };
    } catch (e) {
      return base;
    }
  });
});
</script>

<template>
  <div class="sq" :class="{ 'sq--expanded': expanded }">
    <!-- 단일 어포던스 — 손잡이 바 + 라벨이 한 영역, 탭/스와이프 모두 지원 -->
    <div
      class="sq-summary"
      @click="toggle"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      role="button"
      :aria-expanded="expanded"
      aria-label="견적 펼치기 (탭 또는 위로 스와이프)"
    >
      <span class="sq-summary__bar"></span>
      <div class="sq-summary__row">
        <div class="sq-summary__label">
          월 대여료
          <span class="sq-summary__hint">VAT 포함 · 체크된 기간만 발송</span>
        </div>
        <i class="ph sq-summary__caret" :class="expanded ? 'ph-caret-down' : 'ph-caret-up'"></i>
      </div>
    </div>

    <!-- 기간별 카드 — 기간 변경 select + 월대여료 + 발송 체크 -->
    <div class="sq-terms">
      <div
        v-for="c in cards" :key="c.idx"
        class="sq-term-card"
        :class="{ 'is-checked': c.sent }"
      >
        <button
          class="sq-term-card__check-btn"
          @click="onSendToggle(c.idx)"
          :aria-label="(c.sent ? '발송 제외' : '발송 포함') + ' ' + c.term + '개월'"
        >
          <i class="ph" :class="c.sent ? 'ph-check-circle-fill' : 'ph-circle'"></i>
        </button>
        <div class="sq-term-card__term">{{ c.term }}개월</div>
        <div class="sq-term-card__monthly">
          <template v-if="c.monthly">{{ fmt(c.monthly) }}<em>원</em></template>
          <template v-else><span class="muted">—</span></template>
        </div>
      </div>
    </div>

    <!-- 펼침 — 보증금/선납금 편집 + 만기인수/약정/정비 표시 -->
    <div v-if="expanded" class="sq-detail">
      <table class="sq-table">
        <thead>
          <tr>
            <th class="sq-table__rowlabel">구분</th>
            <th v-for="c in cards" :key="c.idx"
                :class="{ 'is-dim': !c.sent }">
              <select
                class="sq-table__term-select"
                :value="c.term"
                @change="onTermChange(c.idx, $event)"
              >
                <option v-for="t in TERM_OPTIONS" :key="t" :value="t">{{ t }}개월</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- 대여료 (기간 헤더 바로 밑) — 펼침 시 첫 눈에 보이는 핵심 정보 -->
          <tr class="sq-table__monthly-row">
            <th class="sq-table__rowlabel">대여료</th>
            <td v-for="c in cards" :key="c.idx" class="sq-table__monthly">
              <template v-if="c.monthly">
                <b>{{ fmt(c.monthly) }}</b><small>원/월</small>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
          <tr v-if="quoteState.cond.discount">
            <th class="sq-table__rowlabel">추가 할인</th>
            <td v-for="c in cards" :key="c.idx" class="sq-table__discount">
              −{{ fmt(quoteState.cond.discount) }}만원
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">약정주행</th>
            <td v-for="c in cards" :key="c.idx">{{ quoteState.cond.km || 2 }}만km/년</td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">만기인수</th>
            <td v-for="c in cards" :key="c.idx">
              <template v-if="c.residualAmt">
                {{ (c.residualPct * 100).toFixed(0) }}%<br>
                <small>{{ fmt(c.residualAmt) }}원</small>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">정비서비스</th>
            <td v-for="c in cards" :key="c.idx">{{ quoteState.cond.svc || '웰스 Basic' }}</td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">보증금</th>
            <td v-for="c in cards" :key="c.idx">
              <span class="sq-pct-cell">
                <input
                  type="number"
                  class="sq-pct-input"
                  :value="c.dep"
                  min="0" max="100"
                  @change="onDepChange(c.idx, $event)"
                />%
              </span>
              <small v-if="c.depAmt">{{ fmt(c.depAmt) }}원</small>
            </td>
          </tr>
          <tr>
            <th class="sq-table__rowlabel">선납금</th>
            <td v-for="c in cards" :key="c.idx">
              <span class="sq-pct-cell">
                <input
                  type="number"
                  class="sq-pct-input"
                  :value="c.pre"
                  min="0" max="100"
                  @change="onPreChange(c.idx, $event)"
                />%
              </span>
              <small v-if="c.preAmt">{{ fmt(c.preAmt) }}원</small>
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

.sq-summary {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 6px 20px 8px;
  cursor: pointer;
  user-select: none;
}
.sq-summary__bar {
  align-self: center;
  width: 38px; height: 4px;
  background: var(--line-2);
  border-radius: 2px;
  margin-bottom: 6px;
}
.sq-summary__row {
  display: flex; align-items: center; justify-content: space-between;
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
  padding: 8px 6px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: var(--r-card);
  font-family: inherit;
  transition: background .12s, border-color .12s;
}
.sq-term-card.is-checked {
  border-color: var(--brand);
  background: var(--brand-50);
}
.sq-term-card__check-btn {
  position: absolute; top: 4px; right: 4px;
  width: 22px; height: 22px;
  background: transparent; border: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-4);
  font-size: 16px;
}
.sq-term-card.is-checked .sq-term-card__check-btn { color: var(--brand); }
.sq-term-card__term {
  font-size: 11px; color: var(--ink-3); font-weight: 500;
}
.sq-term-card.is-checked .sq-term-card__term { color: var(--brand); }
/* 펼침 표 헤더 — 기간 변경 select */
.sq-table__term-select {
  appearance: none; -webkit-appearance: none;
  background: transparent; border: 0;
  font-family: inherit;
  font-size: 11.5px; font-weight: 600; color: var(--ink-1);
  text-align: center; text-align-last: center;
  padding: 0 2px;
  cursor: pointer;
  outline: none;
  width: 100%;
}
.sq-table__term-select:focus { color: var(--brand); }
.sq-table thead th.is-dim .sq-table__term-select { color: var(--ink-4); }
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

/* 펼침: 보증금/선납금 % 입력 */
.sq-pct-cell {
  display: inline-flex; align-items: center; gap: 1px;
}
.sq-pct-input {
  width: 32px; height: 22px;
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: inherit;
  font-size: 11px; color: var(--ink-1); font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;
  padding: 0 2px;
}
.sq-pct-input:focus { border-color: var(--brand); }
/* 숫자 input 화살표 제거 */
.sq-pct-input::-webkit-outer-spin-button,
.sq-pct-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sq-pct-input { -moz-appearance: textfield; }

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
.sq-table__monthly-row td {
  background: var(--brand-50);
}
.sq-table__monthly b {
  font-size: 13px; font-weight: 700; color: var(--brand);
  letter-spacing: -0.3px;
}
.sq-table__monthly small {
  font-size: 10px; color: var(--ink-3); font-weight: 400;
  margin-left: 2px;
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
