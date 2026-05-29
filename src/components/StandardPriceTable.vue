<script setup>
// 웰릭스 표준 가격표 — 제조사별 전 차종 × 36/48/60 월 대여료
// 표준 조건: 중신용 / 보증금 10% / 선납 0% / 2만km / 자동차보험 1억 기본
// 선택된 행만 PDF (브라우저 인쇄→PDF 저장) 로 출력
import { ref, computed, onMounted } from 'vue';
import { calcQuote } from '../lib/calc.js';
import { fmt } from '../lib/format.js';

const BRANDS = ['현대', '기아', '제네시스'];
const STANDARD_TERMS = [36, 48, 60];
const STD = {
  credit: '중신용',
  km: '2만km',
  dep: 10,
  pre: 0,
  insProperty: '1억',
  extraDriver: '없음',
  feeRatePct: 5.0,
  svc: '웰스 Basic',
};

const open = ref(false);
const vehicles = ref([]);
const selectedBrand = ref('현대');
const checked = ref(new Set());
const loading = ref(false);
const errorMsg = ref('');

async function loadVehicles() {
  if (vehicles.value.length) return;
  loading.value = true;
  try {
    const r = await fetch('./data/vehicles.json?t=' + Date.now());
    const data = await r.json();
    vehicles.value = data;
    // 디폴트: 현재 브랜드 전체 체크
    data.forEach((v, i) => { if (v.brand === selectedBrand.value) checked.value.add(i); });
  } catch (e) {
    errorMsg.value = '차량 데이터 로드 실패: ' + (e?.message || e);
  } finally {
    loading.value = false;
  }
}

function openPanel() {
  open.value = true;
  loadVehicles();
}
function closePanel() { open.value = false; }

// 상단바 버튼이 외부에서 열도록
if (typeof window !== 'undefined') {
  window.__welrix_openStandardPriceTable = openPanel;
}

// 현재 브랜드 행
const brandRows = computed(() =>
  vehicles.value
    .map((v, idx) => ({ idx, ...v }))
    .filter(v => v.brand === selectedBrand.value)
);

// 행별 표준 견적 계산
const computedRows = computed(() => {
  return brandRows.value.map(v => {
    const monthlies = STANDARD_TERMS.map(term => {
      try {
        const r = calcQuote({
          vehicle: v,
          options: { optPrice: 0, discount: 0, deliveryFee: 0, itemsFee: 0, etc: 0 },
          contract: { term, km: STD.km, dep: STD.dep, pre: STD.pre },
          customer: { creditGrade: STD.credit },
          insurance: {
            property: STD.insProperty, extraDriver: STD.extraDriver,
            exec: '미가입', injury: '무한', self: '1억', uninsured: '2억',
            deductible: '30만원~', emergency: '가입',
          },
          fees: { feeRatePct: STD.feeRatePct, svc: STD.svc },
        });
        return r.monthly;
      } catch { return null; }
    });
    return { ...v, monthlies };
  });
});

function isChecked(idx) { return checked.value.has(idx); }
function toggleRow(idx) {
  if (checked.value.has(idx)) checked.value.delete(idx);
  else checked.value.add(idx);
  // reactivity
  checked.value = new Set(checked.value);
}
function selectAll() { brandRows.value.forEach(r => checked.value.add(r.idx)); checked.value = new Set(checked.value); }
function deselectAll() { brandRows.value.forEach(r => checked.value.delete(r.idx)); checked.value = new Set(checked.value); }

const allSelected = computed(() => brandRows.value.length > 0 && brandRows.value.every(r => checked.value.has(r.idx)));
const selectedCountInBrand = computed(() => brandRows.value.filter(r => checked.value.has(r.idx)).length);

function selectBrand(b) {
  selectedBrand.value = b;
  // 디폴트: 새 브랜드 전체 체크 (현재 비어있을 때만)
  const currentBrandRows = vehicles.value.filter(v => v.brand === b);
  const anyChecked = currentBrandRows.some((v, i) => {
    const realIdx = vehicles.value.indexOf(v);
    return checked.value.has(realIdx);
  });
  if (!anyChecked) {
    vehicles.value.forEach((v, i) => { if (v.brand === b) checked.value.add(i); });
    checked.value = new Set(checked.value);
  }
}

function downloadPdf() {
  const selected = computedRows.value.filter(r => checked.value.has(r.idx));
  if (!selected.length) { alert('선택된 차량이 없습니다'); return; }
  const html = buildPrintHtml(selectedBrand.value, selected);
  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단됐어요. 브라우저 팝업 차단 해제 후 다시 시도'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // 인쇄 다이얼로그 자동 호출 — 사용자가 'PDF 저장' 선택
  win.addEventListener('load', () => setTimeout(() => win.print(), 100));
}

function buildPrintHtml(brand, rows) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR');
  const tbody = rows.map(r => `
    <tr>
      <td>${escape(r.model)}</td>
      <td class="trim">${escape(r.trim)}</td>
      <td class="num">${fmt(r.price)}</td>
      ${r.monthlies.map(m => `<td class="num mono">${m != null ? fmt(m) : '—'}</td>`).join('')}
    </tr>
  `).join('');
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>웰릭스 표준 가격표 — ${escape(brand)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
         color: #0a0a0a; margin: 0; padding: 0; font-size: 11px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-end;
         padding-bottom: 8px; border-bottom: 1.5px solid #0a0a0a; margin-bottom: 12px; }
  .hdr h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .hdr .meta { font-size: 10px; color: #737373; text-align: right; line-height: 1.5; }
  .cond { font-size: 10px; color: #737373; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f5f5f5; color: #0a0a0a; font-weight: 600;
             padding: 6px 8px; text-align: left; border-bottom: 1px solid #d4d4d4;
             font-size: 10px; letter-spacing: 0.2px; }
  thead th.num { text-align: right; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0;
             font-size: 10.5px; vertical-align: middle; }
  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.mono { font-weight: 600; color: #0D4E8B; }
  tbody td.trim { color: #404040; }
  .ftr { margin-top: 12px; font-size: 9px; color: #a3a3a3; text-align: center;
         border-top: 1px solid #f0f0f0; padding-top: 6px; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
  <div class="hdr">
    <h1>웰릭스 표준 가격표 — ${escape(brand)}</h1>
    <div class="meta">
      ${dateStr}<br>웰릭스 모빌리티
    </div>
  </div>
  <div class="cond">
    ※ 표준 조건: 중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 자동차보험 대물 1억 · 정비 웰스 Basic
  </div>
  <table>
    <thead>
      <tr>
        <th>모델</th>
        <th>트림</th>
        <th class="num">차량가</th>
        ${STANDARD_TERMS.map(t => `<th class="num">${t}개월 월대여료</th>`).join('')}
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
  </table>
  <div class="ftr">전 가격은 부가세 포함, 실제 출고 시 변경 가능</div>
</body></html>`;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
</script>

<template>
  <div v-if="open" class="spt-backdrop" @click.self="closePanel">
    <div class="spt-panel">
      <div class="spt-head">
        <h3>
          <i class="ph ph-list"></i>
          웰릭스 표준 가격표
        </h3>
        <button class="spt-close" @click="closePanel" aria-label="닫기">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="spt-body">
        <div class="spt-controls">
          <div class="spt-tabs">
            <button
              v-for="b in BRANDS" :key="b"
              class="spt-tab"
              :class="{ 'is-active': selectedBrand === b }"
              @click="selectBrand(b)"
            >{{ b }}</button>
          </div>
          <div class="spt-actions">
            <button class="spt-mini" @click="allSelected ? deselectAll() : selectAll()">
              {{ allSelected ? '전체 해제' : '전체 선택' }}
            </button>
            <span class="spt-count">{{ selectedCountInBrand }} / {{ brandRows.length }}건</span>
            <button class="spt-download" :disabled="selectedCountInBrand === 0" @click="downloadPdf">
              <i class="ph ph-file-pdf"></i> PDF 다운로드
            </button>
          </div>
        </div>

        <div class="spt-cond-hint">
          ※ 표준 조건: <b>중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억 · 웰스 Basic</b>
        </div>

        <div v-if="loading" class="spt-loading">차량 데이터 로드 중…</div>
        <div v-else-if="errorMsg" class="spt-error">{{ errorMsg }}</div>
        <div v-else-if="!brandRows.length" class="spt-empty">{{ selectedBrand }} 차종 없음</div>
        <div v-else class="spt-table-wrap">
          <table class="spt-table">
            <thead>
              <tr>
                <th class="spt-table__chk"></th>
                <th>모델</th>
                <th>트림</th>
                <th class="spt-table__num">차량가</th>
                <th class="spt-table__num">36개월</th>
                <th class="spt-table__num">48개월</th>
                <th class="spt-table__num">60개월</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in computedRows" :key="r.idx"
                :class="{ 'is-checked': isChecked(r.idx) }"
                @click="toggleRow(r.idx)"
              >
                <td class="spt-table__chk">
                  <input type="checkbox" :checked="isChecked(r.idx)" @click.stop="toggleRow(r.idx)" />
                </td>
                <td>{{ r.model }}</td>
                <td class="spt-table__trim">{{ r.trim }}</td>
                <td class="spt-table__num">{{ fmt(r.price) }}</td>
                <td v-for="(m, i) in r.monthlies" :key="i" class="spt-table__num spt-table__mono">
                  {{ m != null ? fmt(m) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 모달 = backdrop + panel === */
.spt-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  animation: spt-fade .15s ease-out;
}
@keyframes spt-fade { from { opacity: 0; } to { opacity: 1; } }

.spt-panel {
  background: var(--bg); border-radius: var(--radius-lg);
  width: 92vw; max-width: 1200px;
  max-height: 88vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.spt-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line-2);
  background: var(--bg-soft);
}
.spt-head h3 {
  margin: 0; font-size: 14px; font-weight: 600; color: var(--ink-1);
  display: flex; align-items: center; gap: 8px;
  letter-spacing: -0.2px;
}
.spt-head h3 i { font-size: 16px; color: var(--ink-3); }
.spt-close {
  background: transparent; border: 0;
  width: 28px; height: 28px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--ink-3); font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.spt-close:hover { background: var(--accent-soft); color: var(--ink-1); }

.spt-body { padding: 14px 20px 20px; flex: 1; min-height: 0; display: flex; flex-direction: column; }

.spt-controls {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 0; flex-wrap: wrap;
}
.spt-tabs { display: flex; gap: 4px; }
.spt-tab {
  border: 1px solid var(--line-2);
  background: var(--bg); color: var(--ink-2);
  padding: 6px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.spt-tab:hover { background: var(--bg-soft); }
.spt-tab.is-active {
  background: var(--ink-1); color: #fff; border-color: var(--ink-1);
}

.spt-actions { display: flex; align-items: center; gap: 8px; }
.spt-mini {
  border: 0; background: transparent; color: var(--ink-3);
  font-family: inherit; font-size: 11px; cursor: pointer;
  padding: 4px 8px; border-radius: var(--radius-sm);
}
.spt-mini:hover { background: var(--bg-soft); color: var(--ink-1); }
.spt-count { font-size: 11px; color: var(--ink-4); font-variant-numeric: tabular-nums; }
.spt-download {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--brand); color: #fff;
  border: 0; border-radius: var(--radius-sm);
  padding: 7px 12px; font-family: inherit;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background var(--t-fast);
}
.spt-download:hover:not(:disabled) { background: var(--brand-700); }
.spt-download:disabled { opacity: 0.4; cursor: not-allowed; }
.spt-download i { font-size: 14px; }

.spt-cond-hint {
  font-size: 11px; color: var(--ink-4);
  background: var(--bg-soft);
  padding: 8px 12px; border-radius: var(--radius-sm);
  margin-bottom: 10px;
}
.spt-cond-hint b { color: var(--ink-2); font-weight: 500; }

.spt-loading, .spt-error, .spt-empty {
  text-align: center; padding: 32px 16px;
  color: var(--ink-3); font-size: 12px;
}

.spt-table-wrap {
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  flex: 1; min-height: 0; overflow-y: auto;
}
.spt-table {
  width: 100%; border-collapse: collapse;
  font-size: 11.5px; font-variant-numeric: tabular-nums;
}
.spt-table thead th {
  position: sticky; top: 0; z-index: 1;
  background: var(--bg-soft); color: var(--ink-1);
  padding: 8px 10px; text-align: left;
  font-weight: 600; font-size: 11px;
  border-bottom: 1px solid var(--line-2);
  letter-spacing: 0.2px;
}
.spt-table thead th.spt-table__num { text-align: right; }
.spt-table thead th.spt-table__chk { width: 32px; padding: 8px 4px; }
.spt-table tbody td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}
.spt-table tbody tr { cursor: pointer; transition: background var(--t-fast); }
.spt-table tbody tr:hover { background: var(--bg-soft); }
.spt-table tbody tr.is-checked { background: var(--brand-50); }
.spt-table__chk { text-align: center; }
.spt-table__chk input { width: 14px; height: 14px; accent-color: var(--brand); cursor: pointer; }
.spt-table__num { text-align: right; }
.spt-table__mono { font-weight: 600; color: var(--brand); }
.spt-table__trim { color: var(--ink-3); font-size: 11px; }
</style>
