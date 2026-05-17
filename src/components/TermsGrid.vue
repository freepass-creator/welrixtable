<script setup>
import { computed } from 'vue';
import { quoteState as state } from '../store.js';

const TERM_OPTIONS = [12, 24, 36, 48, 60];
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));

// 차량+트림 선택돼서 월대여료 계산된 상태
const hasResults = computed(() => state.monthly && state.monthly.length > 0);

// 각 카드 데이터 — scenarios에 monthly 결과 머지
const cards = computed(() => {
  return state.scenarios.map((sc, idx) => {
    const m = state.monthly?.[idx] || null;
    return {
      idx, term: sc.term, dep: sc.dep, pre: sc.pre,
      monthly: m?.monthly ?? null,
      residualAmt: m?.residualAmt ?? null,
      depAmt: m?.depAmt ?? null,
      preAmt: m?.preAmt ?? null,
      sent: state.send[idx] !== false,
    };
  });
});

function onTermChange(idx, e) {
  state.scenarios[idx].term = +e.target.value;
  window.__welrix_recompute?.();
}
function onDepChange(idx, e) {
  const v = Math.max(0, Math.min(100, +e.target.value || 0));
  e.target.value = v;
  state.scenarios[idx].dep = v;
  window.__welrix_recompute?.();
}
function onPreChange(idx, e) {
  const v = Math.max(0, Math.min(100, +e.target.value || 0));
  e.target.value = v;
  state.scenarios[idx].pre = v;
  window.__welrix_recompute?.();
}
function onSendToggle(idx, e) {
  state.send[idx] = e.target.checked;
  window.__welrix_recompute?.();
}
</script>

<template>
  <div
    v-for="card in cards"
    :key="card.idx"
    class="term-card"
    :class="{ 'term-card--empty': !hasResults, unchecked: !card.sent && hasResults }"
  >
    <div class="term-card__head">
      <select
        class="term-card__term-dd"
        :value="card.term"
        :disabled="!hasResults"
        @change="onTermChange(card.idx, $event)"
      >
        <option v-for="t in TERM_OPTIONS" :key="t" :value="t">{{ t }}개월</option>
      </select>
      <label class="term-card__check">
        <input
          type="checkbox"
          :checked="card.sent"
          :disabled="!hasResults"
          @change="onSendToggle(card.idx, $event)"
        />
      </label>
    </div>
    <div class="term-card__monthly">
      <template v-if="card.monthly != null">{{ fmt(card.monthly) }}</template>
      <template v-else>—</template>
      <em>원</em>
    </div>
    <div class="term-card__cond">
      <label>
        <span>보증금</span>
        <span class="pct-cell" :class="{ 'pct-cell--static': !hasResults }">
          <template v-if="hasResults">
            <input
              type="number"
              :value="card.dep"
              min="0" max="100"
              @change="onDepChange(card.idx, $event)"
            />%
          </template>
          <template v-else>{{ card.dep }}%</template>
        </span>
      </label>
      <label>
        <span>선납금</span>
        <span class="pct-cell" :class="{ 'pct-cell--static': !hasResults }">
          <template v-if="hasResults">
            <input
              type="number"
              :value="card.pre"
              min="0" max="100"
              @change="onPreChange(card.idx, $event)"
            />%
          </template>
          <template v-else>{{ card.pre }}%</template>
        </span>
      </label>
    </div>
    <div class="term-card__row"><span>만기인수</span><b>{{ card.residualAmt != null ? fmt(card.residualAmt) : '—' }}</b></div>
    <div class="term-card__row"><span>보증금</span><b>{{ card.depAmt != null ? fmt(card.depAmt) : '—' }}</b></div>
    <div class="term-card__row"><span>선납금</span><b>{{ card.preAmt != null ? fmt(card.preAmt) : '—' }}</b></div>
  </div>
</template>
