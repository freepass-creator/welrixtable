<script setup>
// 인기 차종 카드 (hana-car / kbrentcardirect 스타일) — 4종 추천
// 표준 조건(중신용/보증금10%/선납0%/2만km/60개월)으로 월대여료 즉시 계산
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';

// 4종 picks — 보편적 베스트셀러
const PICKS = [
  { brand: '현대', model: '더 뉴 캐스퍼', tagline: '경형 SUV 베스트', desc: '도심형 가성비 베스트셀러' },
  { brand: '현대', model: '디 올 뉴 팰리세이드', tagline: '대형 SUV 인기', desc: '가족용 풀옵션 7/9인승' },
  { brand: '기아', model: '카니발', tagline: '미니밴 No.1', desc: '9인승 패밀리·VIP 영업용' },
  { brand: '제네시스', model: '디 올 뉴 G80 RG3', tagline: '럭셔리 세단', desc: '비즈니스·임원 의전' },
];

const vehicles = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
  loading.value = false;
});

// 각 pick — vehicles.json 에서 가장 저렴한 트림 1개 잡고 60개월 표준 견적
const cards = computed(() => {
  return PICKS.map(pick => {
    // pick.model 매칭 — Hybrid 접미사 무시하고 베이스 모델 매칭
    const candidates = vehicles.value
      .filter(v => v.brand === pick.brand)
      .filter(v => v.model === pick.model || v.model === pick.model + ' Hybrid')
      // 가솔린 우선 (Hybrid 제외) — 인기 트림 = 가솔린 베이스
      .filter(v => v.model === pick.model);
    if (!candidates.length) return { ...pick, monthly: null, price: null };
    const cheapest = candidates.reduce((m, c) => (!m || c.price < m.price) ? c : m, null);
    try {
      const r = calcQuote({
        vehicle: cheapest,
        options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
        contract: { term: 60, km: '2만km', dep: 10, pre: 0 },
        customer: { creditGrade: '중신용' },
        insurance: {
          property: '1억', extraDriver: '없음',
          exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
          deductible: '30만원~', emergency: '가입',
        },
        fees: { feeRatePct: 5.0, svc: '웰스 Basic' },
      });
      return { ...pick, monthly: r.monthly, price: cheapest.price, trim: cheapest.trim };
    } catch {
      return { ...pick, monthly: null, price: cheapest.price, trim: cheapest.trim };
    }
  });
});

function goToContact(card) {
  const params = new URLSearchParams({
    vehicle: `${card.brand} ${card.model}`,
    term: 60,
    monthly: card.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

function goToQuote(card) {
  // 추후: 견적 위젯에 사전 선택 hook 가능. 일단 quote 섹션 스크롤
  document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="lu">
    <div class="lu-grid">
      <div
        v-for="(c, i) in cards" :key="i"
        class="lu-card"
      >
        <div class="lu-card__top">
          <span class="lu-card__badge">{{ c.tagline }}</span>
          <div class="lu-card__brand">{{ c.brand }}</div>
          <div class="lu-card__model">{{ c.model }}</div>
          <div class="lu-card__desc">{{ c.desc }}</div>
        </div>

        <div class="lu-card__price">
          <div class="lu-card__price-label">60개월 월 대여료부터</div>
          <div class="lu-card__monthly">
            <template v-if="c.monthly">
              <span class="lu-card__monthly-num">{{ fmt(c.monthly) }}</span>
              <small>원/월</small>
            </template>
            <template v-else>—</template>
          </div>
          <div class="lu-card__sub" v-if="c.price">
            차량가 {{ fmt(c.price) }}원~
          </div>
        </div>

        <div class="lu-card__actions">
          <button class="lu-card__btn lu-card__btn--ghost" @click="goToQuote(c)">
            <i class="ph ph-calculator"></i> 견적 더 보기
          </button>
          <button class="lu-card__btn lu-card__btn--primary" @click="goToContact(c)">
            <i class="ph ph-chat-circle-dots"></i> 상담 신청
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lu { max-width: 1180px; margin: 0 auto; }

.lu-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
@media (max-width: 1024px) {
  .lu-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .lu-grid { grid-template-columns: 1fr; }
}

.lu-card {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 24px 22px;
  display: flex; flex-direction: column; gap: 20px;
  transition: border-color var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
}
.lu-card:hover {
  border-color: var(--ink-4);
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.lu-card__top { display: flex; flex-direction: column; gap: 6px; }
.lu-card__badge {
  align-self: flex-start;
  font-size: 10.5px; font-weight: 600; color: var(--brand);
  background: var(--brand-50);
  padding: 3px 10px; border-radius: var(--radius-pill);
  letter-spacing: 0.2px;
  margin-bottom: 4px;
}
.lu-card__brand {
  font-size: 11px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.3px;
}
.lu-card__model {
  font-size: 18px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.3px; line-height: 1.25;
}
.lu-card__desc {
  font-size: 12.5px; color: var(--ink-3);
  line-height: 1.55;
}

.lu-card__price {
  padding: 14px 0;
  border-top: 1px dashed var(--line-2);
  border-bottom: 1px dashed var(--line-2);
}
.lu-card__price-label {
  font-size: 11px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.2px; margin-bottom: 4px;
}
.lu-card__monthly {
  display: flex; align-items: baseline; gap: 2px;
  font-variant-numeric: tabular-nums;
}
.lu-card__monthly-num {
  font-size: 24px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.04em;
}
.lu-card__monthly small {
  font-size: 12px; color: var(--ink-4); font-weight: 400;
  margin-left: 3px;
}
.lu-card__sub {
  margin-top: 4px;
  font-size: 11px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}

.lu-card__actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.lu-card__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 40px;
  border: 1.5px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  border-radius: var(--radius-pill);
  font-family: inherit;
  font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.lu-card__btn i { font-size: 14px; }
.lu-card__btn--ghost:hover {
  border-color: var(--ink-4); color: var(--ink-1);
}
.lu-card__btn--primary {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}
.lu-card__btn--primary:hover {
  background: var(--brand); border-color: var(--brand);
}
</style>
