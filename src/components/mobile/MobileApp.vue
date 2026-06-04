<script setup>
import { ref, computed } from 'vue';
import { quoteState, vehicleState } from '../../store.js';
import StepVehicle from './StepVehicle.vue';
import StepConditions from './StepConditions.vue';
import StepExtras from './StepExtras.vue';
import StickyQuote from './StickyQuote.vue';
import SendSheet from './SendSheet.vue';

const cfg = computed(() => window.__welrix_companyConfig || {});

// 발송은 헤더 상단 아이콘으로 — step 으로 안 둠 (사용자 의도)
const STEPS = [
  { key: 'vehicle',    label: '차량',     comp: StepVehicle    },
  { key: 'conditions', label: '계약 조건', comp: StepConditions },
  { key: 'extras',     label: '용품·서비스', comp: StepExtras   },
];

const stepIdx = ref(0);
const currentStep = computed(() => STEPS[stepIdx.value]);

const VEHICLE_SUB_STEPS = ['brand', 'model', 'variant', 'trim', 'options', 'colors'];

// 전체 페이지 (sub-step 포함) — progress bar 세그먼트 수
const TOTAL_PAGES = VEHICLE_SUB_STEPS.length + (STEPS.length - 1);  // 6 + 2 = 8
// 현재 페이지 인덱스 (0-based)
const currentPageIdx = computed(() => {
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    return VEHICLE_SUB_STEPS.indexOf(sub);
  }
  return VEHICLE_SUB_STEPS.length + (stepIdx.value - 1);
});

const canGoBack = computed(() => {
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    if (VEHICLE_SUB_STEPS.indexOf(sub) > 0) return true;
  }
  return stepIdx.value > 0;
});

const canProceed = computed(() => {
  if (currentStep.value.key !== 'vehicle') return true;
  const sub = vehicleState.subStep || 'brand';
  if (sub === 'brand')   return !!vehicleState.manufacturer;
  if (sub === 'model')   return !!vehicleState.model;
  if (sub === 'variant') return !!vehicleState.variant;
  if (sub === 'trim')    return !!vehicleState.trim;
  return true;
});

function next() {
  if (!canProceed.value) return;
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    const i = VEHICLE_SUB_STEPS.indexOf(sub);
    if (i >= 0 && i < VEHICLE_SUB_STEPS.length - 1) {
      vehicleState.subStep = VEHICLE_SUB_STEPS[i + 1];
      return;
    }
  }
  if (stepIdx.value < STEPS.length - 1) stepIdx.value++;
}

function prev() {
  if (currentStep.value.key === 'vehicle') {
    const sub = vehicleState.subStep || 'brand';
    const i = VEHICLE_SUB_STEPS.indexOf(sub);
    if (i > 0) {
      vehicleState.subStep = VEHICLE_SUB_STEPS[i - 1];
      return;
    }
  }
  if (stepIdx.value > 0) stepIdx.value--;
}

const vehicles = ref(window.__welrix_vehicles || []);

// 발송 sheet
const sendOpen = ref(false);
function openSend() {
  if (!vehicleState.trim) return;
  sendOpen.value = true;
}

// 조회동의 링크 복사 — 헤더 (발송하기 좌측). 회사 설정의 signature_link
const signCopied = ref(false);
async function copySignLink() {
  const url = cfg.value.signature_link;
  if (!url) { alert('이 회사는 조회동의 링크가 설정되어 있지 않습니다.'); return; }
  try {
    await navigator.clipboard.writeText(url);
    signCopied.value = true;
    setTimeout(() => { signCopied.value = false; }, 2500);
  } catch {
    prompt('아래 링크를 복사해 손님께 전달하세요:', url);
  }
}
</script>

<template>
  <div class="m-shell">
    <!-- 헤더 — 좌측: CI + 페이지 타이틀, 우측: 발송 -->
    <header class="m-header">
      <div class="m-header__brand">
        <img class="m-ci" src="/welrix-ci.png" alt="웰릭스 모빌리티" />
      </div>
      <div class="m-header__actions">
        <button class="m-act" @click="copySignLink">
          <i class="ph" :class="signCopied ? 'ph-check-circle' : 'ph-signature'"></i>
          <span>{{ signCopied ? '복사됨' : '동의링크' }}</span>
        </button>
        <button class="m-act m-act--primary" :disabled="!vehicleState.trim" @click="openSend">
          <i class="ph ph-paper-plane-tilt"></i>
          <span>견적 발송하기</span>
        </button>
      </div>
    </header>

    <!-- 페이지별 progress segment — 전체 페이지 수 만큼 -->
    <div class="m-progress">
      <div v-for="i in TOTAL_PAGES" :key="i"
           class="m-progress__seg"
           :class="{ 'is-done': (i - 1) <= currentPageIdx }"></div>
    </div>

    <main class="m-main">
      <component :is="currentStep.comp" :vehicles="vehicles" />
    </main>

    <StickyQuote v-if="vehicleState.trim" />

    <footer class="m-footer">
      <button v-if="canGoBack" class="m-btn m-btn--ghost" @click="prev">
        <i class="ph ph-arrow-left"></i>이전
      </button>
      <button
        v-if="stepIdx < STEPS.length - 1"
        class="m-btn m-btn--primary"
        :disabled="!canProceed"
        @click="next"
      >다음<i class="ph ph-arrow-right"></i></button>
      <button
        v-else
        class="m-btn m-btn--primary"
        :disabled="!vehicleState.trim"
        @click="openSend"
      ><i class="ph ph-paper-plane-tilt"></i>견적 발송</button>
    </footer>

    <SendSheet :open="sendOpen" @close="sendOpen = false" />
  </div>
</template>

<style scoped>
.m-shell {
  display: flex; flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

/* 헤더 — 상단 항상 고정 */
.m-header {
  position: fixed; top: 0; left: 0; right: 0;
  z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(var(--safe-top) + 10px) 14px 10px;
  background: var(--bg);
  gap: 8px;
}
.m-header__brand {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
}
.m-ci {
  height: 20px; width: auto;
  object-fit: contain;
  flex-shrink: 0;
}
.m-title {
  font-size: 12.5px; font-weight: 600; color: var(--ink-1);
  letter-spacing: -0.3px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.m-header__actions {
  display: flex; gap: 6px; flex-shrink: 0;
}
.m-act {
  display: inline-flex; align-items: center; gap: 5px;
  height: var(--h-chip); padding: 0 6px;
  background: transparent;
  color: var(--brand);
  border: 0;
  font-family: inherit; font-size: var(--fs-md); font-weight: var(--fw-semi);
  cursor: pointer; transition: opacity .12s;
  letter-spacing: -0.2px;
}
.m-act i { font-size: 16px; }
.m-act:disabled {
  color: var(--ink-4);
  cursor: not-allowed;
}
.m-act:not(:disabled):active { opacity: 0.6; }

.m-progress {
  display: flex; gap: 4px;
  position: fixed; top: calc(var(--safe-top) + 56px); left: 0; right: 0;
  padding: 0 14px 6px;
  background: var(--bg);
  z-index: 19;
}
.m-progress__seg {
  flex: 1; height: 3px;
  background: var(--line);
  border-radius: 2px;
  transition: background .25s ease-out;
}
.m-progress__seg.is-done {
  background: var(--brand);
}

.m-main {
  flex: 1;
  padding: calc(var(--safe-top) + 80px) 20px calc(var(--safe-bottom) + 220px);
  overflow-y: auto;
}

.m-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; gap: 8px;
  padding: 12px 16px calc(var(--safe-bottom) + 12px);
  background: var(--bg);
  z-index: 30;
}
.m-btn {
  height: var(--h-cta);
  border: 0; border-radius: var(--r-card);
  font-family: inherit; font-weight: 600;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: background .12s, opacity .12s;
}
.m-btn i { font-size: 18px; }
.m-btn--ghost {
  flex: 0 0 96px;
  background: var(--bg-soft);
  color: var(--ink-2);
  font-size: 14px;
}
.m-btn--ghost:active { background: var(--line-2); }
.m-btn--primary {
  flex: 1;
  background: var(--brand); color: #fff;
  font-size: 16px;
}
.m-btn--primary:not(:disabled):active { background: var(--brand-700); }
.m-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
