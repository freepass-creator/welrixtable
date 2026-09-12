// 홈페이지 Vue 엔트리 — 마케팅 랜딩 + 셀프 견적 + 상담 신청
// 견적 엔진(lib/calc.js)·차량 DB(vehicles.json) 는 ERP 와 100% 공유.
// 단, UI 셸은 마케팅 톤에 맞춰 별도. 어느 한쪽 calc 개선하면 양쪽 다 반영됨.
import { createApp } from 'vue';
import { setCompanyConfig } from './lib/calc.js';
import QuoteWidget from './components/home/QuoteWidget.vue';
import LeadForm from './components/home/LeadForm.vue';
import Lineup from './components/home/Lineup.vue';
import HeroBest from './components/home/HeroBest.vue';
import AiRecommender from './components/home/AiRecommender.vue';

// 이 광고 페이지를 보내는 담당자 본인 연락처 — 모바일 하단 [문자 문의]/[전화 문의] 가 여기로 연결됨.
// 회사 대표번호(1544-0000, company-config)는 문자 수신이 안 되는 상담용 번호라 여기 쓰지 않음.
// TODO: 실제 캠페인 담당자 휴대폰 번호로 교체 (예: '010-1234-5678')
const AGENT_PHONE = '';

function wireAgentContact() {
  const digits = AGENT_PHONE.replace(/[^0-9]/g, '');
  const smsEl = document.getElementById('mcta-sms');
  const telEl = document.getElementById('mcta-tel');
  [smsEl, telEl].forEach((el, i) => {
    if (!el) return;
    if (digits) {
      el.href = (i === 0 ? 'sms:' : 'tel:') + digits;
    } else {
      // 번호 미설정 — 깨진 링크로 보이지 않게 안내만
      el.removeAttribute('href');
      el.style.opacity = '0.5';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        alert('상담 연락처 준비 중입니다. 잠시만 기다려 주세요.');
      });
    }
  });
}
wireAgentContact();

// 회사 config(welrix.json = 엑셀 견적기 정책 SSOT) 주입 — 웹 ERP/모바일과 동일 엔진 설정.
// (과거 home 은 이 주입을 안 해서 calc.js 기본값으로 계산 → 포터보험·중신용 수익률 등이 어긋났음)
// company_info(상호/대표/사업자번호/주소/연락처)도 여기서 같이 읽어 푸터에 채움 — 손님 노출 화면은
// 항상 이 SSOT(웰릭스 모빌리티) 기준이며, 별도 문구를 하드코딩하지 않는다.
let __configReady = (async () => {
  try {
    const res = await fetch('/data/company-config/welrix.json');
    const cfg = await res.json();
    setCompanyConfig(cfg);
    fillFooterFromConfig(cfg);
  } catch (e) {
    console.warn('[home] company config 로드 실패:', e);
  }
})();

function fillFooterFromConfig(cfg) {
  const ci = cfg?.company_info || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  set('footer-biz-name', ci.full_name);
  set('footer-biz-ceo', ci.ceo);
  set('footer-biz-no', ci.biz_no);
  set('footer-biz-addr', ci.address);
  const telEl = document.getElementById('footer-tel');
  if (telEl && ci.phone) { telEl.textContent = ci.phone; telEl.href = 'tel:' + ci.phone.replace(/[^0-9]/g, ''); }
  const emailEl = document.getElementById('footer-email');
  if (emailEl && ci.email) { emailEl.textContent = ci.email; emailEl.href = 'mailto:' + ci.email; }
}

function mountOne(id, Component, label) {
  const target = document.getElementById(id);
  if (!target) { console.warn(`[home] #${id} 없음`); return; }
  createApp(Component).mount(target);
  console.log(`[home] ${label} mounted`);
}

async function mountAll() {
  // config(welrix.json) 주입 완료 + window.VEHICLE_DB 로드까지 대기 후 mount
  await __configReady;
  if (!window.VEHICLE_DB) {
    setTimeout(mountAll, 50);
    return;
  }
  mountOne('hero-best-root', HeroBest, 'HeroBest');
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
