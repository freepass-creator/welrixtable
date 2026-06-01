<script setup>
// 손님 셀프 견적 — 차종 카스케이드 + 기간 선택 → 월 대여료 즉시 표시
// 표준 조건: 중신용 / 보증금 10% / 선납 0% / 2만km / 보험 1억
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';

const BRANDS = ['현대', '기아', '제네시스'];
const TERMS = [60, 48, 36];

const vehicles = ref([]);
const loading = ref(true);
const error = ref('');

const selectedBrand = ref('현대');
const selectedModel = ref('');
const selectedTrim = ref(null);   // 행 직접 보관 (간소화)
const selectedTerm = ref(60);

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch (e) {
    error.value = '차량 데이터 로드 실패';
  } finally {
    loading.value = false;
  }
});

const modelsInBrand = computed(() => {
  const seen = new Set();
  const out = [];
  for (const v of vehicles.value) {
    if (v.brand !== selectedBrand.value) continue;
    if (seen.has(v.model)) continue;
    seen.add(v.model);
    out.push(v.model);
  }
  return out;
});

const trimsInModel = computed(() => {
  if (!selectedModel.value) return [];
  return vehicles.value
    .filter(v => v.brand === selectedBrand.value && v.model === selectedModel.value)
    .sort((a, b) => a.price - b.price);
});

function selectBrand(b) {
  selectedBrand.value = b;
  selectedModel.value = '';
  selectedTrim.value = null;
}
function selectModel(m) {
  selectedModel.value = m;
  selectedTrim.value = null;
  // 자동 첫 트림 선택 — 손님 빠른 결과 보게
  setTimeout(() => {
    const first = trimsInModel.value[0];
    if (first) selectedTrim.value = first;
  }, 0);
}
function selectTrim(t) { selectedTrim.value = t; }
function selectTerm(t) { selectedTerm.value = t; }

const result = computed(() => {
  const v = selectedTrim.value;
  if (!v) return null;
  try {
    const r = calcQuote({
      vehicle: v,
      options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
      contract: { term: selectedTerm.value, km: '2만km', dep: 10, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: {
        property: '1억', extraDriver: '없음',
        exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
        deductible: '30만원~', emergency: '가입',
      },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return {
      monthly: r.monthly,
      depAmt: r.depositAmt,
      residualPct: r.residualPct,
      residualAmt: r.residualAmt,
    };
  } catch (e) {
    return null;
  }
});

// 상담 신청으로 이 견적 정보 보내기 — section 스크롤
function goToContact() {
  // 선택 정보 쿼리스트링으로 (LeadForm 이 읽어감)
  if (selectedTrim.value) {
    const params = new URLSearchParams({
      vehicle: `${selectedTrim.value.brand} ${selectedTrim.value.model} ${selectedTrim.value.trim}`,
      term: selectedTerm.value,
      monthly: result.value?.monthly || '',
    });
    history.replaceState(null, '', '#contact?' + params.toString());
  }
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="qw">
    <div v-if="loading" class="qw-loading">차량 데이터 로드 중…</div>
    <div v-else-if="error" class="qw-error">{{ error }}</div>
    <div v-else class="qw-grid">
      <!-- 좌측: 선택 영역 -->
      <div class="qw-pickers">
        <div class="qw-field">
          <label class="qw-label">제조사</label>
          <div class="qw-brands">
            <button
              v-for="b in BRANDS" :key="b"
              class="qw-brand-btn"
              :class="{ 'is-active': selectedBrand === b }"
              @click="selectBrand(b)"
            >{{ b }}</button>
          </div>
        </div>

        <div class="qw-field">
          <label class="qw-label">모델</label>
          <select class="qw-select" v-model="selectedModel" @change="selectModel($event.target.value)">
            <option value="">모델 선택</option>
            <option v-for="m in modelsInBrand" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div class="qw-field" v-if="trimsInModel.length">
          <label class="qw-label">트림</label>
          <div class="qw-trims">
            <button
              v-for="t in trimsInModel" :key="t.trim"
              class="qw-trim-btn"
              :class="{ 'is-active': selectedTrim?.trim === t.trim }"
              @click="selectTrim(t)"
            >
              <div class="qw-trim-name">{{ t.trim }}</div>
              <div class="qw-trim-price">{{ fmt(t.price) }}<small>원</small></div>
            </button>
          </div>
        </div>

        <div class="qw-field">
          <label class="qw-label">기간</label>
          <div class="qw-terms">
            <button
              v-for="t in TERMS" :key="t"
              class="qw-term-btn"
              :class="{ 'is-active': selectedTerm === t }"
              @click="selectTerm(t)"
            >{{ t }}개월</button>
          </div>
        </div>
      </div>

      <!-- 우측: 결과 -->
      <aside class="qw-result">
        <div v-if="!selectedTrim" class="qw-result__empty">
          <i class="ph ph-car-profile"></i>
          <p>차종을 선택하면<br>즉시 월 대여료가 계산됩니다.</p>
        </div>
        <template v-else>
          <div class="qw-result__head">
            <div class="qw-result__brand">{{ selectedTrim.brand }} · {{ selectedTrim.model }}</div>
            <div class="qw-result__trim">{{ selectedTrim.trim }}</div>
          </div>

          <div class="qw-result__hero">
            <div class="qw-result__monthly-label">{{ selectedTerm }}개월 월 대여료</div>
            <div class="qw-result__monthly">
              <span v-if="result">{{ fmt(result.monthly) }}<small>원/월</small></span>
              <span v-else>—</span>
            </div>
          </div>

          <div class="qw-result__rows">
            <div class="qw-result__row">
              <span>차량가</span>
              <b>{{ fmt(selectedTrim.price) }}원</b>
            </div>
            <div class="qw-result__row">
              <span>보증금 (10%)</span>
              <b>{{ result ? fmt(result.depAmt) : '—' }}원</b>
            </div>
            <div class="qw-result__row">
              <span>만기인수 (선택)</span>
              <b>{{ result ? fmt(result.residualAmt) : '—' }}원</b>
            </div>
          </div>

          <div class="qw-result__cond">
            ※ 표준 조건: 중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억<br>
            실제 견적은 신용·소득·차량 옵션에 따라 다를 수 있습니다.
          </div>

          <button class="qw-result__cta" @click="goToContact">
            <i class="ph ph-chat-circle-dots"></i>
            이 견적으로 상담 신청
          </button>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.qw { max-width: 980px; margin: 0 auto; }
.qw-loading, .qw-error {
  text-align: center; padding: 60px 20px;
  color: var(--ink-3); font-size: 14px;
}

.qw-grid {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px;
  align-items: start;
}
@media (max-width: 820px) {
  .qw-grid { grid-template-columns: 1fr; gap: 20px; }
}

/* === 선택 영역 === */
.qw-pickers {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 24px;
  display: flex; flex-direction: column; gap: 22px;
}
.qw-field { display: flex; flex-direction: column; gap: 8px; }
.qw-label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.1px;
}

/* 제조사 버튼 그룹 */
.qw-brands { display: flex; gap: 6px; }
.qw-brand-btn {
  flex: 1; padding: 12px 8px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.qw-brand-btn:hover { border-color: var(--ink-4); }
.qw-brand-btn.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}

/* 모델 select */
.qw-select {
  appearance: none; -webkit-appearance: none;
  width: 100%; height: 46px;
  padding: 0 38px 0 14px;
  border: 1.5px solid var(--line-2); border-radius: var(--radius-sm);
  background: var(--bg);
  font-family: inherit; font-size: 14.5px; color: var(--ink-1);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat; background-position: right 12px center; background-size: 12px 12px;
  outline: none;
  transition: border-color var(--t-fast);
}
.qw-select:focus { border-color: var(--brand); }

/* 트림 버튼 그리드 */
.qw-trims {
  display: grid; grid-template-columns: 1fr; gap: 6px;
  max-height: 240px; overflow-y: auto;
}
.qw-trim-btn {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-1);
  border-radius: var(--radius-sm);
  font-family: inherit; text-align: left;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.qw-trim-btn:hover { border-color: var(--ink-4); background: var(--bg-soft); }
.qw-trim-btn.is-active {
  background: var(--brand-50); border-color: var(--brand);
}
.qw-trim-name { font-size: 13px; font-weight: 500; letter-spacing: -0.1px; }
.qw-trim-price {
  font-size: 13.5px; font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums;
}
.qw-trim-price small {
  font-size: 10px; color: var(--ink-4); font-weight: 400; margin-left: 1px;
}

/* 기간 버튼 */
.qw-terms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.qw-term-btn {
  padding: 12px 0;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.qw-term-btn:hover { border-color: var(--ink-4); }
.qw-term-btn.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}

/* === 결과 카드 === */
.qw-result {
  background: var(--ink-1); color: #fff;
  border-radius: var(--radius-md);
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 18px;
  position: sticky; top: 80px;
}
.qw-result__empty {
  text-align: center; color: rgba(255,255,255,0.55);
  padding: 28px 8px;
}
.qw-result__empty i { font-size: 40px; color: rgba(255,255,255,0.3); }
.qw-result__empty p { margin: 14px 0 0; font-size: 13.5px; line-height: 1.6; }

.qw-result__head { display: flex; flex-direction: column; gap: 2px; }
.qw-result__brand {
  font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500;
  letter-spacing: 0.3px;
}
.qw-result__trim {
  font-size: 15px; font-weight: 700; color: #fff;
  letter-spacing: -0.2px; line-height: 1.4;
}

.qw-result__hero {
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-sm);
  padding: 18px 20px;
}
.qw-result__monthly-label {
  font-size: 11.5px; color: rgba(255,255,255,0.55); font-weight: 500;
  letter-spacing: 0.3px; margin-bottom: 6px;
}
.qw-result__monthly {
  font-size: 34px; font-weight: 800;
  letter-spacing: -0.04em; color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.qw-result__monthly small {
  font-size: 14px; color: rgba(255,255,255,0.55); font-weight: 400;
  margin-left: 4px; letter-spacing: 0;
}

.qw-result__rows {
  display: flex; flex-direction: column; gap: 8px;
}
.qw-result__row {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12.5px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.1);
}
.qw-result__row:last-child { border-bottom: 0; }
.qw-result__row span { color: rgba(255,255,255,0.55); }
.qw-result__row b {
  color: #fff; font-weight: 600; font-variant-numeric: tabular-nums;
}

.qw-result__cond {
  font-size: 11px; color: rgba(255,255,255,0.4);
  line-height: 1.55;
}

.qw-result__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: #fff; color: var(--ink-1);
  border: 0; border-radius: var(--radius-pill);
  padding: 14px 22px;
  font-size: 14px; font-weight: 700;
  transition: background var(--t-fast), transform var(--t-fast);
}
.qw-result__cta:hover { background: var(--brand-50); transform: translateY(-1px); }
.qw-result__cta i { font-size: 16px; }
</style>
