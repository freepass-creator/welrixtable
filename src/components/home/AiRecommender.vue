<script setup>
// AI 추천 — 나이 / 성별 / 월소득 / 가족구성 → 적합 차종 3대
// 룰 기반: 예산 = 월소득 × 33%, 가족 크기로 차급 필터, 나이대로 스타일 가중치
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { DELIVERY_REGIONS, TINT_PRICES } from '../../data/lookups.js';
import { fmt } from '../../lib/format.js';

const DEFAULT_DELIVERY_FEE = (DELIVERY_REGIONS['광역시']?.['서울']) || 0;
const DEFAULT_TINT_FEE = (() => {
  const m = TINT_PRICES['루마 GG'];
  if (!m) return 0;
  return (m['front'] || 0) + (m['side_rear_with_coupon'] || 0);
})();

const AGES = [
  { id: '20s', label: '20대', sub: '취향·디자인' },
  { id: '30s', label: '30대', sub: '가성비·실용' },
  { id: '40s', label: '40대', sub: '가족·여유' },
  { id: '50plus', label: '50대+', sub: '품격·안락' },
];
const GENDERS = [
  { id: 'm', label: '남' },
  { id: 'f', label: '여' },
];
const FAMILIES = [
  { id: 1, label: '혼자', sub: '1인' },
  { id: 2, label: '둘이서', sub: '2인' },
  { id: 4, label: '가족', sub: '3~4인' },
  { id: 6, label: '대가족', sub: '5인+' },
];

const age = ref('30s');
const gender = ref('m');
const family = ref(2);
const income = ref(400);   // 만원
const submitted = ref(false);

const vehicles = ref([]);
onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
});

// 가족 크기 → 차급 후보 (모델명 기반 매칭)
const FAMILY_MODELS = {
  1: ['더 뉴 캐스퍼', '아반떼', '베뉴', '코나', '레이', '모닝', 'K3'],
  2: ['아반떼', '쏘나타 디 엣지', '코나', '투싼', '셀토스', '스포티지', '디 올 뉴 K5'],
  4: ['쏘나타 디 엣지', '더 뉴 그랜저', '투싼', '디 올 뉴 싼타페', '스포티지', '쏘렌토'],
  6: ['디 올 뉴 싼타페', '디 올 뉴 팰리세이드', '쏘렌토', '카니발'],
};

// 나이대 → 모델 가중치
const AGE_WEIGHT = {
  '20s':    { '더 뉴 캐스퍼': 1.2, '아반떼': 1.15, '코나': 1.1, '베뉴': 1.1 },
  '30s':    { '쏘나타 디 엣지': 1.2, '투싼': 1.15, '스포티지': 1.15, '셀토스': 1.1, '디 올 뉴 K5': 1.1 },
  '40s':    { '더 뉴 그랜저': 1.2, '디 올 뉴 팰리세이드': 1.2, '쏘렌토': 1.15, '카니발': 1.15, '디 올 뉴 싼타페': 1.1 },
  '50plus': { '더 뉴 그랜저': 1.25, '디 올 뉴 G80 RG3': 1.2, 'G70': 1.15, '디 올 뉴 팰리세이드': 1.1 },
};
// 성별 가중치 (약하게)
const GENDER_WEIGHT = {
  'm': { '디 올 뉴 G80 RG3': 1.05, '카니발': 1.05, 'G70': 1.05, '디 올 뉴 팰리세이드': 1.03 },
  'f': { '더 뉴 캐스퍼': 1.05, '코나': 1.05, '베뉴': 1.05, '셀토스': 1.05 },
};

function calcFor(row, dep = 10) {
  try {
    const r = calcQuote({
      vehicle: row,
      options: { optPrice: 0, discount: 0, deliveryFee: DEFAULT_DELIVERY_FEE, itemsFee: DEFAULT_TINT_FEE, etc: 0 },
      contract: { term: 60, km: '2만km', dep, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: {
        property: '1억', extraDriver: '없음',
        exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
        deductible: '30만원~', emergency: '가입',
      },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return r.monthly;
  } catch { return null; }
}

// 추천 결과 (top 3)
const recommendations = computed(() => {
  if (!submitted.value || !vehicles.value.length) return [];
  const budget = Math.round((+income.value || 0) * 10000 * 0.33);  // 월소득의 33%
  const familyModels = new Set(FAMILY_MODELS[family.value] || []);
  const ageBoost = AGE_WEIGHT[age.value] || {};
  const genderBoost = GENDER_WEIGHT[gender.value] || {};

  const scored = [];
  // 모델당 가장 저렴한 가솔린 트림 1개씩
  const seen = new Set();
  for (const v of vehicles.value) {
    if (seen.has(v.model)) continue;
    seen.add(v.model);
    if (!familyModels.has(v.model)) continue;
    // 같은 모델 row 중 최저가
    const sameModel = vehicles.value.filter(x => x.model === v.model);
    const cheapest = sameModel.reduce((m, c) => (!m || c.price < m.price) ? c : m, null);
    const monthly = calcFor(cheapest);
    if (!monthly) continue;
    // 점수 = 예산 적합도 + 나이 가중치 + 성별 가중치
    const budgetFit = monthly <= budget ? 1.0 : Math.max(0, 1 - (monthly - budget) / budget);
    const ageBoostV = ageBoost[v.model] || 1.0;
    const genderBoostV = genderBoost[v.model] || 1.0;
    const score = budgetFit * ageBoostV * genderBoostV;
    scored.push({
      brand: cheapest.brand, model: v.model, trim: cheapest.trim, price: cheapest.price,
      monthly, score, withinBudget: monthly <= budget,
      reasons: makeReasons({ budgetFit, ageBoostV, genderBoostV, withinBudget: monthly <= budget }),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
});

function makeReasons({ budgetFit, ageBoostV, genderBoostV, withinBudget }) {
  const r = [];
  if (withinBudget) r.push({ icon: 'ph-check-circle', text: '예산 안에 OK' });
  else if (budgetFit > 0.85) r.push({ icon: 'ph-info', text: '예산 살짝 초과' });
  if (ageBoostV >= 1.15) r.push({ icon: 'ph-star', text: '연령대 베스트' });
  else if (ageBoostV >= 1.1) r.push({ icon: 'ph-thumbs-up', text: '연령대 매치' });
  if (genderBoostV > 1) r.push({ icon: 'ph-heart', text: '선호도 매치' });
  return r;
}

const budgetKrw = computed(() => Math.round((+income.value || 0) * 10000 * 0.33));

function submit() { submitted.value = true; }
function reset() { submitted.value = false; }

function goToContact(rec) {
  const params = new URLSearchParams({
    vehicle: `${rec.brand} ${rec.model}`,
    term: 60,
    monthly: rec.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="ai">
    <div class="ai-wrap">
      <!-- 왼쪽: 폼 -->
      <div class="ai-form">
        <div class="ai-field">
          <label class="ai-label">나이대</label>
          <div class="ai-chips">
            <button v-for="a in AGES" :key="a.id"
                    class="ai-chip"
                    :class="{ 'is-active': age === a.id }"
                    @click="age = a.id; submitted = false">
              <span>{{ a.label }}</span>
              <small>{{ a.sub }}</small>
            </button>
          </div>
        </div>

        <div class="ai-row">
          <div class="ai-field">
            <label class="ai-label">성별</label>
            <div class="ai-chips ai-chips--2">
              <button v-for="g in GENDERS" :key="g.id"
                      class="ai-chip"
                      :class="{ 'is-active': gender === g.id }"
                      @click="gender = g.id; submitted = false">
                {{ g.label }}
              </button>
            </div>
          </div>
          <div class="ai-field">
            <label class="ai-label">가족 구성</label>
            <div class="ai-chips ai-chips--4">
              <button v-for="f in FAMILIES" :key="f.id"
                      class="ai-chip ai-chip--sm"
                      :class="{ 'is-active': family === f.id }"
                      @click="family = f.id; submitted = false">
                <span>{{ f.label }}</span>
                <small>{{ f.sub }}</small>
              </button>
            </div>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">월 소득 <small class="ai-hint">(세후 만원 단위)</small></label>
          <div class="ai-income">
            <input
              type="number" min="100" max="3000" step="50"
              v-model.number="income"
              @input="submitted = false"
              class="ai-income__input"
              placeholder="400"
            />
            <span class="ai-income__unit">만원</span>
          </div>
          <div class="ai-budget" v-if="income">
            <i class="ph ph-info"></i>
            월 부담 추천 한도 <b>{{ fmt(budgetKrw) }}원</b> (월소득의 33%)
          </div>
        </div>

        <button class="ai-submit" @click="submit">
          <i class="ph ph-sparkle"></i> AI 추천 받기
        </button>
      </div>

      <!-- 오른쪽: 결과 -->
      <div class="ai-result">
        <div v-if="!submitted" class="ai-result__empty">
          <div class="ai-result__empty-glow"></div>
          <i class="ph ph-magic-wand"></i>
          <h4>당신만의 추천 차종</h4>
          <p>3가지 정보만 알려주시면<br>AI 가 딱 맞는 차종을 골라드립니다.</p>
        </div>

        <div v-else-if="recommendations.length === 0" class="ai-result__empty">
          <i class="ph ph-warning-circle"></i>
          <h4>적합한 차종을 찾지 못했어요</h4>
          <p>예산을 조금 올리거나<br>가족 구성을 다시 선택해 보세요.</p>
        </div>

        <div v-else class="ai-result__list">
          <div class="ai-result__title">
            <span class="ai-result__icon"><i class="ph ph-sparkle"></i></span>
            추천 결과 — {{ recommendations.length }}대
          </div>
          <div
            v-for="(r, i) in recommendations" :key="r.model"
            class="ai-card"
            :class="{ 'is-top': i === 0 }"
          >
            <div class="ai-card__rank">{{ ['🥇','🥈','🥉'][i] }}</div>
            <div class="ai-card__main">
              <div class="ai-card__brand">{{ r.brand }}</div>
              <div class="ai-card__model">{{ r.model }}</div>
              <div class="ai-card__trim">{{ r.trim }}</div>
              <div class="ai-card__reasons">
                <span v-for="(rs, ri) in r.reasons" :key="ri" class="ai-card__reason">
                  <i :class="`ph ${rs.icon}`"></i> {{ rs.text }}
                </span>
              </div>
            </div>
            <div class="ai-card__price">
              <div class="ai-card__monthly">{{ fmt(r.monthly) }}<small>원/월</small></div>
              <div class="ai-card__from">60개월 기준</div>
              <button class="ai-card__cta" @click="goToContact(r)">
                상담 신청 <i class="ph ph-arrow-right"></i>
              </button>
            </div>
          </div>
          <button class="ai-result__again" @click="reset">
            <i class="ph ph-arrow-counter-clockwise"></i> 다시 추천 받기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai { max-width: 1180px; margin: 0 auto; }

.ai-wrap {
  display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px;
  background: var(--bg);
  border-radius: var(--radius-lg);
  padding: 32px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.08),
    0 4px 12px rgba(0,0,0,0.04);
  border: 1px solid var(--line);
}
@media (max-width: 980px) {
  .ai-wrap { grid-template-columns: 1fr; padding: 24px; gap: 20px; }
}

/* === 왼쪽 폼 === */
.ai-eyebrow {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 5px 12px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
  margin-bottom: 14px;
}
.ai-eyebrow i { font-size: 12px; }
.ai-title {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.3px; margin: 0 0 8px;
}
.ai-sub {
  font-size: 13.5px; color: var(--ink-3); line-height: 1.65;
  margin: 0 0 24px;
}

.ai-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.ai-row {
  display: grid; grid-template-columns: 0.7fr 1.5fr; gap: 14px;
  margin-bottom: 18px;
}
.ai-row .ai-field { margin-bottom: 0; }
@media (max-width: 540px) {
  .ai-row { grid-template-columns: 1fr; gap: 18px; }
}

.ai-label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.1px;
}
.ai-hint { font-size: 10.5px; font-weight: 400; color: var(--ink-4); margin-left: 4px; }

.ai-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.ai-chips--2 { grid-template-columns: 1fr 1fr; }
.ai-chips--4 { grid-template-columns: repeat(4, 1fr); }
.ai-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 11px 4px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.ai-chip small {
  font-size: 9.5px; color: var(--ink-4); font-weight: 400;
}
.ai-chip:hover { border-color: var(--ink-4); }
.ai-chip.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.ai-chip.is-active small { color: rgba(255,255,255,0.6); }
.ai-chip--sm { padding: 9px 2px; font-size: 12px; }
.ai-chip--sm small { font-size: 9px; }

/* 월 소득 input */
.ai-income {
  display: flex; align-items: center;
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-sm);
  transition: border-color var(--t-fast);
}
.ai-income:focus-within { border-color: var(--brand); }
.ai-income__input {
  flex: 1; min-width: 0;
  height: 46px;
  border: 0; background: transparent;
  padding: 0 14px;
  font-family: inherit; font-size: 16px; font-weight: 600;
  color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  outline: none;
}
.ai-income__input::-webkit-outer-spin-button,
.ai-income__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ai-income__unit {
  padding-right: 14px;
  font-size: 13px; color: var(--ink-3); font-weight: 500;
}
.ai-budget {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--ink-3);
  background: var(--bg-soft);
  padding: 8px 12px; border-radius: var(--radius-sm);
  margin-top: 4px;
}
.ai-budget i { font-size: 13px; color: var(--brand); }
.ai-budget b { color: var(--ink-1); font-weight: 700; font-variant-numeric: tabular-nums; }

.ai-submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 52px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: var(--radius-pill);
  font-family: inherit;
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.2px;
  cursor: pointer;
  margin-top: 8px;
  transition: background var(--t-fast), transform var(--t-fast);
}
.ai-submit:hover {
  background: var(--brand-700); transform: translateY(-1px);
}
.ai-submit:active { transform: translateY(0); }

/* === 오른쪽 결과 === */
.ai-result {
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 24px;
  min-height: 380px;
  display: flex; flex-direction: column;
}

.ai-result__empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px 16px;
  color: var(--ink-3);
  position: relative;
}
.ai-result__empty-glow { display: none; }
.ai-result__empty i, .ai-result__empty h4, .ai-result__empty p {
  position: relative; z-index: 1;
}
.ai-result__empty i {
  font-size: 48px; color: var(--brand);
  margin-bottom: 14px;
}
.ai-result__empty h4 {
  margin: 0 0 8px; font-size: 18px; font-weight: 700;
  color: var(--ink-1); letter-spacing: -0.2px;
}
.ai-result__empty p { margin: 0; font-size: 13px; line-height: 1.65; }

/* 결과 리스트 */
.ai-result__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.2px;
  margin-bottom: 16px;
}
.ai-result__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  background: var(--brand); color: #fff; border-radius: var(--radius-sm);
  font-size: 13px;
}
.ai-result__list { display: flex; flex-direction: column; gap: 10px; flex: 1; }

.ai-card {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 12px; align-items: center;
  padding: 14px;
  background: var(--bg);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-md);
  animation: ai-pop .35s ease-out both;
}
@keyframes ai-pop {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-card.is-top {
  border-color: var(--brand);
  background: #fff;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}
.ai-card__rank {
  font-size: 22px;
  text-align: center;
}
.ai-card__brand {
  font-size: 10.5px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.3px;
}
.ai-card__model {
  font-size: 14.5px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.2px; line-height: 1.25;
}
.ai-card__trim {
  font-size: 11px; color: var(--ink-3);
  margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ai-card__reasons {
  display: flex; gap: 4px; flex-wrap: wrap;
  margin-top: 6px;
}
.ai-card__reason {
  display: inline-flex; align-items: center; gap: 3px;
  background: var(--bg-soft);
  padding: 2px 7px; border-radius: var(--radius-pill);
  font-size: 10px; font-weight: 600; color: var(--ink-2);
}
.ai-card.is-top .ai-card__reason {
  background: rgba(255,255,255,0.7); color: var(--brand);
}
.ai-card__reason i { font-size: 10px; }

.ai-card__price { text-align: right; }
.ai-card__monthly {
  font-size: 17px; font-weight: 800; color: var(--brand);
  font-variant-numeric: tabular-nums; letter-spacing: -0.3px;
  line-height: 1.1;
}
.ai-card__monthly small {
  font-size: 10px; color: var(--ink-4); font-weight: 500;
  margin-left: 1px;
}
.ai-card__from {
  font-size: 10px; color: var(--ink-4);
  margin-top: 2px;
}
.ai-card__cta {
  display: inline-flex; align-items: center; gap: 3px;
  background: var(--ink-1); color: #fff;
  border: 0; border-radius: var(--radius-pill);
  padding: 6px 12px;
  font-family: inherit; font-size: 11px; font-weight: 700;
  cursor: pointer;
  margin-top: 8px;
  transition: background var(--t-fast);
}
.ai-card__cta:hover { background: var(--brand); }
.ai-card__cta i { font-size: 11px; }

.ai-result__again {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--ink-3);
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-pill);
  padding: 10px 0;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-result__again:hover {
  background: var(--bg-soft); color: var(--ink-1); border-color: var(--ink-4);
}
</style>
