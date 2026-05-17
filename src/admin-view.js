// 관리자 페이지 — ?admin=1 로 접속 시 영업 UI 대신 admin 대시보드 표시
// 인증: freepasserp3 Firebase Auth (이메일/비번) 공유
// 권한: users/{auth.uid}/role in ['admin', 'agent_admin', 'agent_manager']

import { auth, db } from './firebase/config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { ref, get } from 'firebase/database';

const params = new URLSearchParams(location.search);
const isAdminMode = params.get('admin') === '1';

if (isAdminMode) {
  document.documentElement.classList.add('admin-mode');
  boot();
}

const STATE = {
  user: null,         // Firebase user
  profile: null,      // { role, name, email, ... } from users/{uid}
  ready: false,
  error: null,
};

async function boot() {
  // body 가 mount 되기 전 미리 admin shell 깔기
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-boot">
        <i class="ph ph-spinner"></i>
        <p>관리자 페이지 로딩 중...</p>
      </div>
    </div>
  `;

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn('[admin] setPersistence:', e?.code || e);
  }

  // auth 상태 watch
  onAuthStateChanged(auth, async (user) => {
    STATE.user = user;
    if (!user || user.isAnonymous) {
      // 익명이거나 미로그인 → 로그인 화면
      STATE.profile = null;
      renderLogin();
      return;
    }
    // 로그인됨 → role 조회
    try {
      const snap = await get(ref(db, `users/${user.uid}`));
      const profile = snap.val() || {};
      STATE.profile = profile;
      if (!hasAdminRole(profile)) {
        renderForbidden(profile);
        return;
      }
      renderDashboard();
    } catch (e) {
      console.error('[admin] profile fetch:', e);
      STATE.error = e.message || String(e);
      renderError();
    }
  });
}

function hasAdminRole(profile) {
  if (!profile?.role) return false;
  return ['admin', 'agent_admin', 'agent_manager'].includes(profile.role);
}

// ============ 화면 렌더링 ============

function renderLogin() {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-login">
        <div class="adm-login__head">
          <div class="brand">WELRIX MOBILITY</div>
          <h2>관리자 로그인</h2>
          <p>견적관리자 / 영업관리자 계정으로 로그인하세요</p>
        </div>
        <form class="adm-login__form" id="adm-login-form">
          <label>
            <span>이메일</span>
            <input type="email" id="adm-email" required autocomplete="username" autofocus />
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" id="adm-password" required autocomplete="current-password" />
          </label>
          <div class="adm-login__error" id="adm-login-error" hidden></div>
          <button type="submit" class="adm-login__submit">
            <i class="ph ph-sign-in"></i> 로그인
          </button>
          <div class="adm-login__hint">
            계정 발급은 시스템 관리자에게 문의하세요.<br>
            영업자는 로그인 없이 메인 페이지에서 사용 가능합니다.
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('adm-login-form').addEventListener('submit', onLoginSubmit);
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('adm-email').value.trim();
  const password = document.getElementById('adm-password').value;
  const errorEl = document.getElementById('adm-login-error');
  const submitBtn = e.target.querySelector('button[type=submit]');

  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ph ph-spinner"></i> 로그인 중...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // 성공하면 onAuthStateChanged 가 다음 단계로 이끔
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = parseAuthError(err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> 로그인';
  }
}

function parseAuthError(err) {
  const code = err?.code || '';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (code.includes('too-many-requests')) {
    return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
  }
  if (code.includes('network-request-failed')) {
    return '네트워크 연결을 확인하세요.';
  }
  return err?.message || '로그인 실패';
}

function renderForbidden(profile) {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-forbidden">
        <i class="ph ph-warning-octagon"></i>
        <h2>접근 권한이 없습니다</h2>
        <p>${escapeHtml(profile.email || STATE.user.email)} 계정은 welrix 관리자 권한이 없습니다.<br>
           시스템 관리자에게 권한 부여를 요청하세요.</p>
        <div class="adm-forbidden__meta">
          현재 role: <code>${profile.role || '(없음)'}</code> · 필요: <code>admin / agent_admin / agent_manager</code>
        </div>
        <button class="adm-btn outline" id="adm-logout">
          <i class="ph ph-sign-out"></i> 다른 계정으로 로그인
        </button>
      </div>
    </div>
  `;
  document.getElementById('adm-logout').addEventListener('click', () => signOut(auth));
}

function renderError() {
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-forbidden">
        <i class="ph ph-warning-circle"></i>
        <h2>오류 발생</h2>
        <p><small>${escapeHtml(STATE.error || '알 수 없는 오류')}</small></p>
      </div>
    </div>
  `;
}

function renderDashboard() {
  // 임시 화면 — Phase 3-4 에서 견적 목록·채팅 인박스 채워짐
  document.body.innerHTML = `
    <div class="adm-shell">
      <div class="adm-header">
        <div class="adm-header__brand">
          <i class="ph ph-shield-check"></i>
          <span>WELRIX 관리자</span>
        </div>
        <div class="adm-header__user">
          <span>${escapeHtml(STATE.profile.name || STATE.user.email)}</span>
          <span class="adm-header__role">${escapeHtml(STATE.profile.role)}</span>
          <button class="adm-btn ghost" id="adm-logout"><i class="ph ph-sign-out"></i>로그아웃</button>
        </div>
      </div>
      <div class="adm-body">
        <div class="adm-tab-bar">
          <button class="adm-tab is-active" data-tab="quotes"><i class="ph ph-list"></i> 발송 견적</button>
          <button class="adm-tab" data-tab="chats"><i class="ph ph-chat-circle-dots"></i> 채팅 인박스</button>
          <button class="adm-tab" data-tab="settings"><i class="ph ph-gear"></i> 설정</button>
        </div>
        <div class="adm-tab-body" id="adm-tab-body">
          <div class="adm-placeholder">
            <p>📋 견적 목록 — 곧 구현됩니다 (Phase 3-4)</p>
            <small>로그인 완료 · 권한: ${escapeHtml(STATE.profile.role)}</small>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('adm-logout').addEventListener('click', () => signOut(auth));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
