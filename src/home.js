// 홈페이지 Vue 엔트리 — 마케팅 랜딩 + 셀프 견적 + 상담 신청
// 견적 엔진(lib/calc.js)·차량 DB(vehicles.json) 는 ERP 와 100% 공유.
// 단, UI 셸은 마케팅 톤에 맞춰 별도. 어느 한쪽 calc 개선하면 양쪽 다 반영됨.
import { createApp } from 'vue';
import QuoteWidget from './components/home/QuoteWidget.vue';
import LeadForm from './components/home/LeadForm.vue';
import Lineup from './components/home/Lineup.vue';
import AiRecommender from './components/home/AiRecommender.vue';

function mountOne(id, Component, label) {
  const target = document.getElementById(id);
  if (!target) { console.warn(`[home] #${id} 없음`); return; }
  createApp(Component).mount(target);
  console.log(`[home] ${label} mounted`);
}

function mountAll() {
  // window.VEHICLE_DB 가 로드될 때까지 잠시 대기 (vehicle-db.js sync script)
  if (!window.VEHICLE_DB) {
    setTimeout(mountAll, 50);
    return;
  }
  mountOne('lineup-root', Lineup, 'Lineup');
  mountOne('ai-recommender-root', AiRecommender, 'AiRecommender');
  mountOne('quote-widget-root', QuoteWidget, 'QuoteWidget');
  mountOne('lead-form-root', LeadForm, 'LeadForm');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}

// 부드러운 nav scroll
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1).split('?')[0];
  const target = document.getElementById(id);
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  }
});
