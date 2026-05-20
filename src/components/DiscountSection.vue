<script setup>
import { computed, ref } from 'vue';
import { vehicleState, quoteState } from '../store.js';

const isDisabled = computed(() => !vehicleState.trim);

const open = ref(false);
const isOpen = computed(() => open.value || (quoteState.cond.discount || 0) > 0);

function onInputChange() {
  const v = Math.max(0, +quoteState.cond.discount || 0);
  quoteState.cond.discount = v;
  window.__welrix_recompute?.();
}
function onToggle(e) { open.value = e.target.open; }
</script>

<template>
  <section id="sec-discount">
    <details class="qp-extras-inline" :open="isOpen" @toggle="onToggle">
      <summary class="step-title-summary">
        <span class="step-title-text">
          추가 할인
          <b v-if="quoteState.cond.discount">−{{ quoteState.cond.discount }}만원</b>
          <span v-else class="step-title-hint">재고차·특별조건</span>
        </span>
        <span class="caret"></span>
      </summary>
      <div class="discount-row">
        <span class="discount-input">
          <input
            type="number" min="0" step="10" inputmode="numeric"
            v-model.number="quoteState.cond.discount"
            :disabled="isDisabled"
            @change="onInputChange"
            placeholder="0"
          />
          <em>만원</em>
        </span>
      </div>
    </details>
  </section>
</template>

<style scoped>
.step-title-hint {
  font-size: 10.5px; color: var(--ink-4); font-weight: 400;
  margin-left: 6px;
}
.step-title-text b {
  font-size: 11.5px; color: var(--brand); font-weight: 600;
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}

.discount-row { margin-top: 8px; }
.discount-input {
  display: flex; align-items: baseline; gap: 2px;
  height: 32px;
  border-bottom: 1px solid var(--line);
  transition: border-color .12s;
  width: 100%;
}
.discount-input:hover { border-bottom-color: var(--ink-3); }
.discount-input:focus-within { border-bottom-color: var(--ink-1); }
.discount-input input {
  flex: 1; min-width: 0;
  border: 0; background: transparent;
  font-family: inherit; font-size: 13px;
  color: var(--ink-1); outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding: 0;
  -moz-appearance: textfield;
}
.discount-input input::-webkit-outer-spin-button,
.discount-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.discount-input input:disabled { color: var(--ink-4); }
.discount-input em {
  font-style: normal; font-size: 11px;
  color: var(--ink-4); flex-shrink: 0;
  padding-right: 4px;
}
</style>
