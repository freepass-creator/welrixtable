<script setup>
import { computed } from 'vue';
import { quoteState } from '../store.js';

function recompute() { window.__welrix_recompute?.(); }

const DEP_MIN = 0, DEP_MAX = 30;
const PRE_MIN = 0, PRE_MAX = 30;

function setDep(v) {
  const n = Math.max(DEP_MIN, Math.min(DEP_MAX, +v || 0));
  quoteState.cond.dep = n;
  quoteState.scenarios.forEach((sc) => { sc.dep = n; });
  recompute();
}
function setPre(v) {
  const n = Math.max(PRE_MIN, Math.min(PRE_MAX, +v || 0));
  quoteState.cond.pre = n;
  quoteState.scenarios.forEach((sc) => { sc.pre = n; });
  recompute();
}

const depPct = computed(() => ((quoteState.cond.dep - DEP_MIN) / (DEP_MAX - DEP_MIN)) * 100);
const prePct = computed(() => ((quoteState.cond.pre - PRE_MIN) / (PRE_MAX - PRE_MIN)) * 100);
</script>

<template>
  <div class="qp-form qp-form--conds">
    <div class="qc-field">
      <label>신용</label>
      <select v-model="quoteState.cond.credit" @change="recompute">
        <option>신용</option><option>중신용</option><option>저신용</option>
      </select>
    </div>
    <div class="qc-field">
      <label>약정주행</label>
      <select v-model="quoteState.cond.km" @change="recompute">
        <option value="2">2만km/년</option>
        <option value="3">3만km/년</option>
      </select>
    </div>
    <div class="qc-field qc-field--slider">
      <label>보증금</label>
      <div class="qc-slider-wrap">
        <div class="qc-slider-value">{{ quoteState.cond.dep || 0 }}<em>%</em></div>
        <input
          class="qc-slider" type="range"
          :min="DEP_MIN" :max="DEP_MAX" step="1"
          :value="quoteState.cond.dep || 0"
          @input="(e) => setDep(+e.target.value)"
          :style="{ '--pct': depPct + '%' }"
        />
      </div>
    </div>
    <div class="qc-field qc-field--slider">
      <label>선납금</label>
      <div class="qc-slider-wrap">
        <div class="qc-slider-value">{{ quoteState.cond.pre || 0 }}<em>%</em></div>
        <input
          class="qc-slider" type="range"
          :min="PRE_MIN" :max="PRE_MAX" step="1"
          :value="quoteState.cond.pre || 0"
          @input="(e) => setPre(+e.target.value)"
          :style="{ '--pct': prePct + '%' }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.qc-field--slider {
  display: grid; grid-template-columns: auto 1fr;
  align-items: center; gap: 8px;
}
.qc-slider-wrap {
  position: relative;
  height: 28px; min-width: 0;
  border-bottom: 1px solid var(--line);
  transition: border-color .12s;
}
.qc-slider-wrap:hover { border-bottom-color: var(--ink-3); }
.qc-slider-wrap:focus-within { border-bottom-color: var(--ink-1); }
.qc-slider-value {
  position: absolute;
  top: 0; right: 0;
  height: 18px;
  display: inline-flex; align-items: baseline; gap: 1px;
  z-index: 2;
  padding-left: 8px;
  background: linear-gradient(to right, transparent 0, #fff 40%, #fff 100%);
  font-size: 13px; font-weight: 500;
  color: var(--ink-1);
  font-variant-numeric: tabular-nums;
}
.qc-slider-value em {
  font-style: normal; font-size: 11px;
  color: var(--ink-4); margin-left: 1px;
}
.qc-slider {
  appearance: none; -webkit-appearance: none;
  position: absolute;
  bottom: -1px;
  left: 0; right: 0;
  width: 100%; height: 14px;
  background: transparent;
  margin: 0; padding: 0;
  cursor: pointer; outline: none;
  z-index: 1;
}
.qc-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: linear-gradient(to right,
    var(--brand) 0%, var(--brand) var(--pct, 0%),
    transparent var(--pct, 0%), transparent 100%);
  border: 0;
}
.qc-slider::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 10px; height: 10px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  margin-top: -4.5px;
  box-shadow: 0 0 0 2px #fff;
  cursor: grab;
  transition: transform .12s;
}
.qc-slider:hover::-webkit-slider-thumb { transform: scale(1.2); }
.qc-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.3); }
.qc-slider::-moz-range-track { height: 1px; background: transparent; border: 0; }
.qc-slider::-moz-range-progress { height: 1px; background: var(--brand); border: 0; }
.qc-slider::-moz-range-thumb {
  width: 10px; height: 10px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  box-shadow: 0 0 0 2px #fff; cursor: grab;
}
</style>
