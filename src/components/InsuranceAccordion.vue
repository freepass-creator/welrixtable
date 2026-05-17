<script setup>
import { ref } from 'vue';
import { quoteState } from '../store.js';
import CustomDropdown from './CustomDropdown.vue';

const open = ref(false);

const SVC_OPTS = [
  { value: '웰스 Basic', label: '웰스 Basic' },
  { value: '웰스 Self',  label: '웰스 Self' },
];
const INS_OPTS = [
  { value: '1억', label: '대물 1억' },
  { value: '2억', label: '대물 2억' },
  { value: '3억', label: '대물 3억' },
  { value: '5억', label: '대물 5억' },
];
const EXTRA_OPTS = [
  { value: '없음', label: '추가운전자 없음' },
  { value: '1명', label: '추가운전자 1명' },
  { value: '2명', label: '추가운전자 2명' },
  { value: '3명', label: '추가운전자 3명' },
];

function onSvc(v)   { quoteState.cond.svc = v;          window.__welrix_recompute?.(); }
function onIns(v)   { quoteState.cond.insProperty = v;  window.__welrix_recompute?.(); }
function onExtra(v) { quoteState.cond.extraDriver = v;  window.__welrix_recompute?.(); }
</script>

<template>
  <section id="sec-insurance">
    <details class="qp-extras-inline" :open="open" @toggle="open = $event.target.open">
      <summary class="step-title-summary">
        <span class="step-title-text">서비스 · 대물보험 · 추가운전자</span>
        <span class="caret"></span>
      </summary>
      <div style="margin-top:8px; display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        <CustomDropdown :options="SVC_OPTS"   :model-value="quoteState.cond.svc"          placeholder="웰스 Basic" @change="onSvc" />
        <CustomDropdown :options="INS_OPTS"   :model-value="quoteState.cond.insProperty"  placeholder="대물 1억"   @change="onIns" />
        <CustomDropdown :options="EXTRA_OPTS" :model-value="quoteState.cond.extraDriver"  placeholder="추가운전자 없음" @change="onExtra" />
      </div>
    </details>
  </section>
</template>
