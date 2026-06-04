<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';

const TERMS = [36, 48, 60];  // 24개월 운영 안 함
const KMS = [1, 2, 3, 4];
const CREDITS = [
  { value: '신용',   label: '신용' },
  { value: '중신용', label: '중신용' },
  { value: '저신용', label: '저신용' },
];

const selectedTerms = computed(() => (quoteState.scenarios || []).map(s => s.term));

function toggleTerm(t) {
  const list = quoteState.scenarios || [];
  const idx = list.findIndex(s => s.term === t);
  if (idx >= 0) {
    if (list.length === 1) return;
    list.splice(idx, 1);
  } else {
    list.push({ term: t, dep: quoteState.cond.dep || 10, pre: quoteState.cond.pre || 0 });
    list.sort((a, b) => b.term - a.term);
  }
}

function onDepChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.dep || 0));
  quoteState.cond.dep = v;
  (quoteState.scenarios || []).forEach(s => { s.dep = v; });
}
function onPreChange() {
  const v = Math.max(0, Math.min(30, +quoteState.cond.pre || 0));
  quoteState.cond.pre = v;
  (quoteState.scenarios || []).forEach(s => { s.pre = v; });
}
function onFeeChange() {
  const v = Math.max(-10, Math.min(7, Math.round((+quoteState.cond.feeRatePct || 0) * 10) / 10));
  quoteState.cond.feeRatePct = v;
}
</script>

<template>
  <div class="sc">
    <h2 class="sc-title">계약 조건을<br>설정해 주세요</h2>

    <div class="sc-field">
      <div class="sc-label">
        기간 <span class="sc-label__hint">복수 선택 가능</span>
      </div>
      <div class="sc-chips">
        <button
          v-for="t in TERMS" :key="t"
          class="sc-chip" :class="{ 'is-selected': selectedTerms.includes(t) }"
          @click="toggleTerm(t)"
        >{{ t }}개월</button>
      </div>
    </div>

    <div class="sc-field">
      <div class="sc-label">약정 주행거리</div>
      <div class="sc-chips">
        <button
          v-for="k in KMS" :key="k"
          class="sc-chip" :class="{ 'is-selected': quoteState.cond.km == k }"
          @click="quoteState.cond.km = k"
        >{{ k }}만km/년</button>
      </div>
    </div>

    <div class="sc-field">
      <div class="sc-label">신용</div>
      <div class="sc-chips">
        <button
          v-for="c in CREDITS" :key="c.value"
          class="sc-chip" :class="{ 'is-selected': quoteState.cond.credit === c.value }"
          @click="quoteState.cond.credit = c.value"
        >{{ c.label }}</button>
      </div>
    </div>

    <!-- 보증금 — 직접 입력 (0~30%) -->
    <div class="sc-field">
      <div class="sc-label">보증금</div>
      <div class="sc-pct">
        <input
          type="number" min="0" max="30" step="1" inputmode="numeric"
          v-model.number="quoteState.cond.dep"
          @change="onDepChange"
          placeholder="0"
        />
        <em>%</em>
      </div>
    </div>

    <!-- 선납금 — 직접 입력 (0~30%) -->
    <div class="sc-field">
      <div class="sc-label">선납금</div>
      <div class="sc-pct">
        <input
          type="number" min="0" max="30" step="1" inputmode="numeric"
          v-model.number="quoteState.cond.pre"
          @change="onPreChange"
          placeholder="0"
        />
        <em>%</em>
      </div>
    </div>

    <!-- 수수료 — 직접 입력 (-10~7%, 0.1 단위) — 마이너스로 싸게 표기 가능 -->
    <div class="sc-field">
      <div class="sc-label">수수료</div>
      <div class="sc-pct">
        <input
          type="number" min="-10" max="7" step="0.1" inputmode="decimal"
          v-model.number="quoteState.cond.feeRatePct"
          @change="onFeeChange"
          placeholder="0"
        />
        <em>%</em>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sc-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.sc-field { margin-bottom: 22px; }
.sc-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: var(--fs-md); font-weight: var(--fw-semi); color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.sc-label__hint {
  font-size: var(--fs-xs); color: var(--ink-4); font-weight: var(--fw-regular);
}
.sc-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.sc-chip {
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: var(--r-chip);
  font-family: inherit; font-size: var(--fs-base); font-weight: var(--fw-medium);
  color: var(--ink-2);
  cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
}
.sc-chip:active { background: var(--brand-50); }
.sc-chip.is-selected {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

/* 보증금/선납금/수수료 — 직접 입력 */
.sc-pct {
  display: flex; align-items: baseline; gap: 4px;
  height: var(--h-input);
  padding: 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: var(--r-chip);
  transition: border-color .12s;
}
.sc-pct:focus-within { border-color: var(--brand); }
.sc-pct input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: var(--fs-lg);
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding: 0;
  -moz-appearance: textfield;
}
.sc-pct input::-webkit-outer-spin-button,
.sc-pct input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sc-pct em {
  font-style: normal; font-size: var(--fs-md);
  color: var(--ink-4); flex-shrink: 0;
}
</style>
