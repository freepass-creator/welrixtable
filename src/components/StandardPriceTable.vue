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
const selectedBrand = ref('현대');   // 카스케이드: 제조사
const selectedModel = ref('');       // 카스케이드: 모델 (빈값 = 전체)
const loading = ref(false);
const errorMsg = ref('');

async function loadVehicles() {
  if (vehicles.value.length) return;
  loading.value = true;
  try {
    const r = await fetch('./data/vehicles.json?t=' + Date.now());
    const data = await r.json();
    vehicles.value = data;
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

// 브랜드 별 모델 목록 (드롭다운용) — 중복 제거, 등장 순서 유지
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

// 필터된 행 (제조사 + 모델). 모델 비어있으면 브랜드 전체.
const filteredRows = computed(() => {
  return vehicles.value
    .map((v, idx) => ({ idx, ...v }))
    .filter(v => v.brand === selectedBrand.value)
    .filter(v => !selectedModel.value || v.model === selectedModel.value);
});

// 표준 견적 계산
const computedRows = computed(() => {
  return filteredRows.value.map(v => {
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

function selectBrand(b) {
  selectedBrand.value = b;
  selectedModel.value = '';  // 브랜드 바꾸면 모델 리셋
}

function buildHtmlForCurrentView() {
  const rows = computedRows.value;
  if (!rows.length) return '';
  const titleSuffix = selectedModel.value || '전체';
  return buildPrintHtml(`${selectedBrand.value} — ${titleSuffix}`, rows);
}

function downloadPdf() {
  const html = buildHtmlForCurrentView();
  if (!html) { alert('표시된 차량이 없습니다'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단됐어요. 브라우저 팝업 차단 해제 후 다시 시도'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => setTimeout(() => win.print(), 100));
}

// 미리보기 — 새 탭으로 print HTML 만 표시 (자동 인쇄 안 함)
function openPreview() {
  const html = buildHtmlForCurrentView();
  if (!html) { alert('표시된 차량이 없습니다'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단됐어요'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// 이미지 복사 — html2canvas 로 캡쳐 → clipboard
const copyingImage = ref(false);
async function copyAsImage() {
  if (copyingImage.value) return;
  const html = buildHtmlForCurrentView();
  if (!html) { alert('표시된 차량이 없습니다'); return; }
  if (!window.html2canvas) { alert('이미지 캡쳐 라이브러리 로드 실패'); return; }
  copyingImage.value = true;
  try {
    // 오프스크린에 렌더 후 캡쳐
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed; left:-9999px; top:0; width:297mm; background:#fff;';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    // 인쇄용 HTML 안의 body 컨테이너 캡쳐 (html2canvas 는 body 노드 직접 못 받음)
    const target = wrap.querySelector('body') || wrap.firstElementChild;
    const canvas = await window.html2canvas(target, { scale: 2, backgroundColor: '#fff', useCORS: true });
    document.body.removeChild(wrap);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('이미지 복사 완료 — 카톡·메일에 붙여넣기 하세요');
    } else {
      // fallback — 다운로드
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `welrix-price-${selectedBrand.value}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (e) {
    alert('이미지 복사 실패: ' + (e?.message || e));
  } finally {
    copyingImage.value = false;
  }
}

// 제조사 공식 가격표 PDF (public/manufacturer-pdfs/{slug}.pdf)
const MFR_PDF_SLUG = { '현대': 'hyundai', '기아': 'kia', '제네시스': 'genesis' };
function openManufacturerPdf() {
  const slug = MFR_PDF_SLUG[selectedBrand.value];
  if (!slug) return;
  // 새 탭에서 열기 — 파일이 없으면 404, 사용자가 public/manufacturer-pdfs/{slug}.pdf 추가
  window.open(`/manufacturer-pdfs/${slug}.pdf`, '_blank');
}

function buildPrintHtml(brand, rows) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR');
  const cards = rows.map(r => `
    <article class="card">
      <header class="card-h">
        <div class="brand">${escape(r.brand)}</div>
        <div class="model">${escape(r.model)}</div>
        <div class="trim">${escape(r.trim)}</div>
      </header>
      <div class="price">
        <span class="lbl">차량가</span>
        <span class="val">${fmt(r.price)}<small>원</small></span>
      </div>
      <div class="terms">
        ${r.monthlies.map((m, i) => `
          <div class="term">
            <div class="t-lbl">${STANDARD_TERMS[i]}개월</div>
            <div class="t-val">${m != null ? fmt(m) : '—'}<small>원/월</small></div>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>웰릭스 표준 견적 — ${escape(brand)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
         color: #0a0a0a; margin: 0; padding: 0; font-size: 11px;
         font-variant-numeric: tabular-nums; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-end;
         padding-bottom: 10px; border-bottom: 2px solid #0D4E8B; margin-bottom: 14px; }
  .hdr h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #0D4E8B; }
  .hdr .sub { font-size: 12px; color: #737373; margin-top: 4px; }
  .hdr .meta { font-size: 10px; color: #737373; text-align: right; line-height: 1.5; }
  .cond { font-size: 10px; color: #737373; margin-bottom: 14px; padding: 6px 10px;
          background: #f5f5f5; border-radius: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { border: 1px solid #d4d4d4; border-radius: 6px; padding: 12px 14px;
          break-inside: avoid; page-break-inside: avoid;
          display: flex; flex-direction: column; gap: 8px; }
  .card-h .brand { font-size: 9.5px; color: #737373; font-weight: 500;
                   letter-spacing: 0.4px; }
  .card-h .model { font-size: 14px; font-weight: 700; color: #0a0a0a;
                   letter-spacing: -0.2px; margin-top: 2px; }
  .card-h .trim { font-size: 11px; color: #404040; margin-top: 1px; }
  .card .price { display: flex; align-items: baseline; justify-content: space-between;
                 padding: 6px 0; border-top: 1px dashed #e5e5e5;
                 border-bottom: 1px dashed #e5e5e5; }
  .card .price .lbl { font-size: 10px; color: #737373; }
  .card .price .val { font-size: 13px; font-weight: 600; }
  .card .price .val small { font-size: 9px; color: #737373; font-weight: 400; margin-left: 2px; }
  .card .terms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .card .term { background: #eef4fa; border-radius: 4px; padding: 7px 8px; text-align: center; }
  .card .term .t-lbl { font-size: 9.5px; color: #737373; font-weight: 500;
                       letter-spacing: 0.3px; }
  .card .term .t-val { font-size: 12.5px; font-weight: 700; color: #0D4E8B;
                       margin-top: 2px; letter-spacing: -0.3px; }
  .card .term .t-val small { font-size: 8.5px; color: #737373; font-weight: 400;
                             margin-left: 1px; }
  .ftr { margin-top: 14px; font-size: 9px; color: #a3a3a3; text-align: center;
         border-top: 1px solid #f0f0f0; padding-top: 8px; }
</style></head>
<body>
  <div class="hdr">
    <div>
      <h1>웰릭스 표준 견적</h1>
      <div class="sub">${escape(brand)}</div>
    </div>
    <div class="meta">
      ${dateStr}<br>웰릭스 모빌리티
    </div>
  </div>
  <div class="cond">
    ※ 표준 조건: 중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 자동차보험 대물 1억 · 정비 웰스 Basic
  </div>
  <div class="grid">${cards}</div>
  <div class="ftr">전 가격은 부가세 포함, 실제 출고 시 변경 가능 · 표준 견적 자료, 손님 발송 견적과 별도</div>
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
          <i class="ph ph-file-text"></i>
          웰릭스 표준 견적
        </h3>
        <button class="spt-close" @click="closePanel" aria-label="닫기">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="spt-body">
        <div class="spt-controls">
          <!-- 카스케이드: 제조사 탭 + 모델 드롭다운 -->
          <div class="spt-tabs">
            <button
              v-for="b in BRANDS" :key="b"
              class="spt-tab"
              :class="{ 'is-active': selectedBrand === b }"
              @click="selectBrand(b)"
            >{{ b }}</button>
          </div>
          <select
            class="spt-model-dd"
            v-model="selectedModel"
            :disabled="!modelsInBrand.length"
          >
            <option value="">전체 모델</option>
            <option v-for="m in modelsInBrand" :key="m" :value="m">{{ m }}</option>
          </select>
          <div class="spt-actions">
            <span class="spt-count">{{ computedRows.length }}건</span>
            <button class="spt-act" :disabled="!computedRows.length" @click="openPreview" title="새 탭에서 미리보기">
              <i class="ph ph-eye"></i>미리보기
            </button>
            <button class="spt-act" :disabled="!computedRows.length || copyingImage" @click="copyAsImage" title="이미지로 복사 (카톡 붙여넣기)">
              <i class="ph" :class="copyingImage ? 'ph-spinner' : 'ph-clipboard'"></i>이미지 복사
            </button>
            <button class="spt-act spt-act--primary" :disabled="!computedRows.length" @click="downloadPdf" title="PDF 다운로드 (브라우저 인쇄→PDF)">
              <i class="ph ph-file-pdf"></i>PDF
            </button>
            <button class="spt-act" @click="openManufacturerPdf" title="제조사 공식 가격표 PDF 열기">
              <i class="ph ph-file-arrow-down"></i>공식 가격표
            </button>
          </div>
        </div>

        <div class="spt-cond-hint">
          ※ 표준 조건: <b>중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억 · 웰스 Basic</b>
        </div>

        <div v-if="loading" class="spt-loading">차량 데이터 로드 중…</div>
        <div v-else-if="errorMsg" class="spt-error">{{ errorMsg }}</div>
        <div v-else-if="!computedRows.length" class="spt-empty">표시할 차종이 없습니다</div>
        <!-- 세로 카드 — 견적서 형태. 각 트림 1장 -->
        <div v-else class="spt-cards" ref="cardsContainer">
          <article
            v-for="r in computedRows" :key="r.idx"
            class="spt-card"
          >
            <header class="spt-card__head">
              <div class="spt-card__brand">{{ r.brand }}</div>
              <div class="spt-card__model">{{ r.model }}</div>
              <div class="spt-card__trim">{{ r.trim }}</div>
            </header>
            <div class="spt-card__price">
              <span class="spt-card__price-label">차량가</span>
              <span class="spt-card__price-val">{{ fmt(r.price) }}<small>원</small></span>
            </div>
            <div class="spt-card__terms">
              <div v-for="(m, i) in r.monthlies" :key="i" class="spt-card__term">
                <div class="spt-card__term-label">{{ [36,48,60][i] }}개월</div>
                <div class="spt-card__term-monthly">
                  {{ m != null ? fmt(m) : '—' }}<small>원/월</small>
                </div>
              </div>
            </div>
            <div class="spt-card__cond">
              ※ 중신용 · 보증금 10% · 선납 0% · 약정 2만km/년 · 보험 대물 1억 · 웰스 Basic
            </div>
          </article>
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
.spt-model-dd {
  appearance: none; -webkit-appearance: none;
  border: 1px solid var(--line-2); background: var(--bg);
  font-family: inherit; font-size: 12px; color: var(--ink-1);
  padding: 6px 28px 6px 10px; border-radius: var(--radius-sm);
  cursor: pointer; min-width: 180px; max-width: 280px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23737373' stroke-width='1.5' stroke-linecap='round'><polyline points='3 5 6 8 9 5'/></svg>");
  background-repeat: no-repeat; background-position: right 8px center; background-size: 10px 10px;
  outline: none;
  transition: border-color var(--t-fast);
}
.spt-model-dd:hover { border-color: var(--ink-4); }
.spt-model-dd:focus { border-color: var(--ink-1); }
.spt-model-dd:disabled { opacity: 0.5; cursor: not-allowed; }
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
.spt-act {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--bg); color: var(--ink-2);
  border: 1px solid var(--line-2); border-radius: var(--radius-sm);
  padding: 6px 10px; font-family: inherit;
  font-size: 11.5px; font-weight: 500; cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.spt-act i { font-size: 13px; }
.spt-act:hover:not(:disabled) {
  background: var(--bg-soft); color: var(--ink-1); border-color: var(--ink-4);
}
.spt-act:disabled { opacity: 0.4; cursor: not-allowed; }
.spt-act--primary {
  background: var(--brand); color: #fff; border-color: var(--brand);
}
.spt-act--primary:hover:not(:disabled) {
  background: var(--brand-700); color: #fff; border-color: var(--brand-700);
}

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

/* === 세로 카드 그리드 === */
.spt-cards {
  flex: 1; min-height: 0; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 4px;
  font-variant-numeric: tabular-nums;
}
.spt-card {
  background: var(--bg);
  border: 1px solid var(--line-2); border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
  transition: border-color var(--t-fast);
}
.spt-card:hover { border-color: var(--ink-4); }

.spt-card__head { display: flex; flex-direction: column; gap: 1px; }
.spt-card__brand {
  font-size: 10px; color: var(--ink-4); font-weight: 500;
  letter-spacing: 0.4px;
}
.spt-card__model {
  font-size: 14px; font-weight: 700; color: var(--ink-1);
  letter-spacing: -0.2px;
}
.spt-card__trim {
  font-size: 11px; color: var(--ink-2);
  letter-spacing: -0.1px;
}

.spt-card__price {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
}
.spt-card__price-label { font-size: 10.5px; color: var(--ink-4); }
.spt-card__price-val {
  font-size: 13px; font-weight: 600; color: var(--ink-1);
}
.spt-card__price-val small {
  font-size: 9.5px; color: var(--ink-4); font-weight: 400; margin-left: 2px;
}

.spt-card__terms {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
.spt-card__term {
  background: var(--brand-50);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  text-align: center;
}
.spt-card__term-label {
  font-size: 10px; color: var(--ink-3); font-weight: 500;
  letter-spacing: 0.3px;
}
.spt-card__term-monthly {
  font-size: 13px; font-weight: 700; color: var(--brand);
  margin-top: 2px; letter-spacing: -0.3px;
}
.spt-card__term-monthly small {
  font-size: 9px; color: var(--ink-4); font-weight: 400; margin-left: 1px;
}

.spt-card__cond {
  font-size: 9.5px; color: var(--ink-4);
  letter-spacing: -0.1px;
}
</style>
