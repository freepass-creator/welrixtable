<script setup>
// 히어로 우측 — BEST 1 차종 큰 카드
// "월 N만원" 으로 증명: 우리 상품이 얼마인지 1초에 보여줌
// 캐스퍼 (가장 저렴 → 진입 장벽 낮은 흥미) 디폴트
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../../lib/calc.js';
import { fmt } from '../../lib/format.js';
import { MODEL_SLUG, imageOf } from '../../lib/slug.js';

// 회전 후보 (3초마다 자동 변경 가능 — 일단 정적 표시)
const FEATURED = {
  brand: '현대',
  model: '더 뉴 캐스퍼',
  tagline: '입문 SUV · 가성비 BEST',
  story: '1.0 터보 + 4단 자동변속기. 도심 출퇴근에 부담없는 경형 SUV.',
};

const vehicles = ref([]);
onMounted(async () => {
  try {
    const r = await fetch('/data/vehicles.json?t=' + Date.now());
    vehicles.value = await r.json();
  } catch {}
});

const card = computed(() => {
  const slug = MODEL_SLUG[FEATURED.model];
  const image = imageOf(slug);
  const candidates = vehicles.value.filter(v => v.brand === FEATURED.brand && v.model === FEATURED.model);
  if (!candidates.length) return { ...FEATURED, slug, image, monthly: null, price: null };
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
    return { ...FEATURED, slug, image, monthly: r.monthly, price: cheapest.price };
  } catch {
    return { ...FEATURED, slug, image, monthly: null, price: cheapest?.price };
  }
});

function goGuide() {
  if (card.value.slug) location.href = `/guide.html?slug=${card.value.slug}`;
}
function goContact() {
  const params = new URLSearchParams({
    vehicle: `${card.value.brand} ${card.value.model}`,
    term: 60,
    monthly: card.value.monthly || '',
  });
  history.replaceState(null, '', '#contact?' + params.toString());
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="hb">
    <div class="hb__tag">
      <i class="ph ph-fire"></i> 지금 가장 가성비 좋은 신차
    </div>

    <div class="hb__visual">
      <img v-if="card.image" :src="card.image" :alt="card.model" class="hb__img"
           @error="card.image = null" />
      <i v-else class="ph ph-car-profile hb__icon"></i>
    </div>

    <div class="hb__body">
      <div class="hb__brand">{{ card.brand }}</div>
      <div class="hb__model">{{ card.model }}</div>
      <div class="hb__tagline">{{ card.tagline }}</div>

      <div class="hb__price">
        <div class="hb__price-label">월 부담은</div>
        <div class="hb__price-amount">
          <span class="hb__price-num">{{ card.monthly ? fmt(card.monthly) : '—' }}</span>
          <small>원~</small>
        </div>
        <div class="hb__price-meta">
          60개월 · 보증금 10% · 보험·세금 포함
        </div>
      </div>

      <div class="hb__actions">
        <button class="hb__btn hb__btn--primary" @click="goContact">
          <i class="ph ph-chat-circle-dots"></i> 이 차로 상담
        </button>
        <button class="hb__btn hb__btn--ghost" @click="goGuide">
          <i class="ph ph-book-open"></i> 상세보기
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hb {
  background: var(--bg);
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow:
    0 20px 50px rgba(0,0,0,0.07),
    0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid var(--line);
  position: relative;
  overflow: hidden;
}
@media (max-width: 540px) {
  .hb { padding: 18px; border-radius: 14px; }
}

.hb__tag {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  padding: 6px 14px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.2px;
  margin-bottom: 12px;
}
.hb__tag i { font-size: 12px; }

.hb__visual {
  width: 100%; aspect-ratio: 16/9;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  margin-bottom: 14px;
}
.hb__img {
  width: 100%; height: 100%; object-fit: contain;
  filter: drop-shadow(0 10px 14px rgba(0,0,0,0.12));
}
.hb__icon { font-size: 64px; color: var(--ink-4); opacity: 0.4; }

.hb__body { display: flex; flex-direction: column; gap: 4px; }
.hb__brand {
  font-size: 11.5px; color: var(--ink-4); font-weight: 700;
  letter-spacing: 0.4px;
}
.hb__model {
  font-size: 22px; font-weight: 800; color: var(--ink-1);
  letter-spacing: -0.025em; line-height: 1.2;
}
.hb__tagline {
  font-size: 12px; color: var(--ink-3); font-weight: 500;
  margin-top: 2px;
}

.hb__price {
  margin: 14px 0;
  padding: 16px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
  text-align: center;
}
.hb__price-label {
  font-size: 11px; color: var(--ink-4); font-weight: 600;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}
.hb__price-amount {
  display: inline-flex; align-items: baseline; gap: 2px;
  font-family: 'Inter', 'Pretendard Variable', sans-serif;
  font-variant-numeric: tabular-nums;
}
.hb__price-num {
  font-size: 38px; font-weight: 800; color: var(--brand);
  letter-spacing: -0.05em; line-height: 1;
}
.hb__price-amount small {
  font-size: 15px; color: var(--ink-3); font-weight: 600;
  margin-left: 1px;
}
.hb__price-meta {
  margin-top: 5px;
  font-size: 11px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}

.hb__actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.hb__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 44px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 13px; font-weight: 700;
  cursor: pointer;
  letter-spacing: -0.01em;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.hb__btn i { font-size: 14px; }
.hb__btn--primary {
  background: var(--ink-1); color: #fff; border: 0;
}
.hb__btn--primary:hover { background: var(--brand); }
.hb__btn--ghost {
  background: var(--bg); color: var(--ink-2);
  border: 1.5px solid var(--line-2);
}
.hb__btn--ghost:hover { border-color: var(--ink-1); color: var(--ink-1); }
</style>
