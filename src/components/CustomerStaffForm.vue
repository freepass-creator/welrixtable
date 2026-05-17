<script setup>
import { quoteState } from '../store.js';

function onFeeChange() {
  let v = +quoteState.cond.feeRatePct || 0;
  v = Math.max(0, Math.min(5, Math.round(v * 2) / 2));
  quoteState.cond.feeRatePct = v;
  window.__welrix_recompute?.();
}
</script>

<template>
  <div class="cs-form">
    <div class="cs-field">
      <label>손님</label>
      <input v-model="quoteState.cust.name" placeholder="VIP 고객" />
    </div>
    <div class="cs-field">
      <label>담당자</label>
      <input v-model="quoteState.staff.name" placeholder="홍길동 과장" />
    </div>
    <div class="cs-field">
      <label>연락처</label>
      <input v-model="quoteState.staff.tel" placeholder="010-0000-0000" inputmode="tel" />
    </div>
    <div class="cs-field">
      <label>수수료</label>
      <span class="cs-pct">
        <input type="number" v-model.number="quoteState.cond.feeRatePct" min="0" max="5" step="0.5" @change="onFeeChange" /><em>%</em>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* 손님 / 담당자 / 연락처 / 수수료 — 한 줄 4컬럼 */
.cs-form {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1.4fr 0.7fr;
  gap: 14px;
  align-items: center;
  padding: 4px 0;
}
.cs-field {
  display: grid; grid-template-columns: auto 1fr;
  align-items: center; gap: 6px;
  min-width: 0;
}
.cs-field label {
  font-size: 11px; color: var(--ink-4);
  font-weight: 400; letter-spacing: 0;
  white-space: nowrap;
}
.cs-field input {
  height: 28px;
  border: 0; border-bottom: 1px solid var(--line);
  background: transparent;
  font-size: 12.5px; font-family: inherit;
  color: var(--ink-1);
  outline: none; padding: 0;
  width: 100%; min-width: 0;
  font-variant-numeric: tabular-nums;
  transition: border-color .12s;
}
.cs-field input::placeholder { color: var(--ink-4); }
.cs-field input:hover { border-bottom-color: var(--ink-3); }
.cs-field input:focus { border-bottom-color: var(--brand); }

/* 수수료 % 인라인 */
.cs-pct {
  display: flex; align-items: baseline; gap: 3px;
  border-bottom: 1px solid var(--line);
  transition: border-color .12s;
}
.cs-pct:hover { border-bottom-color: var(--ink-3); }
.cs-pct:focus-within { border-bottom-color: var(--brand); }
.cs-pct input {
  border-bottom: 0 !important;
  text-align: right;
}
.cs-pct em {
  font-style: normal; font-size: 11px; color: var(--ink-4);
  flex-shrink: 0; padding-right: 2px;
}
</style>
