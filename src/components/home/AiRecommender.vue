<script setup>
// AI 추천 — 6가지 입력 (나이/성별/라이프스타일/용도/주행거리/소득)
// 다요소 가중합 점수 → top 1 hero + 2 alt
// 개인화 narrative + 매치 %
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

// === 입력 옵션 ===
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
const LIFESTYLES = [
  { id: 'single', label: '혼자', sub: '1인', size: 1 },
  { id: 'couple', label: '연애 중', sub: '2인', size: 2 },
  { id: 'family', label: '가족', sub: '3~4인', size: 4 },
  { id: 'large', label: '대가족', sub: '5인+', size: 6 },
];
const USAGES = [
  { id: 'commute', label: '출퇴근', sub: '데일리' },
  { id: 'leisure', label: '가족·여행', sub: '주말' },
  { id: 'business', label: '비즈니스', sub: '의전·영업' },
  { id: 'hobby', label: '여가', sub: '취미·아웃도어' },
];
const MILEAGES = [
  { id: 'low', label: '적게', sub: '1만km/년↓', km: 1 },
  { id: 'mid', label: '보통', sub: '2만km/년', km: 2 },
  { id: 'high', label: '많이', sub: '3만km/년↑', km: 3 },
];

// === 차종 카탈로그 (스코어링용 메타) ===
// body: compact / sedan / suv-mid / suv-large / minivan / luxury
// size: S/M/L/XL  /  age: 적합 연령대 set
// usage: 적합 용도 set  /  mileage: 적합 주행거리 ('any'/'low'/'mid'/'high')
const MODEL_META = {
  '더 뉴 캐스퍼':         { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'low',  image: '/cars/casper.jpg',
    story: '경형 SUV 시장의 표준. 1.0 터보 + 4단 자동변속기 조합으로 연비·가속 균형. 비좁아 보여도 트렁크 + 풀폴딩 시트로 실내 활용도 의외로 좋습니다. 1인·2인 가구의 첫 차로 가장 많이 선택되는 모델.', },
  '아반떼':              { body: 'sedan',   size: 'M', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any' },
  '아반떼 Hybrid':       { body: 'sedan',   size: 'M', age: ['20s','30s','40s'],    usage: ['commute'],                    mileage: 'high' },
  '쏘나타 디 엣지':      { body: 'sedan',   size: 'L', age: ['30s','40s'],          usage: ['commute','business','leisure'], mileage: 'any' },
  '쏘나타 디 엣지 Hybrid': { body: 'sedan', size: 'L', age: ['30s','40s'],          usage: ['commute','business'],         mileage: 'high' },
  '더 뉴 그랜저':        { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business','leisure'],         mileage: 'any' },
  '더 뉴 그랜저 Hybrid': { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'high' },
  '베뉴':                { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any' },
  '코나':                { body: 'suv-mid', size: 'M', age: ['20s','30s'],          usage: ['commute','leisure','hobby'],  mileage: 'any' },
  '코나 Hybrid':         { body: 'suv-mid', size: 'M', age: ['20s','30s','40s'],    usage: ['commute','leisure'],          mileage: 'high' },
  '투싼':                { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure','family'], mileage: 'any' },
  '투싼 Hybrid':         { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure'],          mileage: 'high' },
  '디 올 뉴 싼타페':      { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'any' },
  '디 올 뉴 싼타페 Hybrid': { body: 'suv-large', size: 'L', age: ['30s','40s'],      usage: ['leisure','family'],           mileage: 'high' },
  '디 올 뉴 팰리세이드':  { body: 'suv-large', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family','business'], mileage: 'any', image: '/cars/palisade.jpg',
    story: '2025년 1월 풀체인지급 페이스리프트(LX3 세대). 7·9인승 풀사이즈 SUV의 정점. 12.3" 듀얼 디스플레이 + 어드밴스드 안전 패키지 기본. 통풍·열선 시트, 스마트 파워테일게이트 — 가족 차로서 빠진 옵션이 없습니다.', },
  '디 올 뉴 팰리세이드 Hybrid': { body: 'suv-large', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family'], mileage: 'high', image: '/cars/palisade.jpg' },
  '포터2':               { body: 'truck',   size: 'L', age: ['30s','40s','50plus'], usage: ['business'],                   mileage: 'high' },
  // 기아
  '모닝':                { body: 'compact', size: 'S', age: ['20s'],                usage: ['commute'],                    mileage: 'any' },
  '더 뉴 레이 TAM':       { body: 'compact', size: 'S', age: ['20s','30s'],          usage: ['commute','hobby'],            mileage: 'any' },
  'K3':                  { body: 'sedan',   size: 'M', age: ['20s','30s'],          usage: ['commute'],                    mileage: 'any' },
  '디 올 뉴 K5':         { body: 'sedan',   size: 'L', age: ['20s','30s','40s'],    usage: ['commute','leisure'],          mileage: 'any' },
  '디 올 뉴 K5 Hybrid':  { body: 'sedan',   size: 'L', age: ['30s','40s'],          usage: ['commute'],                    mileage: 'high' },
  'K8':                  { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'any' },
  'K8 Hybrid':           { body: 'sedan',   size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'high' },
  '셀토스':              { body: 'suv-mid', size: 'M', age: ['20s','30s'],          usage: ['commute','leisure','hobby'],  mileage: 'any' },
  '스포티지':            { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure','family'], mileage: 'any' },
  '스포티지 Hybrid':     { body: 'suv-mid', size: 'M', age: ['30s','40s'],          usage: ['commute','leisure'],          mileage: 'high' },
  '쏘렌토':              { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'any' },
  '쏘렌토 Hybrid':       { body: 'suv-large', size: 'L', age: ['30s','40s'],        usage: ['leisure','family'],           mileage: 'high' },
  '카니발':              { body: 'minivan', size: 'XL', age: ['30s','40s','50plus'], usage: ['leisure','family','business'], mileage: 'any', image: '/cars/carnival.jpg',
    story: '국내 미니밴 부동의 1위. 4세대 KA4는 SUV 같은 디자인 + 9인승 실내 공간을 둘 다 잡았습니다. 양쪽 슬라이딩 도어 + 2열 통풍·열선 시트 + 하이리무진 옵션까지. 가족·임원·영업 등 활용 범위가 가장 넓은 차종.', },
  '카니발 Hybrid':       { body: 'minivan', size: 'XL', age: ['30s','40s'],         usage: ['family'],                     mileage: 'high', image: '/cars/carnival.jpg' },
  // 제네시스
  'G70':                 { body: 'luxury',  size: 'L', age: ['30s','40s'],          usage: ['business','hobby'],           mileage: 'any' },
  '디 올 뉴 G80 RG3':    { body: 'luxury',  size: 'XL', age: ['40s','50plus'],      usage: ['business'],                   mileage: 'any', image: '/cars/g80.jpg',
    story: '제네시스의 정통 럭셔리 세단 RG3 세대. 라디에이터 그릴부터 인테리어까지 완전히 새로 만든 풀체인지. 다이내믹 주행감과 정중한 디자인을 동시에. 임원 의전·비즈니스 미팅에서 가장 많이 보이는 선택.', },
  'G90 RS4':             { body: 'luxury',  size: 'XL', age: ['50plus'],            usage: ['business'],                   mileage: 'low' },
  'GV70':                { body: 'suv-mid', size: 'L', age: ['30s','40s'],          usage: ['leisure','business'],         mileage: 'any' },
  'GV80':                { body: 'suv-large', size: 'XL', age: ['40s','50plus'],    usage: ['business','family'],          mileage: 'any' },
};

// 라이프스타일 → 적합 body 우선순위
const LIFESTYLE_BODY_FIT = {
  single: { compact: 1.0, sedan: 0.85, 'suv-mid': 0.8, 'suv-large': 0.4, minivan: 0.2, luxury: 0.6, truck: 0.3 },
  couple: { compact: 0.7, sedan: 0.95, 'suv-mid': 1.0, 'suv-large': 0.7, minivan: 0.4, luxury: 0.85, truck: 0.2 },
  family: { compact: 0.4, sedan: 0.7, 'suv-mid': 0.9, 'suv-large': 1.0, minivan: 0.95, luxury: 0.7, truck: 0.2 },
  large:  { compact: 0.1, sedan: 0.3, 'suv-mid': 0.4, 'suv-large': 0.9, minivan: 1.0, luxury: 0.4, truck: 0.3 },
};

// 성별 약한 가중치 (취향 차이만 미세 반영)
const GENDER_BIAS = {
  m: { 'luxury': 1.05, 'minivan': 1.03, 'suv-large': 1.03, 'truck': 1.05 },
  f: { 'compact': 1.05, 'suv-mid': 1.03 },
};

// === 입력 state ===
const age = ref('30s');
const gender = ref('m');
const lifestyle = ref('couple');
const usage = ref('commute');
const mileage = ref('mid');
const income = ref(400);
const submitted = ref(false);

const vehicles = ref([]);
onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
});

function calcMonthly(row, depPct) {
  try {
    const r = calcQuote({
      vehicle: row,
      options: { optPrice: 0, discount: 0, deliveryFee: DEFAULT_DELIVERY_FEE, itemsFee: DEFAULT_TINT_FEE, etc: 0 },
      contract: { term: 60, km: (mileage.value === 'low' ? '1만km' : mileage.value === 'high' ? '3만km' : '2만km'), dep: depPct, pre: 0 },
      customer: { creditGrade: '중신용' },
      insurance: {
        property: '1억', extraDriver: '없음',
        exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
        deductible: '30만원~', emergency: '가입',
      },
      fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
    });
    return r;
  } catch { return null; }
}

const budgetKrw = computed(() => Math.round((+income.value || 0) * 10000 * 0.33));

// 모델 별 최저가 row 한 개씩 추출 → 후보
const candidates = computed(() => {
  if (!vehicles.value.length) return [];
  const byModel = new Map();
  for (const v of vehicles.value) {
    if (!MODEL_META[v.model]) continue;  // 메타 없는 건 제외
    if (!byModel.has(v.model)) byModel.set(v.model, v);
    else if (v.price < byModel.get(v.model).price) byModel.set(v.model, v);
  }
  return Array.from(byModel.values());
});

// === 스코어링 ===
const scored = computed(() => {
  if (!submitted.value || !candidates.value.length) return [];
  const budget = budgetKrw.value;
  const lifestyleBodyMap = LIFESTYLE_BODY_FIT[lifestyle.value] || {};
  const genderBias = GENDER_BIAS[gender.value] || {};

  const arr = candidates.value.map(row => {
    const meta = MODEL_META[row.model];
    const r = calcMonthly(row, 10);
    if (!r) return null;
    const monthly = r.monthly;

    // 예산 적합도 (35% 가중)
    let budgetScore;
    if (monthly <= budget) budgetScore = 1.0;
    else if (monthly <= budget * 1.15) budgetScore = 0.7;
    else if (monthly <= budget * 1.30) budgetScore = 0.4;
    else budgetScore = 0.1;

    // 라이프스타일 매치 (25% 가중)
    const lifestyleScore = lifestyleBodyMap[meta.body] ?? 0.5;

    // 나이대 매치 (15%)
    const ageScore = meta.age.includes(age.value) ? 1.0 : 0.5;

    // 용도 매치 (15%)
    const usageScore = meta.usage.includes(usage.value) ? 1.0 : 0.55;

    // 주행거리 매치 (10%)
    let mileageScore = 1.0;
    if (meta.mileage === 'low' && mileage.value !== 'low') mileageScore = 0.7;
    if (meta.mileage === 'high' && mileage.value === 'low') mileageScore = 0.75;
    if (meta.mileage === 'any') mileageScore = 0.95;

    // 성별 미세 보정
    const genderBoost = genderBias[meta.body] || 1.0;

    const composite = (
      budgetScore   * 0.35 +
      lifestyleScore * 0.25 +
      ageScore      * 0.15 +
      usageScore    * 0.15 +
      mileageScore  * 0.10
    ) * genderBoost;

    const matchPct = Math.min(99, Math.round(composite * 100));

    return {
      row, meta, monthly, matchPct, composite,
      withinBudget: monthly <= budget,
      depAmt: r.depositAmt,
      residualPct: r.residualPct, residualAmt: r.residualAmt,
      details: {
        budgetScore, lifestyleScore, ageScore, usageScore, mileageScore,
      },
    };
  }).filter(Boolean);

  arr.sort((a, b) => b.composite - a.composite);
  return arr;
});

const topPick = computed(() => scored.value[0] || null);
const alternates = computed(() => scored.value.slice(1, 3));

// === 개인화 narrative ===
const personaTagline = computed(() => {
  const ageLabel = AGES.find(a => a.id === age.value)?.label || '';
  const lifestyleLabel = LIFESTYLES.find(l => l.id === lifestyle.value)?.label || '';
  const usageLabel = USAGES.find(u => u.id === usage.value)?.label || '';
  return `${ageLabel} · ${lifestyleLabel} · ${usageLabel} 위주`;
});
const personaSub = computed(() => {
  const inc = +income.value || 0;
  const mileageLabel = MILEAGES.find(m => m.id === mileage.value)?.label || '';
  return `월 소득 ${fmt(inc)}만원 · 주행 ${mileageLabel}`;
});

function pickNarrative(p) {
  if (!p) return '';
  const ageLabel = AGES.find(a => a.id === age.value)?.label || '';
  const lifestyleLabel = LIFESTYLES.find(l => l.id === lifestyle.value)?.label || '';
  const usageLabel = USAGES.find(u => u.id === usage.value)?.label || '';
  const meta = p.meta;
  const reasons = [];
  if (p.withinBudget) {
    reasons.push(`월 예산 ${fmt(budgetKrw.value)}원 안에 정확히 들어옵니다.`);
  } else {
    const over = p.monthly - budgetKrw.value;
    reasons.push(`예산보다 약 ${fmt(over)}원 높지만, 옵션 조정으로 맞출 수 있습니다.`);
  }
  if (meta.age.includes(age.value)) {
    reasons.push(`${ageLabel} 고객층에서 가장 많이 선택되는 차종입니다.`);
  }
  if (meta.usage.includes(usage.value)) {
    const usageDesc = {
      commute: '매일의 출퇴근에 부담 없는 사이즈와 연비',
      leisure: '주말 가족 여행에 충분한 적재 공간',
      business: '비즈니스 미팅·의전에 어울리는 정중한 디자인',
      hobby: '취미 활동·아웃도어에 활용도 높은 구성',
    }[usage.value];
    if (usageDesc) reasons.push(`${usageDesc}로 ${usageLabel} 용도에 최적화됐습니다.`);
  }
  return reasons;
}

function pickIcon(p) {
  if (!p) return 'ph-car-profile';
  const map = {
    compact: 'ph-car', sedan: 'ph-car-profile',
    'suv-mid': 'ph-jeep', 'suv-large': 'ph-jeep',
    minivan: 'ph-van', luxury: 'ph-car-profile', truck: 'ph-truck',
  };
  return map[p.meta.body] || 'ph-car-profile';
}

function submit() {
  submitted.value = true;
  // 결과로 자연스럽게 스크롤
  setTimeout(() => {
    document.querySelector('.ai-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}
function reset() { submitted.value = false; }

function slugify(model) {
  return (model || '')
    .toLowerCase()
    .replace(/디\s+올\s+뉴\s+/g, '')
    .replace(/더\s+뉴\s+/g, '')
    .replace(/hybrid/i, 'hev')
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '');
}
function goToGuide(p) {
  if (!p) return;
  // 차종 가이드 섹션 (앵커) — 추후 /guide/{slug} 전용 페이지로 확장 가능
  const slug = slugify(p.row.model);
  document.getElementById('guide-' + slug)?.scrollIntoView({ behavior: 'smooth' })
    || document.getElementById('lineup')?.scrollIntoView({ behavior: 'smooth' });
}

function goToContact(p) {
  if (!p) return;
  const params = new URLSearchParams({
    vehicle: `${p.row.brand} ${p.row.model}`,
    term: 60,
    monthly: p.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="ai">
    <div class="ai-wrap">
      <div class="ai-form">
        <div class="ai-form__eyebrow">
          <i class="ph ph-sparkle"></i> AI 차종 추천
        </div>
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
            <label class="ai-label">라이프스타일</label>
            <div class="ai-chips ai-chips--4">
              <button v-for="l in LIFESTYLES" :key="l.id"
                      class="ai-chip ai-chip--sm"
                      :class="{ 'is-active': lifestyle === l.id }"
                      @click="lifestyle = l.id; submitted = false">
                <span>{{ l.label }}</span>
                <small>{{ l.sub }}</small>
              </button>
            </div>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">주된 용도</label>
          <div class="ai-chips">
            <button v-for="u in USAGES" :key="u.id"
                    class="ai-chip"
                    :class="{ 'is-active': usage === u.id }"
                    @click="usage = u.id; submitted = false">
              <span>{{ u.label }}</span>
              <small>{{ u.sub }}</small>
            </button>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">주행거리</label>
          <div class="ai-chips ai-chips--3">
            <button v-for="m in MILEAGES" :key="m.id"
                    class="ai-chip"
                    :class="{ 'is-active': mileage === m.id }"
                    @click="mileage = m.id; submitted = false">
              <span>{{ m.label }}</span>
              <small>{{ m.sub }}</small>
            </button>
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
          <i class="ph ph-magic-wand"></i>
          <h4>당신만의 추천 차종</h4>
          <p>6가지 정보를 입력하면<br>딱 맞는 차종을 골라드립니다.</p>
        </div>

        <div v-else-if="!topPick" class="ai-result__empty">
          <i class="ph ph-warning-circle"></i>
          <h4>적합한 차종이 부족합니다</h4>
          <p>예산을 조정하거나 다른 조건을 시도해 보세요.</p>
        </div>

        <template v-else>
          <!-- 페르소나 요약 -->
          <div class="ai-persona">
            <i class="ph ph-user-circle"></i>
            <div>
              <div class="ai-persona__main">{{ personaTagline }}</div>
              <div class="ai-persona__sub">{{ personaSub }}</div>
            </div>
          </div>

          <!-- Top Pick (hero card) -->
          <div class="ai-hero">
            <div class="ai-hero__rank">
              <span class="ai-hero__rank-badge">BEST MATCH</span>
              <span class="ai-hero__match">{{ topPick.matchPct }}<small>%</small></span>
              <span class="ai-hero__match-label">매치</span>
            </div>
            <div class="ai-hero__visual">
              <img v-if="topPick.meta.image"
                   :src="topPick.meta.image"
                   :alt="topPick.row.model"
                   class="ai-hero__img"
                   @error="topPick.meta.image = null" />
              <i v-else :class="`ph ${pickIcon(topPick)} ai-hero__icon`"></i>
            </div>
            <div class="ai-hero__body">
              <div class="ai-hero__brand">{{ topPick.row.brand }}</div>
              <h3 class="ai-hero__model">{{ topPick.row.model }}</h3>
              <div class="ai-hero__trim">{{ topPick.row.trim }}</div>

              <ul class="ai-hero__reasons">
                <li v-for="(rsn, i) in pickNarrative(topPick)" :key="i">
                  <i class="ph ph-check-circle-fill"></i>
                  {{ rsn }}
                </li>
              </ul>

              <!-- 차종 썰 / 스토리 -->
              <div v-if="topPick.meta.story" class="ai-hero__story">
                <div class="ai-hero__story-label">
                  <i class="ph ph-book-open"></i> 이 차의 이야기
                </div>
                <p>{{ topPick.meta.story }}</p>
              </div>

              <div class="ai-hero__price">
                <div class="ai-hero__monthly">
                  <span class="ai-hero__monthly-num">{{ fmt(topPick.monthly) }}</span>
                  <small>원/월</small>
                </div>
                <div class="ai-hero__sub">
                  60개월 · 보증금 10% · 월 부담 {{ ((topPick.monthly / (income * 10000)) * 100).toFixed(0) }}%
                </div>
              </div>

              <div class="ai-hero__cta-row">
                <button class="ai-hero__cta ai-hero__cta--primary" @click="goToContact(topPick)">
                  <i class="ph ph-chat-circle-dots"></i> 상담 신청
                </button>
                <button class="ai-hero__cta ai-hero__cta--outline" @click="goToGuide(topPick)">
                  <i class="ph ph-book-open"></i> 상세보기
                </button>
              </div>
            </div>
          </div>

          <!-- Alternates -->
          <div class="ai-alt-title">
            <i class="ph ph-list-magnifying-glass"></i> 다음으로 추천드리는 차종
          </div>
          <div class="ai-alts">
            <div v-for="(alt, i) in alternates" :key="i" class="ai-alt">
              <div class="ai-alt__head">
                <div class="ai-alt__rank">No. {{ i + 2 }}</div>
                <div class="ai-alt__match">매치 {{ alt.matchPct }}%</div>
              </div>
              <div class="ai-alt__main">
                <div class="ai-alt__brand">{{ alt.row.brand }}</div>
                <div class="ai-alt__model">{{ alt.row.model }}</div>
                <div class="ai-alt__trim">{{ alt.row.trim }}</div>
              </div>
              <div class="ai-alt__bottom">
                <div class="ai-alt__monthly">{{ fmt(alt.monthly) }}<small>원/월</small></div>
                <div class="ai-alt__btns">
                  <button class="ai-alt__cta" @click="goToGuide(alt)" title="상세보기">
                    <i class="ph ph-book-open"></i>
                  </button>
                  <button class="ai-alt__cta ai-alt__cta--primary" @click="goToContact(alt)">
                    상담 <i class="ph ph-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button class="ai-result__again" @click="reset">
            <i class="ph ph-arrow-counter-clockwise"></i> 다시 추천 받기
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai { max-width: 1180px; margin: 0 auto; }

.ai-wrap {
  display: flex; flex-direction: column; gap: 20px;
  background: var(--bg);
  border-radius: 18px;
  padding: 28px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.06),
    0 4px 12px rgba(0,0,0,0.04);
  border: 1px solid var(--line);
}
@media (max-width: 980px) {
  .ai-wrap { padding: 22px; gap: 16px; }
}
.ai-form__eyebrow {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 5px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
  align-self: flex-start;
  margin-bottom: 4px;
}
.ai-form__eyebrow i { font-size: 12px; }

/* === 폼 === */
.ai-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.ai-row { display: grid; grid-template-columns: 0.7fr 1.5fr; gap: 12px; margin-bottom: 16px; }
.ai-row .ai-field { margin-bottom: 0; }
@media (max-width: 540px) {
  .ai-row { grid-template-columns: 1fr; gap: 16px; }
}

.ai-label {
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  letter-spacing: -0.01em;
}
.ai-hint { font-size: 10.5px; font-weight: 400; color: var(--ink-4); margin-left: 4px; }

.ai-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.ai-chips--2 { grid-template-columns: 1fr 1fr; }
.ai-chips--3 { grid-template-columns: repeat(3, 1fr); }
.ai-chips--4 { grid-template-columns: repeat(4, 1fr); }

.ai-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px 4px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: 8px;
  font-family: inherit;
  font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.01em;
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
.ai-chip--sm { padding: 9px 2px; font-size: 11.5px; }
.ai-chip--sm small { font-size: 9px; }

.ai-income {
  display: flex; align-items: center;
  border: 1.5px solid var(--line-2);
  border-radius: 8px;
  transition: border-color var(--t-fast);
}
.ai-income:focus-within { border-color: var(--brand); }
.ai-income__input {
  flex: 1; min-width: 0; height: 44px;
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
  padding: 8px 12px; border-radius: 6px;
  margin-top: 4px;
}
.ai-budget i { font-size: 13px; color: var(--brand); }
.ai-budget b { color: var(--ink-1); font-weight: 700; font-variant-numeric: tabular-nums; }

.ai-submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 50px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: 999px;
  font-family: inherit;
  font-size: 14.5px; font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  margin-top: 6px;
  transition: background var(--t-fast), transform var(--t-fast);
}
.ai-submit:hover { background: var(--brand-700); transform: translateY(-1px); }

/* === 결과 === */
.ai-result {
  background: var(--bg-soft);
  border-radius: 14px;
  padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
  min-height: 480px;
}
.ai-result__empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 60px 16px;
  color: var(--ink-3);
}
.ai-result__empty i {
  font-size: 52px; color: var(--brand);
  margin-bottom: 14px; opacity: 0.85;
}
.ai-result__empty h4 {
  margin: 0 0 8px; font-size: 18px; font-weight: 700;
  color: var(--ink-1); letter-spacing: -0.02em;
}
.ai-result__empty p { margin: 0; font-size: 13px; line-height: 1.7; }

/* 페르소나 요약 */
.ai-persona {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.ai-persona i {
  font-size: 28px; color: var(--brand);
}
.ai-persona__main {
  font-size: 13px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.01em;
}
.ai-persona__sub {
  font-size: 11px; color: var(--ink-4);
  margin-top: 1px;
}

/* === Top Pick Hero === */
.ai-hero {
  position: relative;
  background: linear-gradient(180deg, #fff 0%, var(--bg-soft) 100%);
  border: 2px solid var(--ink-1);
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  animation: ai-pop .4s ease-out both;
}
@keyframes ai-pop {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-hero__rank {
  display: flex; align-items: baseline; gap: 8px;
  padding: 12px 16px;
  background: var(--ink-1); color: #fff;
}
.ai-hero__rank-badge {
  background: var(--brand); color: #fff;
  padding: 3px 8px; border-radius: 999px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.4px;
  font-family: 'Inter', sans-serif;
}
.ai-hero__match {
  font-size: 22px; font-weight: 800;
  font-family: 'Inter', sans-serif;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
  letter-spacing: -0.02em;
}
.ai-hero__match small {
  font-size: 12px; font-weight: 600;
  margin-left: 1px; opacity: 0.7;
}
.ai-hero__match-label {
  font-size: 11px; font-weight: 500;
  opacity: 0.7;
}

.ai-hero__visual {
  width: 100%; aspect-ratio: 16/9;
  background: linear-gradient(135deg, #f0f1f5 0%, #e3e6ec 100%);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ai-hero__img {
  width: 94%; height: 94%;
  object-fit: contain;
  filter: drop-shadow(0 8px 14px rgba(0,0,0,0.18));
}
.ai-hero__icon {
  font-size: 90px; color: var(--ink-4); opacity: 0.5;
}

.ai-hero__body { padding: 20px 22px 22px; }
.ai-hero__brand {
  font-size: 11px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.3px;
}
.ai-hero__model {
  margin: 2px 0 4px;
  font-size: 22px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.03em; line-height: 1.2;
}
.ai-hero__trim {
  font-size: 12px; color: var(--ink-3);
  line-height: 1.4;
}

.ai-hero__reasons {
  margin: 14px 0 16px;
  padding: 14px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
  list-style: none;
  display: flex; flex-direction: column; gap: 7px;
}
.ai-hero__reasons li {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 12.5px; color: var(--ink-2); line-height: 1.55;
}
.ai-hero__reasons i {
  font-size: 14px; color: var(--brand);
  flex-shrink: 0; margin-top: 2px;
}

.ai-hero__price {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.ai-hero__monthly {
  display: inline-flex; align-items: baseline; gap: 2px;
  font-family: 'Inter', 'Pretendard Variable', sans-serif;
  font-variant-numeric: tabular-nums;
}
.ai-hero__monthly-num {
  font-size: 26px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.04em; line-height: 1;
}
.ai-hero__monthly small {
  font-size: 13px; color: var(--ink-3); font-weight: 500;
  margin-left: 1px;
}
.ai-hero__sub {
  font-size: 10.5px; color: var(--ink-4);
  text-align: right;
}

/* 차종 스토리/썰 */
.ai-hero__story {
  margin: 0 0 16px;
  padding: 14px 16px;
  background: var(--bg-soft);
  border-radius: 10px;
}
.ai-hero__story-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; color: var(--brand);
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.ai-hero__story-label i { font-size: 12px; }
.ai-hero__story p {
  margin: 0;
  font-size: 12.5px; color: var(--ink-2);
  line-height: 1.7; letter-spacing: -0.01em;
}

.ai-hero__cta-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.ai-hero__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px;
  border: 0; border-radius: 999px;
  font-family: inherit;
  font-size: 13px; font-weight: 700;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-hero__cta i { font-size: 15px; }
.ai-hero__cta--primary { background: var(--ink-1); color: #fff; }
.ai-hero__cta--primary:hover { background: var(--brand); }
.ai-hero__cta--outline {
  background: var(--bg); color: var(--ink-2);
  border: 1.5px solid var(--line-2);
}
.ai-hero__cta--outline:hover { border-color: var(--ink-1); color: var(--ink-1); }

/* === Alternates === */
.ai-alt-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: var(--ink-3);
  letter-spacing: -0.01em;
  margin-top: 4px;
}
.ai-alt-title i { font-size: 13px; }

.ai-alts {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
@media (max-width: 540px) {
  .ai-alts { grid-template-columns: 1fr; }
}

.ai-alt {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
  transition: border-color var(--t-fast), transform var(--t-fast);
  animation: ai-pop .4s ease-out both;
  animation-delay: 0.1s;
}
.ai-alt:hover { border-color: var(--ink-4); transform: translateY(-1px); }

.ai-alt__head {
  display: flex; align-items: center; justify-content: space-between;
}
.ai-alt__rank {
  font-size: 10.5px; font-weight: 700; color: var(--ink-4);
  letter-spacing: 0.3px;
  font-family: 'Inter', sans-serif;
}
.ai-alt__match {
  font-size: 10.5px; font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums;
}
.ai-alt__brand {
  font-size: 10px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.2px;
}
.ai-alt__model {
  font-size: 14px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.02em;
  margin-top: 1px;
}
.ai-alt__trim {
  font-size: 10.5px; color: var(--ink-4);
  margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ai-alt__bottom {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
.ai-alt__monthly {
  font-size: 13px; font-weight: 800; color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.ai-alt__monthly small {
  font-size: 9.5px; color: var(--ink-4); font-weight: 500;
  margin-left: 1px;
}
.ai-alt__btns { display: flex; gap: 4px; }
.ai-alt__cta {
  display: inline-flex; align-items: center; gap: 3px;
  background: transparent; color: var(--ink-2);
  border: 1px solid var(--line-2);
  border-radius: 999px;
  padding: 5px 10px;
  font-family: inherit; font-size: 10.5px; font-weight: 700;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-alt__cta:hover { border-color: var(--ink-1); color: var(--ink-1); }
.ai-alt__cta--primary { background: var(--ink-1); color: #fff; border-color: var(--ink-1); }
.ai-alt__cta--primary:hover { background: var(--brand); border-color: var(--brand); }
.ai-alt__cta i { font-size: 11px; }

.ai-result__again {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--ink-3);
  border: 1.5px solid var(--line-2);
  border-radius: 999px;
  padding: 10px 0;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ai-result__again:hover {
  background: var(--bg); color: var(--ink-1); border-color: var(--ink-4);
}
</style>
