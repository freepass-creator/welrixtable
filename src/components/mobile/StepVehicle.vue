<script setup>
import { computed, ref, onMounted } from 'vue';
import { vehicleState, quoteState } from '../../store.js';
import { POPULAR_BRAND, POPULAR_MODELS, sortByRank } from '../../data/popular-rankings.js';
import { guessColor } from '../../lib/format.js';

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
});

const BRAND_LOGOS = {
  hyundai:  'https://cdn.simpleicons.org/hyundai/002C5F',
  kia:      'https://cdn.simpleicons.org/kia/05141F',
  genesis:  '/genesis.svg',
};

const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));

// 내장 색상 — lookups.js 와 동일 (PC 와 일치) + swatch 자동 계산
const COLOR_INT = [
  { value: '블랙',   price: 0,      label: '블랙' },
  { value: '그레이', price: 0,      label: '그레이' },
  { value: '베이지', price: 0,      label: '베이지' },
  { value: '브라운', price: 0,      label: '브라운' },
  { value: '투톤',   price: 500000, label: '투톤' },
].map(c => ({ ...c, swatch: guessColor(c.value) }));

// SSOT — window.VEHICLE_DB (mobile.js 의 boot 가 wait 후 mount 하므로 set 되어있음)
const globalDB = computed(() => window.VEHICLE_DB);
const db = ref(window.VEHICLE_DB || null);
onMounted(() => { if (!db.value) db.value = window.VEHICLE_DB; });

// sub-step — vehicleState.subStep 에 저장 (MobileApp next() 와 통합)
const subStep = computed({
  get: () => vehicleState.subStep || 'brand',
  set: (v) => { vehicleState.subStep = v; },
});

// 제조사 — 판매량순
const brands = computed(() => {
  if (!db.value) return [];
  return sortByRank(db.value.manufacturers, (m) => m.manufacturer_name, POPULAR_BRAND);
});

const selectedBrand = computed(() => {
  if (!db.value || !vehicleState.manufacturer) return null;
  return db.value.manufacturers.find(m => m.manufacturer_id === vehicleState.manufacturer);
});

// 모델 — 인기순
const models = computed(() => {
  if (!selectedBrand.value) return [];
  return sortByRank(
    selectedBrand.value.models, (m) => m.model_name,
    POPULAR_MODELS[selectedBrand.value.manufacturer_name] || [],
  );
});

const selectedModel = computed(() => {
  if (!selectedBrand.value || !vehicleState.model) return null;
  return selectedBrand.value.models.find(m => m.model_id === vehicleState.model);
});

// 세부모델
const variants = computed(() => selectedModel.value?.variants || []);

const selectedVariant = computed(() => {
  if (!selectedModel.value || !vehicleState.variant) return null;
  return selectedModel.value.variants.find(v => v.variant_id === vehicleState.variant);
});

// 트림
const trims = computed(() => {
  if (!selectedVariant.value) return [];
  const taxRate = vehicleState.tax_rate || '5';
  return [...(selectedVariant.value.trims || [])]
    .filter(t => t.operating !== false)
    .sort((a, b) => trimPrice(a, taxRate) - trimPrice(b, taxRate));
});

const selectedTrim = computed(() => {
  if (!selectedVariant.value || !vehicleState.trim) return null;
  return selectedVariant.value.trims.find(t => t.trim_id === vehicleState.trim);
});

function trimPrice(t, taxRate) {
  return (taxRate === '3.5' ? t.base_price_3_5 : t.base_price_5) || 0;
}

// === 옵션 master / 배타 그룹 / 선행 요건 (PC 와 동일 로직) ===
const optionsMaster = computed(() => selectedVariant.value?.options_master || {});
const exclusiveGroups = computed(() => selectedVariant.value?.exclusive_groups || []);

function getGroup(optId) {
  return exclusiveGroups.value.find(g => g.members.includes(optId)) || null;
}
function isEnabled(optId) {
  const opt = optionsMaster.value[optId];
  if (!opt) return false;
  if (opt.requires && !opt.requires.every(req => vehicleState.options.has(req))) return false;
  if (opt.requires_in_trim?.[vehicleState.trim] &&
      !opt.requires_in_trim[vehicleState.trim].every(req => vehicleState.options.has(req))) return false;
  // option_excludes
  if (selectedVariant.value?.option_excludes) {
    for (const [parentId, excluded] of Object.entries(selectedVariant.value.option_excludes)) {
      if (vehicleState.options.has(parentId) && excluded.includes(optId)) return false;
    }
  }
  return true;
}
function getRequires(optId) {
  const opt = optionsMaster.value[optId];
  if (!opt) return [];
  return opt.requires || opt.requires_in_trim?.[vehicleState.trim] || [];
}

// trim 의 available_options
const availableOptions = computed(() => {
  if (!selectedTrim.value || !selectedTrim.value.available_options) return [];
  return selectedTrim.value.available_options
    .map(id => ({ id, ...(optionsMaster.value[id] || {}) }))
    .filter(o => o.name);
});

// 외장 색상 (model 레벨)
const exteriorColors = computed(() => selectedModel.value?.exterior_colors || []);

// 옵션 토글
function toggleOption(optId) {
  if (!isEnabled(optId) && !vehicleState.options.has(optId)) return;
  if (vehicleState.options.has(optId)) {
    vehicleState.options.delete(optId);
  } else {
    // 같은 배타 그룹 다른 옵션 자동 해제
    const g = getGroup(optId);
    if (g) g.members.forEach(m => { if (m !== optId) vehicleState.options.delete(m); });
    vehicleState.options.add(optId);
  }
  syncVehicle();
}

function pickExtColor(idx) {
  vehicleState.color = idx;
  syncVehicle();
}
function pickIntColor(c) {
  quoteState.cond.colorInt = c.value;
  quoteState.cond.colorIntPrice = c.price;
  syncVehicle();
}

// 가격 합산 — 트림 + 옵션 + 색상
const optionsPriceManwon = computed(() => {
  let p = 0;
  vehicleState.options.forEach(id => {
    const opt = optionsMaster.value[id];
    if (opt?.price) p += opt.price;
  });
  return p;
});
const totalManwon = computed(() => {
  if (!selectedTrim.value) return 0;
  const taxRate = vehicleState.tax_rate || '5';
  return trimPrice(selectedTrim.value, taxRate) + optionsPriceManwon.value;
});

// 현대차 재고 데이터에서 현재 트림 매칭 — col 14 (할인1) 평균값 자동 적용
function findStockDiscount() {
  if (!selectedBrand.value || !selectedModel.value || !selectedVariant.value || !selectedTrim.value) return 0;
  if (selectedBrand.value.manufacturer_name !== '현대') return 0;  // 재고 데이터는 현대만
  const stock = window.__welrix_stock || [];
  if (!stock.length) return 0;
  // 매칭 키워드 — model_name 의 base (변형 prefix 제거)
  const modelBase = selectedModel.value.model_name.replace(/^(더 뉴 |디 올 뉴 |디 )/, '').replace(/ Hybrid$/, '');
  const fuel = selectedVariant.value.fuel;
  const trimName = (selectedTrim.value.name || '').toLowerCase();
  const matches = stock.filter(r => {
    const m = (r[0] || '').replace(/﻿/g, '').trim();
    if (!m.includes(modelBase) && !modelBase.includes(m)) return false;
    if (fuel && !(r[1] || '').includes(fuel.replace(/\(.+\)/,''))) return false;
    // 트림명 단어 일부라도 매칭 (Premium / Exclusive 등)
    const detail = (r[2] || '').toLowerCase();
    return trimName && detail.includes(trimName);
  });
  if (!matches.length) return 0;
  // 할인 1 (col 14) 의 평균 (만원 단위)
  const discounts = matches.map(r => +String(r[14] || '0').replace(/,/g,'')).filter(n => n > 0);
  if (!discounts.length) return 0;
  return Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length);
}

function syncVehicle() {
  if (!selectedTrim.value) return;
  const t = selectedTrim.value;
  const taxRate = vehicleState.tax_rate || '5';
  const trimPriceManwon = trimPrice(t, taxRate);
  const colorExtName = (vehicleState.color != null && exteriorColors.value[vehicleState.color])
    ? exteriorColors.value[vehicleState.color].name : null;
  const optNames = [...vehicleState.options]
    .map(id => optionsMaster.value[id]?.name)
    .filter(Boolean);

  // vehicles.json 매칭 — 모델+연료 기반 (가격 매칭은 데이터 시점 차이로 불안정)
  const brandName = selectedBrand.value.manufacturer_name;
  const modelName = selectedModel.value.model_name;
  const fuelStr = selectedVariant.value?.fuel || '';
  const isHybrid = /하이브리드/.test(fuelStr);
  const targetModel = isHybrid ? modelName + ' Hybrid' : modelName;
  // 트림명 토큰 (예: "Premium" / "노블레스") 매칭
  const trimTokens = (t.name || '').split(/[\s·]/).filter(s => s.length >= 2);
  const vehicles = props.vehicles || [];
  let match = vehicles.find(v =>
    v.brand === brandName && v.model === targetModel &&
    trimTokens.every(tk => v.trim.toLowerCase().includes(tk.toLowerCase()))
  );
  // fallback 1 — brand + 정확 model 의 가장 가까운 가격
  if (!match) {
    const cands = vehicles.filter(v => v.brand === brandName && v.model === targetModel);
    if (cands.length) {
      const priceKrw = trimPriceManwon * 10000;
      match = cands.reduce((m, v) =>
        (!m || Math.abs(v.price - priceKrw) < Math.abs(m.price - priceKrw)) ? v : m, null);
    }
  }
  // fallback 2 — brand + model base 부분 매칭
  if (!match) {
    match = vehicles.find(v => v.brand === brandName && v.model.includes(modelName));
  }

  quoteState.vehicle = {
    brand: brandName,
    model: modelName,
    variant: selectedVariant.value?.variant_name || '',
    trim_name: t.name,
    total_manwon: totalManwon.value,
    trim_price_manwon: trimPriceManwon,
    options_price_manwon: optionsPriceManwon.value,
    options: optNames,
    colorExt: colorExtName,
    colorInt: quoteState.cond.colorInt || null,
    fuel: selectedVariant.value?.fuel,
    displacement_cc: selectedVariant.value?.displacement_cc || match?.disp,
    _src: match,
  };
}

function selectBrand(b) {
  vehicleState.manufacturer = b.manufacturer_id;
  vehicleState.model = null; vehicleState.variant = null; vehicleState.trim = null;
  vehicleState.options.clear(); vehicleState.color = null;
  quoteState.vehicle = null;
  subStep.value = 'model';
}
function selectModel(m) {
  vehicleState.model = m.model_id;
  vehicleState.variant = null; vehicleState.trim = null;
  vehicleState.options.clear(); vehicleState.color = null;
  quoteState.vehicle = null;
  if ((m.variants || []).length === 1) {
    vehicleState.variant = m.variants[0].variant_id;
    subStep.value = 'trim';
  } else {
    subStep.value = 'variant';
  }
}
function selectVariant(v) {
  vehicleState.variant = v.variant_id;
  vehicleState.trim = null;
  vehicleState.options.clear(); vehicleState.color = null;
  quoteState.vehicle = null;
  subStep.value = 'trim';
}
function selectTrim(t) {
  vehicleState.trim = t.trim_id;
  vehicleState.options.clear();
  if (vehicleState.color == null && exteriorColors.value.length) {
    vehicleState.color = 0;
  }
  // 재고차 자동 할인 — 현대차이고 매칭되는 재고가 있으면 할인 적용
  const stockDc = findStockDiscount();
  if (stockDc > 0) quoteState.cond.discount = stockDc;
  syncVehicle();
}

function goBack(target) { subStep.value = target; }
</script>

<template>
  <div class="sv">
    <!-- breadcrumb — 텍스트만 결합 -->
    <div class="sv-crumbs" v-if="selectedBrand">
      <button class="sv-crumb" @click="goBack('brand')">
        <img v-if="BRAND_LOGOS[selectedBrand.manufacturer_id]" :src="BRAND_LOGOS[selectedBrand.manufacturer_id]" />
        <span>{{ selectedBrand.manufacturer_name }}</span>
      </button>
      <button v-if="selectedModel" class="sv-crumb" @click="goBack('model')">{{ selectedModel.model_name }}</button>
      <button v-if="selectedVariant" class="sv-crumb" @click="goBack('variant')">{{ selectedVariant.variant_name }}</button>
      <button v-if="selectedTrim" class="sv-crumb" @click="goBack('trim')">{{ selectedTrim.name }}</button>
    </div>

    <!-- 1) 제조사 -->
    <div v-if="subStep === 'brand'" class="sv-section">
      <h2 class="sv-title">어떤 제조사를<br>선택할까요?</h2>
      <div v-if="!db" class="sv-debug">
        차량 DB 로드 중... (window.VEHICLE_DB: {{ typeof globalDB }})
      </div>
      <div v-else-if="!brands.length" class="sv-debug">
        제조사 0개 — manufacturers: {{ (db.manufacturers || []).length }}
      </div>
      <div class="sv-brand-grid">
        <button
          v-for="b in brands" :key="b.manufacturer_id"
          class="sv-brand-card"
          :class="{ 'is-selected': vehicleState.manufacturer === b.manufacturer_id }"
          @click="selectBrand(b)"
        >
          <img v-if="BRAND_LOGOS[b.manufacturer_id]" :src="BRAND_LOGOS[b.manufacturer_id]" :alt="b.manufacturer_name" />
          <span class="sv-brand-card__name">{{ b.manufacturer_name }}</span>
        </button>
      </div>
    </div>

    <!-- 2) 모델 -->
    <div v-else-if="subStep === 'model'" class="sv-section">
      <h2 class="sv-title">{{ selectedBrand.manufacturer_name }} 에서<br>어떤 모델로 갈까요?</h2>
      <div class="sv-list">
        <button
          v-for="m in models" :key="m.model_id"
          class="sv-row"
          :class="{ 'is-selected': vehicleState.model === m.model_id }"
          @click="selectModel(m)"
        >
          <span class="sv-row__label">{{ m.model_name }}</span>
          <i class="ph ph-caret-right sv-row__chev"></i>
        </button>
      </div>
    </div>

    <!-- 3) 세부모델 -->
    <div v-else-if="subStep === 'variant'" class="sv-section">
      <h2 class="sv-title">{{ selectedModel.model_name }}<br>세부 모델을 골라주세요</h2>
      <div class="sv-list">
        <button
          v-for="v in variants" :key="v.variant_id"
          class="sv-row"
          :class="{ 'is-selected': vehicleState.variant === v.variant_id }"
          @click="selectVariant(v)"
        >
          <span class="sv-row__label">{{ v.variant_name }}</span>
          <i class="ph ph-caret-right sv-row__chev"></i>
        </button>
      </div>
    </div>

    <!-- 4) 트림 -->
    <div v-else-if="subStep === 'trim'" class="sv-section">
      <h2 class="sv-title">{{ selectedVariant?.variant_name }}<br>트림을 골라주세요</h2>
      <div class="sv-list">
        <button
          v-for="t in trims" :key="t.trim_id"
          class="sv-trim-card"
          :class="{ 'is-selected': vehicleState.trim === t.trim_id }"
          @click="selectTrim(t)"
        >
          <div class="sv-trim-card__top">
            <span class="sv-trim-card__name">{{ t.name }}</span>
            <i class="ph ph-check sv-trim-card__check" v-if="vehicleState.trim === t.trim_id"></i>
          </div>
          <div class="sv-trim-card__price">{{ fmt(trimPrice(t, vehicleState.tax_rate || '5') * 10000) }}원</div>
        </button>
      </div>

      <!-- 트림 선택 후 — 할인 input + 가격 카드 즉시 표시 -->
      <div v-if="selectedTrim" class="sv-block" style="margin-top:20px;">
        <div class="sv-block__label">
          추가 할인 <span class="sv-block__hint">재고차 자동 적용</span>
          <span v-if="quoteState.cond.discount" class="sv-block__val">−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-discount">
          <input
            type="number" min="0" step="10" inputmode="numeric"
            v-model.number="quoteState.cond.discount"
            placeholder="0"
            class="sv-discount__input"
          />
          <span class="sv-discount__unit">만원</span>
        </div>
      </div>
      <div v-if="selectedTrim" class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="quoteState.cond.discount">
          <span>할인</span>
          <span>−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt((trimPrice(selectedTrim, vehicleState.tax_rate || '5') - (quoteState.cond.discount || 0)) * 10000) }}원</span>
        </div>
      </div>
    </div>

    <!-- 5) 옵션 -->
    <div v-else-if="subStep === 'options'" class="sv-section">
      <h2 class="sv-title">옵션을<br>선택해 주세요</h2>

      <div v-if="!availableOptions.length" class="sv-empty">선택 가능한 옵션이 없습니다.</div>
      <div v-else class="sv-opts">
        <button
          v-for="o in availableOptions" :key="o.id"
          class="sv-opt"
          :class="{
            'is-selected': vehicleState.options.has(o.id),
            'is-disabled': !isEnabled(o.id) && !vehicleState.options.has(o.id),
          }"
          @click="toggleOption(o.id)"
        >
          <div class="sv-opt__top">
            <span class="sv-opt__name">{{ o.name }}</span>
            <span class="sv-opt__price">+{{ fmt(o.price) }}만</span>
          </div>
          <div class="sv-opt__sub" v-if="o.sub">{{ o.sub }}</div>
          <div class="sv-opt__group" v-if="getGroup(o.id)">
            <i class="ph ph-info"></i>
            {{ getGroup(o.id).label }} 중 1개만 선택
          </div>
          <div class="sv-opt__req" v-if="!isEnabled(o.id) && !vehicleState.options.has(o.id) && getRequires(o.id).length">
            <i class="ph ph-warning"></i>
            선행: {{ getRequires(o.id).map(r => optionsMaster[r]?.name).filter(Boolean).join(', ') }}
          </div>
        </button>
      </div>

      <div class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="optionsPriceManwon">
          <span>옵션</span>
          <span>+{{ fmt(optionsPriceManwon) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt(totalManwon * 10000) }}원</span>
        </div>
      </div>
    </div>

    <!-- 6) 색상 (외장 + 내장) -->
    <div v-else-if="subStep === 'colors'" class="sv-section">
      <h2 class="sv-title">색상을<br>골라주세요</h2>

      <!-- 외장 색상 -->
      <div v-if="exteriorColors.length" class="sv-block">
        <div class="sv-block__label">
          외장 색상
          <span class="sv-block__hint">{{ exteriorColors[vehicleState.color]?.name || '미선택' }}</span>
        </div>
        <div class="sv-color-grid">
          <button
            v-for="(c, i) in exteriorColors" :key="i"
            class="sv-color-card"
            :class="{ 'is-selected': vehicleState.color === i }"
            :title="c.name"
            @click="pickExtColor(i)"
          >
            <span class="sv-color-swatch" :style="{ background: c.hex }"></span>
            <span class="sv-color-name">{{ c.name }}</span>
            <span class="sv-color-price" v-if="c.price">+{{ fmt(c.price * 10000) }}원</span>
            <i class="ph ph-check sv-color-check" v-if="vehicleState.color === i"></i>
          </button>
        </div>
      </div>

      <!-- 내장 색상 -->
      <div class="sv-block">
        <div class="sv-block__label">
          내장 색상
          <span class="sv-block__hint">{{ quoteState.cond.colorInt || '미선택' }}</span>
        </div>
        <div class="sv-color-grid">
          <button
            v-for="c in COLOR_INT" :key="c.value"
            class="sv-color-card"
            :class="{ 'is-selected': quoteState.cond.colorInt === c.value }"
            @click="pickIntColor(c)"
          >
            <span class="sv-color-swatch" :style="{ background: c.swatch }"></span>
            <span class="sv-color-name">{{ c.label }}</span>
            <span class="sv-color-price" v-if="c.price">+{{ fmt(c.price) }}원</span>
            <i class="ph ph-check sv-color-check" v-if="quoteState.cond.colorInt === c.value"></i>
          </button>
        </div>
      </div>

      <!-- 추가 할인 — 재고차/특별조건 -->
      <div class="sv-block">
        <div class="sv-block__label">
          추가 할인
          <span v-if="quoteState.cond.discount" class="sv-block__val">−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-discount">
          <input
            type="number" min="0" step="10" inputmode="numeric"
            v-model.number="quoteState.cond.discount"
            placeholder="0"
            class="sv-discount__input"
          />
          <span class="sv-discount__unit">만원</span>
        </div>
      </div>

      <!-- 최종 차량가격 (할인 반영) -->
      <div class="sv-total">
        <div class="sv-total__row">
          <span>트림</span>
          <span>{{ fmt(trimPrice(selectedTrim, vehicleState.tax_rate || '5')) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="optionsPriceManwon">
          <span>옵션</span>
          <span>+{{ fmt(optionsPriceManwon) }}만원</span>
        </div>
        <div class="sv-total__row" v-if="quoteState.cond.discount">
          <span>할인</span>
          <span>−{{ fmt(quoteState.cond.discount) }}만원</span>
        </div>
        <div class="sv-total__row sv-total__row--total">
          <span>총 차량가격</span>
          <span>{{ fmt((totalManwon - (quoteState.cond.discount || 0)) * 10000) }}원</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sv { padding-top: 4px; }
.sv-title {
  font-size: 22px; font-weight: 700;
  color: var(--ink-1); margin: 0 0 24px;
  line-height: 1.35; letter-spacing: -0.5px;
}

/* breadcrumb */
.sv-crumbs {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-bottom: 18px;
}
.sv-crumb {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0; border: 0; background: transparent;
  color: var(--ink-2); font-weight: var(--fw-medium);
  font-family: inherit; font-size: var(--fs-sm);
  cursor: pointer;
  letter-spacing: -0.2px;
}
.sv-crumb img { width: 14px; height: 14px; }
.sv-crumb:active { color: var(--brand); }

/* 제조사 카드 */
.sv-brand-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.sv-brand-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 22px 8px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 14px;
  font-family: inherit; cursor: pointer;
  transition: transform .12s, border-color .12s, background .12s;
}
.sv-brand-card img { width: 38px; height: 38px; object-fit: contain; }
.sv-brand-card img[src*="genesis"] { width: auto; height: 18px; max-width: 70px; }
.sv-brand-card__name { font-size: 13.5px; font-weight: 600; color: var(--ink-1); }
.sv-brand-card:active { transform: scale(0.97); }
.sv-brand-card.is-selected { border-color: var(--brand); background: var(--brand-50); }

.sv-debug {
  padding: 12px 14px;
  background: #fff8e1;
  border: 1px solid #f4d35e;
  border-radius: 8px;
  font-size: 12px; color: #936916;
  margin-bottom: 12px;
}

/* 리스트 */
.sv-list { display: flex; flex-direction: column; gap: 8px; }
.sv-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 16px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-family: inherit; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.sv-row__label { font-size: 16px; font-weight: 500; color: var(--ink-1); letter-spacing: -0.3px; }
.sv-row__chev { font-size: 18px; color: var(--ink-4); }
.sv-row:active { background: var(--brand-50); }
.sv-row.is-selected { border-color: var(--brand); background: var(--brand-50); }

/* 트림 카드 */
.sv-trim-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 12px;
  text-align: left;
  font-family: inherit; cursor: pointer;
}
.sv-trim-card__top { display: flex; align-items: center; justify-content: space-between; }
.sv-trim-card__name { font-size: 15px; font-weight: 600; color: var(--ink-1); letter-spacing: -0.3px; }
.sv-trim-card__check { font-size: 20px; color: var(--brand); font-weight: 700; }
.sv-trim-card__price {
  font-size: 15px; font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums;
}
.sv-trim-card:active { background: var(--brand-50); }
.sv-trim-card.is-selected { border-color: var(--brand); background: var(--brand-50); }

/* 옵션·색상 sub-step */
.sv-block { margin-bottom: 22px; }
.sv-block__label {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--ink-2);
  margin-bottom: 10px; letter-spacing: -0.2px;
}
.sv-block__hint { font-size: 11.5px; color: var(--ink-3); font-weight: 400; }
.sv-block__val {
  font-size: 13px; color: var(--brand); font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* 색상 grid — 외장/내장 공통 (swatch + 이름 + 가격) */
.sv-color-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.sv-color-card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-family: inherit; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.sv-color-swatch {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.12);
  box-shadow: inset 0 0 0 2px #fff;
}
.sv-color-card.is-selected .sv-color-swatch {
  box-shadow: inset 0 0 0 2px #fff, 0 0 0 2px var(--brand);
}
.sv-color-name {
  font-size: 11.5px; color: var(--ink-2); text-align: center;
  line-height: 1.2; word-break: keep-all;
}
.sv-color-card.is-selected .sv-color-name { color: var(--brand); font-weight: 600; }
.sv-color-price {
  font-size: 10px; color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.sv-color-card.is-selected { border-color: var(--brand); background: var(--brand-50); }
.sv-color-check {
  position: absolute; top: 6px; right: 8px;
  font-size: 14px; color: var(--brand); font-weight: 700;
}

.sv-empty {
  padding: 18px; text-align: center;
  background: var(--bg-soft);
  border-radius: 10px;
  color: var(--ink-4); font-size: 13px;
}

/* 할인 입력 */
.sv-discount {
  display: flex; align-items: center; gap: 6px;
  height: 46px;
  padding: 0 14px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: var(--r-chip);
}
.sv-discount:focus-within { border-color: var(--brand); }
.sv-discount__input {
  flex: 1; min-width: 0;
  height: 100%;
  border: 0; background: transparent;
  font-family: inherit; font-size: 15px;
  color: var(--ink-1);
  outline: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
}
.sv-discount__input::-webkit-outer-spin-button,
.sv-discount__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.sv-discount__unit { font-size: 13px; color: var(--ink-4); font-weight: 500; }
.sv-block__val { font-size: 13px; color: var(--brand); font-weight: 700; font-variant-numeric: tabular-nums; }

/* 옵션 카드 */
.sv-opts { display: flex; flex-direction: column; gap: 8px; }
.sv-opt {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  background: var(--bg-soft);
  border: 1.5px solid transparent;
  border-radius: 10px;
  text-align: left;
  font-family: inherit; cursor: pointer;
  transition: background .12s, border-color .12s, opacity .12s;
}
.sv-opt__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.sv-opt__name { font-size: 14px; font-weight: 600; color: var(--ink-1); }
.sv-opt__price {
  font-size: 13px; font-weight: 700; color: var(--brand);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.sv-opt__sub { font-size: 11.5px; color: var(--ink-3); line-height: 1.4; }
.sv-opt__group {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; color: var(--ink-4); margin-top: 2px;
}
.sv-opt__group i { font-size: 12px; }
.sv-opt__req {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; color: #c62828; margin-top: 2px;
}
.sv-opt:active { background: var(--brand-50); }
.sv-opt.is-selected {
  border-color: var(--brand); background: var(--brand-50);
}
.sv-opt.is-disabled {
  opacity: 0.55; cursor: not-allowed;
}

/* 가격 합산 카드 */
.sv-total {
  margin-top: 28px;
  padding: 14px 16px;
  background: var(--brand-50);
  border-radius: 12px;
}
.sv-total__row {
  display: flex; justify-content: space-between;
  font-size: 13px; color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  padding: 3px 0;
}
.sv-total__row--total {
  border-top: 1px solid rgba(13,78,139,0.2);
  margin-top: 6px; padding-top: 8px;
  font-size: 15px; color: var(--brand); font-weight: 700;
}
</style>
