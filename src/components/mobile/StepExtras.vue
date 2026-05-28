<script setup>
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { DELIVERY_REGIONS, ACCESSORIES, TINT_AREAS, TINT_PRICES } from '../../data/lookups.js';
import { fmt } from '../../lib/format.js';
import * as Fees from '../../lib/compute-fees.js';

// 짧은 옵션은 chip 유지
const SVC = [
  { value: '웰스 Basic', label: '웰스 Basic', sub: '방문 점검' },
  { value: '웰스 Self',  label: '웰스 Self',  sub: '자체 정비' },
];
const INS = [
  { value: '1억', label: '1억' },
  { value: '2억', label: '2억' },
  { value: '3억', label: '3억' },
  { value: '5억', label: '5억' },
];
const EXTRA = [
  { value: '없음', label: '없음' },
  { value: '1명', label: '1명' },
  { value: '2명', label: '2명' },
  { value: '3명', label: '3명' },
];

// 탁송 지역/도시 — native select
const regions = Object.keys(DELIVERY_REGIONS);
const cities = computed(() => {
  const r = quoteState.cond.deliveryRegion;
  return r && DELIVERY_REGIONS[r] ? Object.keys(DELIVERY_REGIONS[r]) : [];
});
const deliveryFee = computed(() => Fees.deliveryFee(quoteState));
function onRegionChange(e) {
  const r = e.target.value;
  quoteState.cond.deliveryRegion = r;
  quoteState.cond.deliveryCity = Object.keys(DELIVERY_REGIONS[r] || {})[0] || '';
}

// 선팅 제품 — native select
const tintProducts = Object.keys(TINT_PRICES);
const TINT_EXCLUSIVE = {
  side_rear_no_coupon: 'side_rear_with_coupon',
  side_rear_with_coupon: 'side_rear_no_coupon',
  sunroof_normal: 'sunroof_pano',
  sunroof_pano: 'sunroof_normal',
};
function toggleTintArea(key) {
  if (!quoteState.tint.areas) quoteState.tint.areas = new Set();
  const set = quoteState.tint.areas;
  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
    const ex = TINT_EXCLUSIVE[key];
    if (ex && set.has(ex)) set.delete(ex);
  }
}
const tintFee = computed(() => Fees.tintFee(quoteState));

// 용품 — native select 옵션 빌드
function buildOpts(map) {
  return [{ value: '', label: '없음 — 무료' }]
    .concat(Object.entries(map).map(([k, v]) => ({ value: k, label: `${k} (+${fmt(v)}원)` })));
}
const blackboxOpts = buildOpts(ACCESSORIES.blackbox);
const naviOpts = buildOpts(ACCESSORIES.navi);
const hipassOpts = buildOpts(ACCESSORIES.hipass);
</script>

<template>
  <div class="se">
    <h2 class="se-title">옵션·서비스를<br>선택해 주세요</h2>

    <!-- 차량 케어 -->
    <div class="se-field">
      <div class="se-label">차량 케어</div>
      <div class="se-cards">
        <button
          v-for="s in SVC" :key="s.value"
          class="se-card" :class="{ 'is-selected': quoteState.cond.svc === s.value }"
          @click="quoteState.cond.svc = s.value"
        >
          <span class="se-card__label">{{ s.label }}</span>
          <span class="se-card__sub">{{ s.sub }}</span>
        </button>
      </div>
    </div>

    <!-- 대물 보험 -->
    <div class="se-field">
      <div class="se-label">대물 보험</div>
      <div class="se-chips">
        <button
          v-for="i in INS" :key="i.value"
          class="se-chip" :class="{ 'is-selected': quoteState.cond.insProperty === i.value }"
          @click="quoteState.cond.insProperty = i.value"
        >{{ i.label }}</button>
      </div>
    </div>

    <!-- 추가 운전자 -->
    <div class="se-field">
      <div class="se-label">추가 운전자</div>
      <div class="se-chips">
        <button
          v-for="e in EXTRA" :key="e.value"
          class="se-chip" :class="{ 'is-selected': quoteState.cond.extraDriver === e.value }"
          @click="quoteState.cond.extraDriver = e.value"
        >{{ e.label }}</button>
      </div>
    </div>

    <div class="se-divider"></div>

    <!-- 탁송 지역/도시 — drop-down -->
    <div class="se-field">
      <div class="se-label">
        탁송 지역
        <span v-if="deliveryFee" class="se-label__val">+{{ fmt(deliveryFee) }}원</span>
      </div>
      <div class="se-row">
        <select class="se-select" :value="quoteState.cond.deliveryRegion" @change="onRegionChange">
          <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
        </select>
        <select class="se-select" v-model="quoteState.cond.deliveryCity" :disabled="!cities.length">
          <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <!-- 선팅 -->
    <div class="se-field">
      <div class="se-label">
        선팅 제품
        <span v-if="tintFee" class="se-label__val">+{{ fmt(tintFee) }}원</span>
      </div>
      <select class="se-select" v-model="quoteState.tint.product">
        <option value="">선팅 안 함</option>
        <option v-for="p in tintProducts" :key="p" :value="p">{{ p }}</option>
      </select>
      <div v-if="quoteState.tint.product" class="se-tint-areas">
        <button
          v-for="a in TINT_AREAS" :key="a.key"
          class="se-tint-area"
          :class="{ 'is-selected': quoteState.tint.areas?.has(a.key) }"
          @click="toggleTintArea(a.key)"
        >
          <span class="se-tint-area__label">{{ a.label }}</span>
          <span class="se-tint-area__price">
            {{ TINT_PRICES[quoteState.tint.product]?.[a.key] ? '+' + fmt(TINT_PRICES[quoteState.tint.product][a.key]) + '원' : '무료' }}
          </span>
        </button>
      </div>
    </div>

    <!-- 용품 — 각각 drop-down -->
    <div class="se-field">
      <div class="se-label">블박</div>
      <select class="se-select" v-model="quoteState.extras.blackbox">
        <option v-for="o in blackboxOpts" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>

    <div class="se-field">
      <div class="se-label">내비</div>
      <select class="se-select" v-model="quoteState.extras.navi">
        <option v-for="o in naviOpts" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>

    <div class="se-field">
      <div class="se-label">하이패스</div>
      <select class="se-select" v-model="quoteState.extras.hipass">
        <option v-for="o in hipassOpts" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.se-title {
  font-size: 22px; font-weight: 700;
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.se-divider {
  height: 1px; background: var(--line);
  margin: 18px 0;
}
.se-field { margin-bottom: 22px; }
.se-label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.se-label__val {
  font-size: 13px; color: var(--brand); font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* chip 카드 (케어) */
.se-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.se-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 12px;
  text-align: left;
  font-family: inherit; cursor: pointer;
}
.se-card__label { font-size: 15px; font-weight: 600; color: var(--ink-1); }
.se-card__sub { font-size: 12px; color: var(--ink-3); }
.se-card:active { background: var(--brand-50); }
.se-card.is-selected { border-color: var(--brand); background: var(--brand-50); }
.se-card.is-selected .se-card__label { color: var(--brand); }

/* chip (보험/운전자) */
.se-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.se-chip {
  padding: 10px 14px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: inherit; font-size: 14px; font-weight: 500;
  color: var(--ink-2); cursor: pointer;
}
.se-chip:active { background: var(--brand-50); }
.se-chip.is-selected {
  background: var(--brand); border-color: var(--brand); color: #fff;
}

/* native select — 모바일 친화 (iOS/Android picker) */
.se-row { display: flex; gap: 8px; }
.se-row .se-select { flex: 1; }
.se-select {
  width: 100%;
  height: 46px;
  padding: 0 32px 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  font-family: inherit; font-size: 15px;
  color: var(--ink-1);
  cursor: pointer;
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;
}
.se-select:focus { border-color: var(--brand); outline: none; }
.se-select:disabled { background-color: var(--bg-soft); color: var(--ink-4); cursor: not-allowed; }

/* 추가 할인 input */
.se-discount {
  display: flex; align-items: center; gap: 6px;
  height: 46px;
  padding: 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: var(--r-chip);
}
.se-discount:focus-within { border-color: var(--brand); }
.se-discount__input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: 15px;
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
}
.se-discount__input::-webkit-outer-spin-button,
.se-discount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.se-discount__unit {
  font-size: 13px; color: var(--ink-4); font-weight: 500;
}

/* 선팅 부위 grid */
.se-tint-areas {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  margin-top: 10px;
}
.se-tint-area {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 10px 12px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: inherit; cursor: pointer;
}
.se-tint-area__label { font-size: 13px; font-weight: 500; color: var(--ink-1); }
.se-tint-area__price {
  font-size: 11px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.se-tint-area:active { background: var(--brand-50); }
.se-tint-area.is-selected {
  border-color: var(--brand); background: var(--brand-50);
}
.se-tint-area.is-selected .se-tint-area__label { color: var(--brand); }
</style>
