<script setup>
/* ── 견적 페이지 — 마지막 걸음 ────────────────────────────────────────────
 * ★대표 2026-09-18 「옵션 고르기 전까지는 하단에 견적 보여주지 말고, 견적도 별도 페이지로 보이게」
 *   고른 차·옵션·조건을 한 장에 모으고, 기간별 월 렌트료를 크게 보인다.
 *   숫자는 하단 금액바와 «같은 곳»(견적상태 = 웰릭스 계산)에서 읽는다 — 따로 계산하지 않는다.
 */
import { computed } from 'vue';
import { quoteState } from '../../store.js';
import { 견적상태 } from '../../lib/quote/index.js';
import { 담당자인가 } from '../../lib/role.js';
import { fmt } from '../../lib/format.js';

const 담당자 = 담당자인가();
const v = computed(() => quoteState.vehicle || {});
const c = computed(() => quoteState.cond || {});

const 계산중 = computed(() => 견적상태.상태 === 'pending');
const 계산못함 = computed(() => 견적상태.상태 === 'error');

const 기간들 = computed(() => {
  const r = 견적상태.결과 || [];
  return (quoteState.scenarios || []).map((sc, i) => ({
    term: sc.term,
    monthly: r[i]?.월대여료 ?? null,
    인수가: r[i]?.인수가 ?? null,
  }));
});

/* 총 차량가 — 웰릭스가 준 값(차값+옵션+색)을 먼저, 없으면 화면이 센 값 */
const 총차량가 = computed(() =>
  (견적상태.결과 || []).find((g) => g?.총차량가)?.총차량가 ?? ((v.value.total_manwon || 0) * 10000));

const 신용글 = computed(() => (담당자 ? (c.value.credit || '중신용') : '신용점수 무관'));
const 조건들 = computed(() => [
  ['신용', 신용글.value],
  ['약정주행', `연 ${c.value.km ?? 2}만km`],
  ['정비', c.value.svc || '웰스 Basic'],
  ['탁송', c.value.deliveryCity || '서울'],
  ['썬팅', quoteState.tint?.product || '없음'],
  ['블랙박스', quoteState.extras?.blackbox || '미설치'],
  ...(담당자 ? [
    ['보증금', `${c.value.dep ?? 0}%`],
    ['선납금', `${c.value.pre ?? 0}%`],
    ['수수료', `${c.value.feeRatePct ?? 0}%`],
  ] : []),
]);
</script>

<template>
  <div class="sr">
    <h2 class="sr-title">월 렌트료 견적</h2>

    <!-- 고른 차 -->
    <section class="sr-car">
      <div class="sr-car__name">{{ v.brand }} {{ v.model }}</div>
      <div class="sr-car__trim">{{ [v.variant, v.trim_name].filter(Boolean).join(' · ') }}</div>
      <ul v-if="(v.options || []).length" class="sr-car__opts">
        <li v-for="o in v.options" :key="o">{{ o }}</li>
      </ul>
      <div v-if="v.colorExt || v.colorInt" class="sr-car__color">
        {{ [v.colorExt && `외장 ${v.colorExt}`, v.colorInt && `내장 ${v.colorInt}`].filter(Boolean).join(' · ') }}
      </div>
      <div class="sr-car__total">
        <span>총 차량가격</span><b>{{ fmt(총차량가) }}원</b>
      </div>
    </section>

    <!-- 기간별 월 렌트료 -->
    <section class="sr-terms" :aria-busy="계산중">
      <div v-for="t in 기간들" :key="t.term" class="sr-term">
        <div class="sr-term__left">
          <div class="sr-term__label">{{ t.term }}개월</div>
          <div v-if="t.인수가" class="sr-term__sub">만기 인수가 {{ fmt(t.인수가) }}원</div>
        </div>
        <div class="sr-term__monthly">
          <template v-if="t.monthly">월 <b>{{ fmt(t.monthly) }}</b>원</template>
          <span v-else class="sr-muted">{{ 계산중 ? '계산 중…' : '—' }}</span>
        </div>
      </div>
      <p v-if="계산못함" class="sr-error">지금 계산할 수 없습니다. 잠시 뒤 다시 열거나 상담으로 문의해 주세요.</p>
    </section>

    <!-- 조건 -->
    <section class="sr-cond">
      <div v-for="[k, val] in 조건들" :key="k" class="sr-cond__row">
        <span>{{ k }}</span><span>{{ val }}</span>
      </div>
    </section>

    <p class="sr-note">
      VAT 포함 금액입니다. 심사 결과에 따라 달라질 수 있으며, 정확한 조건은 상담으로 안내드립니다.
    </p>
  </div>
</template>

<style scoped>
.sr-title {
  font-size: var(--fs-2xl); font-weight: var(--fw-bold);
  color: var(--ink-1); margin: 0 0 18px;
  line-height: 1.35; letter-spacing: -0.5px;
}

.sr-car {
  padding: 16px; margin-bottom: 12px;
  background: var(--bg-soft); border-radius: 12px;
}
.sr-car__name { font-size: 18px; font-weight: 700; color: var(--ink-1); letter-spacing: -0.4px; }
.sr-car__trim { margin-top: 2px; font-size: 14px; color: var(--ink-2); }
.sr-car__opts {
  margin: 10px 0 0; padding: 0; list-style: none;
  display: flex; flex-wrap: wrap; gap: 4px 6px;
}
.sr-car__opts li {
  font-size: 12px; color: var(--ink-2);
  padding: 3px 8px; background: var(--bg); border-radius: 6px;
}
.sr-car__color { margin-top: 8px; font-size: 12.5px; color: var(--ink-3); }
.sr-car__total {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);
  font-size: 13px; color: var(--ink-3);
}
.sr-car__total b { font-size: 16px; color: var(--ink-1); font-variant-numeric: tabular-nums; }

.sr-terms { display: grid; gap: 8px; margin-bottom: 12px; }
.sr-term {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px; background: var(--brand-50); border-radius: 12px;
}
.sr-term__label { font-size: 15px; font-weight: 700; color: var(--ink-1); }
.sr-term__sub { margin-top: 2px; font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.sr-term__monthly { font-size: 13px; color: var(--ink-2); white-space: nowrap; }
.sr-term__monthly b {
  font-size: 22px; font-weight: 700; color: var(--brand);
  letter-spacing: -0.5px; font-variant-numeric: tabular-nums;
}
.sr-muted { color: var(--ink-4); }
.sr-error { margin: 4px 0 0; font-size: 13px; color: #c62828; }

.sr-cond { padding: 4px 16px; background: var(--bg-soft); border-radius: 12px; }
.sr-cond__row {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 10px 0; font-size: 13.5px;
}
.sr-cond__row + .sr-cond__row { border-top: 1px solid var(--line); }
.sr-cond__row span:first-child { color: var(--ink-3); }
.sr-cond__row span:last-child { color: var(--ink-1); font-weight: 600; text-align: right; }

.sr-note { margin: 12px 2px 0; font-size: 12px; color: var(--ink-4); line-height: 1.55; }
</style>
