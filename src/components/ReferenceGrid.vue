<script setup>
// 기본 견적 — 36/48/60 × 보증금 10% × 선납 0% 고정 표시 (편집 X)
// 손님 발송용 견적(TermsGrid) 위에 reference 로 항상 보임.
// 스타일은 .term-card 글로벌 CSS (index.html) 를 그대로 활용 — TermsGrid 와 동일 룩.
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
  <!-- term-card 클래스 그대로 사용 — TermsGrid 와 동일 룩 (구성만 read-only) -->
  <!-- term-card--ref 모디파이어: 애니메이션 X (틀 고정 + 숫자만 갱신) -->
  <div
    v-for="card in cards"
    :key="card.idx"
    class="term-card term-card--ref"
    :class="{ 'term-card--empty': !hasResults }"
  >
    <div class="term-card__head">
      <span class="ref-term-label">{{ card.term }}개월</span>
      <span class="ref-hint">보증금 {{ card.dep }}% · 선납 {{ card.pre }}%</span>
    </div>
    <div class="term-card__monthly">
      <template v-if="card.monthly != null">{{ fmt(card.monthly) }}</template>
      <template v-else>—</template>
      <em>원</em>
    </div>
    <div class="term-card__row">
      <span>만기인수
        <em v-if="card.residualPct != null" class="resid-pct">{{ (card.residualPct * 100).toFixed(0) }}%</em>
      </span>
      <b>{{ card.residualAmt != null ? fmt(card.residualAmt) : '—' }}</b>
    </div>
  </div>
</template>

<style scoped>
/* term-card 클래스는 글로벌 스타일을 받음. 여기선 reference 전용 마크업만 보정 */
.ref-term-label {
  font-size: 11px; font-weight: 500; color: var(--ink-1);
  letter-spacing: 0.4px;
}
.ref-hint {
  font-size: 10px; color: var(--ink-4); letter-spacing: 0;
  font-weight: 400;
}
</style>
