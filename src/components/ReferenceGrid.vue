<script setup>
// 기본 견적 — 36/48/60 × 보증금 10% × 선납 0% 고정 표시 (편집 X)
// 손님 발송용 견적(TermsGrid) 위에 reference 로 항상 보임
import { computed } from 'vue';
import { quoteState as state } from '../store.js';
import { fmt } from '../lib/format.js';

const hasResults = computed(() => state.referenceMonthly && state.referenceMonthly.length > 0);

const cards = computed(() => {
  const arr = state.referenceMonthly || [];
  return arr.map((m, idx) => ({
    idx, term: m.term, dep: m.dep, pre: m.pre,
    monthly: m.monthly ?? null,
    residualAmt: m.residualAmt ?? null,
    residualPct: m.residualPct ?? null,
  }));
});
</script>

<template>
  <div
    v-for="card in cards"
    :key="card.idx"
    class="ref-card"
    :class="{ 'ref-card--empty': !hasResults }"
  >
    <div class="ref-card__head">
      <span class="ref-card__term">{{ card.term }}개월</span>
      <span class="ref-card__hint">보증금 {{ card.dep }}% · 선납 {{ card.pre }}%</span>
    </div>
    <div class="ref-card__monthly">
      <template v-if="card.monthly != null">{{ fmt(card.monthly) }}</template>
      <template v-else>—</template>
      <em>원</em>
    </div>
    <div class="ref-card__row">
      <span>만기인수<em v-if="card.residualPct != null" class="ref-card__pct">{{ (card.residualPct * 100).toFixed(0) }}%</em></span>
      <b>{{ card.residualAmt != null ? fmt(card.residualAmt) : '—' }}</b>
    </div>
  </div>
</template>

<style scoped>
.ref-card {
  background: var(--bg-soft);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
  font-variant-numeric: tabular-nums;
}
.ref-card--empty { opacity: 0.4; }

.ref-card__head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 6px;
}
.ref-card__term {
  font-size: 13px; font-weight: 600; color: var(--ink-1);
  letter-spacing: -0.2px;
}
.ref-card__hint {
  font-size: 11px; color: var(--ink-4); font-weight: 400;
}
.ref-card__monthly {
  font-size: 22px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.5px;
  display: flex; align-items: baseline; gap: 2px;
}
.ref-card__monthly em {
  font-style: normal; font-size: 12px; color: var(--ink-3); font-weight: 400;
}
.ref-card__row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11.5px; color: var(--ink-3);
  border-top: 1px solid var(--line);
  padding-top: 6px;
}
.ref-card__row b {
  font-weight: 600; color: var(--ink-1); font-size: 12px;
}
.ref-card__pct {
  font-style: normal;
  background: var(--brand-50); color: var(--brand);
  font-weight: 600; font-size: 10px;
  padding: 1px 5px; border-radius: var(--radius-pill);
  margin-left: 4px;
}
</style>
