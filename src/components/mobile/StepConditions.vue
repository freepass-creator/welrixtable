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
// 수수료와 동일 slider 패턴 — 0~30% range
const DEP_MIN = 0, DEP_MAX = 30;
const PRE_MIN = 0, PRE_MAX = 30;
const depPct = computed(() => ((quoteState.cond.dep - DEP_MIN) / (DEP_MAX - DEP_MIN)) * 100);
const prePct = computed(() => ((quoteState.cond.pre - PRE_MIN) / (PRE_MAX - PRE_MIN)) * 100);

// 기간 multi-select — scenarios 배열에 들어있는 term 목록
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

// 보증금/선납 — cond + 모든 scenarios 동기화 (월대여료 실시간 갱신용)
function setDep(d) {
  quoteState.cond.dep = d;
  (quoteState.scenarios || []).forEach(s => { s.dep = d; });
}
function setPre(p) {
  quoteState.cond.pre = p;
  (quoteState.scenarios || []).forEach(s => { s.pre = p; });
}
</script>

<template>
  <div class="sc">
    <h2 class="sc-title">계약 조건을<br>설정해 주세요</h2>

    <div class="sc-field">
      <div class="sc-label">
        기간
        <span class="sc-label__hint">복수 선택 가능</span>
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

    <!-- 보증금 — slider (수수료와 동일 밑줄 패턴, 0~30%) -->
    <div class="sc-field">
      <div class="sc-label">보증금</div>
      <div class="sc-slider-wrap">
        <div class="sc-slider-value">{{ quoteState.cond.dep || 0 }}<em>%</em></div>
        <input
          class="sc-range" type="range"
          :min="DEP_MIN" :max="DEP_MAX" step="1"
          :value="quoteState.cond.dep || 0"
          @input="(e) => setDep(+e.target.value)"
          :style="{ '--pct': depPct + '%' }"
        />
      </div>
    </div>

    <!-- 선납금 — slider -->
    <div class="sc-field">
      <div class="sc-label">선납금</div>
      <div class="sc-slider-wrap">
        <div class="sc-slider-value">{{ quoteState.cond.pre || 0 }}<em>%</em></div>
        <input
          class="sc-range" type="range"
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
.sc-title {
  font-size: 22px; font-weight: 700;
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.sc-field { margin-bottom: 22px; }
.sc-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.sc-label__hint {
  font-size: 11px; color: var(--ink-4); font-weight: 400;
}
.sc-label__val {
  font-size: 14px; color: var(--brand); font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sc-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.sc-chip {
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: inherit; font-size: 14px; font-weight: 500;
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

/* 보증금/선납금 slider — wrap 의 border-bottom 과 slider track 정확히 겹쳐 한 줄 */
.sc-slider-wrap {
  position: relative;
  height: 32px;
  border-bottom: 1px solid var(--line);
  transition: border-color .12s;
}
.sc-slider-wrap:focus-within { border-bottom-color: var(--ink-1); }
.sc-slider-value {
  position: absolute; top: 0; right: 0;
  height: 20px;
  display: inline-flex; align-items: baseline; gap: 1px;
  z-index: 2;
  padding-left: 8px;
  background: linear-gradient(to right, transparent 0, #fff 40%, #fff 100%);
  font-size: 14px; font-weight: 500;
  color: var(--ink-1);
  font-variant-numeric: tabular-nums;
}
.sc-slider-value em {
  font-style: normal; font-size: 12px;
  color: var(--ink-4); margin-left: 1px;
}
.sc-range {
  appearance: none; -webkit-appearance: none;
  position: absolute;
  bottom: -1px;
  left: 0; right: 0;
  width: 100%; height: 16px;
  background: transparent;
  cursor: pointer; outline: none;
  padding: 0; margin: 0;
  z-index: 1;
}
.sc-range::-webkit-slider-runnable-track {
  height: 1px;
  background: linear-gradient(to right,
    var(--brand) 0%, var(--brand) var(--pct, 0%),
    transparent var(--pct, 0%), transparent 100%);
  border: 0;
}
.sc-range::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 12px; height: 12px;
  margin-top: -5.5px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
  cursor: grab;
}
.sc-range:hover::-webkit-slider-thumb { transform: scale(1.2); }
.sc-range:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.3); }
.sc-range::-moz-range-track { height: 1px; background: transparent; border: 0; }
.sc-range::-moz-range-progress { height: 1px; background: var(--brand); border: 0; }
.sc-range::-moz-range-thumb {
  width: 12px; height: 12px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
  cursor: grab;
}
</style>
