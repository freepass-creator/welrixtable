<script setup>
import { computed, ref, watch } from 'vue';
import { quoteState } from '../store.js';

const FEE_MIN = 0;
const FEE_MAX = 7;
const FEE_STEP = 0.1;

function clampRound(v) {
  const n = +v || 0;
  if (!isFinite(n)) return 0;
  const rounded = Math.round(n / FEE_STEP) * FEE_STEP;
  return Math.max(FEE_MIN, Math.min(FEE_MAX, Math.round(rounded * 10) / 10));
}

const feeRate = computed({
  get: () => clampRound(quoteState.cond.feeRatePct),
  set: (v) => {
    quoteState.cond.feeRatePct = clampRound(v);
    window.__welrix_recompute?.();
  },
});

const feePct = computed(() => ((feeRate.value - FEE_MIN) / (FEE_MAX - FEE_MIN)) * 100);

// 직접 입력 — 텍스트 input 사용 (입력 중엔 자유, blur 시 round/clamp)
const feeText = ref(feeRate.value.toFixed(1));
watch(feeRate, (v) => { feeText.value = v.toFixed(1); });
function onTextCommit() {
  const parsed = parseFloat(feeText.value.replace(/[^\d.]/g, ''));
  if (isNaN(parsed)) {
    feeText.value = feeRate.value.toFixed(1);
    return;
  }
  feeRate.value = parsed;
  feeText.value = feeRate.value.toFixed(1);
}
function onTextEnter(e) { e.target.blur(); }
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
    <div class="cs-field cs-fee">
      <label>수수료</label>
      <div class="cs-fee-wrap">
        <span class="cs-fee-num">
          <input
            type="text" inputmode="decimal"
            v-model="feeText"
            @change="onTextCommit" @blur="onTextCommit" @keydown.enter="onTextEnter"
          />
          <em>%</em>
        </span>
        <input
          class="cs-fee-slider"
          type="range"
          :min="FEE_MIN" :max="FEE_MAX" :step="FEE_STEP"
          v-model.number="feeRate"
          :style="{ '--pct': feePct + '%' }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 손님 / 담당자 / 연락처 / 수수료 — 한 줄 4컬럼 균등 */
.cs-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1fr;
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
.cs-field input:focus { border-bottom-color: var(--ink-1); }

/* 수수료 — 28px 박스 안에 숫자(직접 입력) + 슬라이더 */
.cs-fee-wrap {
  position: relative;
  height: 28px;
  border-bottom: 1px solid var(--line);
  transition: border-color .12s;
  min-width: 0;
}
.cs-fee-wrap:hover { border-bottom-color: var(--ink-3); }
.cs-fee-wrap:focus-within { border-bottom-color: var(--ink-1); }

/* 숫자 입력 — 우측 상단, 슬라이더 위에 살짝 겹쳐 보임 */
.cs-fee-num {
  position: absolute;
  top: 0; right: 0;
  height: 18px;
  display: inline-flex; align-items: baseline; gap: 1px;
  z-index: 2;
  padding-left: 8px;
  background: linear-gradient(to right, transparent 0, #fff 40%, #fff 100%);
}
.cs-fee-num input {
  height: 18px !important; border: 0 !important;
  background: transparent;
  width: 36px; text-align: right;
  font-size: 13px; font-weight: 500;
  color: var(--ink-1);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  padding: 0 !important;
  outline: none;
  caret-color: var(--brand);
}
.cs-fee-num em {
  font-style: normal; font-size: 11px;
  color: var(--ink-4);
}

/* 슬라이더 — 트랙이 wrap bottom 위치(다른 input border-bottom 과 정렬) */
.cs-fee-slider {
  appearance: none; -webkit-appearance: none;
  position: absolute;
  bottom: -1px;       /* border-bottom 라인과 정확히 겹침 */
  left: 0; right: 0;
  width: 100%; height: 14px;
  background: transparent;
  margin: 0; padding: 0;
  cursor: pointer;
  outline: none;
  z-index: 1;
}
.cs-fee-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: linear-gradient(to right,
    var(--brand) 0%, var(--brand) var(--pct, 0%),
    transparent var(--pct, 0%), transparent 100%);
  border: 0;
}
.cs-fee-slider::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 10px; height: 10px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  margin-top: -4.5px;
  box-shadow: 0 0 0 2px #fff;
  cursor: grab;
  transition: transform .12s;
}
.cs-fee-slider:hover::-webkit-slider-thumb { transform: scale(1.2); }
.cs-fee-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.3); }

/* Firefox */
.cs-fee-slider::-moz-range-track {
  height: 1px; background: transparent; border: 0;
}
.cs-fee-slider::-moz-range-progress {
  height: 1px; background: var(--brand); border: 0;
}
.cs-fee-slider::-moz-range-thumb {
  width: 10px; height: 10px;
  background: var(--brand);
  border: 0; border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
  cursor: grab; transition: transform .12s;
}
.cs-fee-slider:hover::-moz-range-thumb { transform: scale(1.2); }
.cs-fee-slider:active::-moz-range-thumb { cursor: grabbing; transform: scale(1.3); }
</style>
