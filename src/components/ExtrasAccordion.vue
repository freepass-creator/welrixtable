<script setup>
import { ref, computed } from 'vue';
import { quoteState } from '../store.js';
import { ACCESSORIES } from '../data/lookups.js';
import CustomDropdown from './CustomDropdown.vue';

const fmt = (n) => new Intl.NumberFormat('ko-KR').format(n);

const open = ref(false);

function buildOpts(map, prefix) {
  return [{ value: '', label: `${prefix} 없음` },
    ...Object.entries(map).map(([k, v]) => ({ value: k, label: `${k} (+${fmt(v)}원)` }))
  ];
}

const blackboxOpts = computed(() => buildOpts(ACCESSORIES.blackbox, '블박'));
const naviOpts     = computed(() => buildOpts(ACCESSORIES.navi, '내비'));
const hipassOpts   = computed(() => buildOpts(ACCESSORIES.hipass, '하이패스'));

function onChange(key, v) {
  quoteState.extras[key] = v;
  window.__welrix_recompute?.();
}
</script>

<template>
  <section id="sec-extras">
    <details class="qp-extras-inline" :open="open" @toggle="open = $event.target.open">
      <summary class="step-title-summary">
        <span class="step-title-text">용품 — 블박 · 내비 · 하이패스</span>
        <span class="caret"></span>
      </summary>
      <div style="margin-top:8px; display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        <CustomDropdown :options="blackboxOpts" :model-value="quoteState.extras.blackbox" placeholder="블박 없음" @change="(v) => onChange('blackbox', v)" />
        <CustomDropdown :options="naviOpts"     :model-value="quoteState.extras.navi"     placeholder="내비 없음" @change="(v) => onChange('navi', v)" />
        <CustomDropdown :options="hipassOpts"   :model-value="quoteState.extras.hipass"   placeholder="하이패스 없음" @change="(v) => onChange('hipass', v)" />
      </div>
    </details>
  </section>
</template>
