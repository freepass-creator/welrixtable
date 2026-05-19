<script setup>
import { computed } from 'vue';
import { quoteState } from '../store.js';
import { TINT_PRICES, TINT_AREAS } from '../data/lookups.js';
import CustomDropdown from './CustomDropdown.vue';

const fmt = (n) => new Intl.NumberFormat('ko-KR').format(n);

const productOptions = computed(() =>
  [{ value: '', label: '없음' }, ...Object.keys(TINT_PRICES).map((p) => ({ value: p, label: p }))]
);

const chips = computed(() => {
  const product = quoteState.tint.product;
  if (!product) return [];
  const priceMap = TINT_PRICES[product] || {};
  return TINT_AREAS.map((a) => ({
    key: a.key,
    label: a.label,
    desc: a.desc,
    price: priceMap[a.key] || 0,
    checked: quoteState.tint.areas.has(a.key),
  }));
});

function onProductChange(v) {
  quoteState.tint.product = v;
  window.__welrix_recompute?.();
}
function toggleArea(key, e) {
  if (e.target.checked) quoteState.tint.areas.add(key);
  else quoteState.tint.areas.delete(key);
  window.__welrix_recompute?.();
}
</script>

<template>
  <section id="sec-tint">
    <div class="step-title">선팅</div>
    <div>
      <CustomDropdown
        :options="productOptions"
        :model-value="quoteState.tint.product"
        placeholder="없음"
        @change="onProductChange"
      />
      <div class="tint-chips" v-if="quoteState.tint.product">
        <label
          v-for="c in chips"
          :key="c.key"
          class="tint-chip"
          :class="{ on: c.checked }"
          :title="`${c.desc || ''} · ${c.price > 0 ? '+' + fmt(c.price) + '원' : '무료'}`"
        >
          <input type="checkbox" :checked="c.checked" :data-tint-area="c.key" @change="toggleArea(c.key, $event)" />
          <span class="tn">{{ c.label }}</span>
          <em class="tp">{{ c.price > 0 ? '+' + fmt(c.price) + '원' : '무료' }}</em>
        </label>
      </div>
      <span v-else style="font-size:11px; color:var(--ink-4);">제품을 선택하면 부위가 표시됩니다</span>
    </div>
  </section>
</template>
