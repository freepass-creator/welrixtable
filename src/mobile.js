// 모바일 전용 entry — index.js 와 분리된 별도 번들
// 기존 store/calc/firebase 는 재사용, UI 만 모바일 전용 컴포넌트로 새로 작성
import { createApp } from 'vue';
import MobileApp from './components/mobile/MobileApp.vue';
import { setCompanyConfig } from './lib/calc.js';
import { quoteState } from './store.js';

// 회사 config 로드 (welrix.json) — calc.js 에 주입
async function loadCompanyConfig() {
  try {
    const res = await fetch('/data/company-config/welrix.json');
    const cfg = await res.json();
    setCompanyConfig(cfg);
    window.__welrix_companyConfig = cfg;
  } catch (e) {
    console.warn('[mobile] company config 로드 실패:', e);
  }
}

// vehicles.json (잔가율 매칭용) — 트림 선택 즉시 monthly 계산되도록 mount 전 로드
async function loadVehicles() {
  try {
    const res = await fetch('/data/vehicles.json');
    window.__welrix_vehicles = await res.json();
  } catch (e) {
    console.warn('[mobile] vehicles 로드 실패:', e);
    window.__welrix_vehicles = [];
  }
}

// 현대차 재고 (재고차 자동 할인 매칭용) — proxy /api/stock 통해 CORS 우회
async function loadStock() {
  try {
    const res = await fetch('/api/stock');
    if (!res.ok) throw new Error('http ' + res.status);
    const json = await res.json();
    window.__welrix_stock = json.data || [];
  } catch (e) {
    console.warn('[mobile] stock 로드 실패:', e);
    window.__welrix_stock = [];
  }
}

// window.VEHICLE_DB 가 sync script 로 head 에 로드되지만 — 모바일 브라우저 캐시/로딩
// 타이밍 등으로 setup 시점에 undefined 인 경우 방어
async function waitForVehicleDb(timeoutMs = 5000) {
  if (window.VEHICLE_DB) return;
  const start = Date.now();
  while (!window.VEHICLE_DB) {
    if (Date.now() - start > timeoutMs) {
      console.warn('[mobile] VEHICLE_DB 로드 타임아웃');
      return;
    }
    await new Promise(r => setTimeout(r, 30));
  }
}

async function boot() {
  await waitForVehicleDb();
  await Promise.all([loadCompanyConfig(), loadVehicles()]);
  // 재고는 비동기 — mount 후에도 늦게 도착해도 OK
  loadStock();
  const app = createApp(MobileApp);
  app.mount('#m-app');
}

boot();

// 모바일에서도 window.__welrix_recompute 가 호출되니 noop 으로 등록 (Vue 컴포넌트가 reactive 로 재계산)
window.__welrix_recompute = () => {};
