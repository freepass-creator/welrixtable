// 견적 공유 저장.
//
//  ① 영업 견적서 `/?q=<id>` — 기존 그대로 freepasserp3 RTDB `welrix_quotes/<id>`.
//     이미 나간 링크가 살아 있어야 해서 옮기지 않는다.
//  ② 셀프견적 `/s/<id>`   — welrixtable 프로젝트 Firestore. 주소에는 ID만 담는다.
//     (예전에는 견적 전체를 주소에 실어 2,000자가 넘었다)
import { ref, set, get, push } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, waitAuth, auth } from './config.js';
import { shareDb } from './share-db.js';

const 공유컬렉션 = 'welrix_quote_shares';
/** 손님에게 나가는 정본 도메인. 미리보기·개발 주소에서 만들어도 손님에게는 이 주소로 보낸다. */
export const 공유도메인 = 'https://welrixtable.vercel.app';
const 살릴기간 = 30 * 86400000; // 30일 — 대표 지정(2026-09-23)

// short id (6자) — Base36 timestamp + random
function makeShortId() {
  const t = Date.now().toString(36).slice(-4);
  const r = Math.random().toString(36).slice(2, 4);
  return t + r;
}

/** 추측이 어려운 8자리 ID. 36으로 나눈 나머지 편향까지 버린다. */
function 짧은아이디(길이 = 8) {
  const 글자 = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const 뽑힘 = [];
  while (뽑힘.length < 길이) {
    for (const v of crypto.getRandomValues(new Uint8Array(길이))) {
      if (v >= 252) continue; // 252 = 36*7 — 남는 꼬리는 버려야 고르게 나온다
      뽑힘.push(글자[v % 36]);
      if (뽑힘.length === 길이) break;
    }
  }
  return 뽑힘.join('');
}

/**
 * 견적 저장
 * @param {object} payload — { customer, staff, cond, vehicles, scenarios, send, ... }
 * @returns {Promise<{id, url}>}
 */
export async function saveQuote(payload) {
  await waitAuth();
  const id = makeShortId();
  const myUid = auth.currentUser?.uid || null;
  const data = {
    quote_id: id,
    created_at: Date.now(),
    expires_at: Date.now() + 7 * 86400000,
    // staff_uid = 영업자 익명 uid (권한 키) — 같은 브라우저에서 자기 견적의 채팅·파일 접근.
    // 관리자(role: admin) 는 rules 에서 모든 견적 통과.
    staff_uid: myUid,
    created_by_uid: myUid,
    is_anonymous: auth.currentUser?.isAnonymous !== false,
    company: 'welrix',
    ...payload,
  };
  // 충돌 방지 — 같은 id 가 이미 있으면 다시 생성 (최대 3회)
  for (let attempt = 0; attempt < 3; attempt++) {
    const path = `welrix_quotes/${id}`;
    const snap = await get(ref(db, path));
    if (!snap.exists()) {
      await set(ref(db, path), data);
      return { id, url: buildQuoteUrl(id) };
    }
    data.quote_id = makeShortId();
  }
  throw new Error('견적 ID 생성 실패 — 다시 시도하세요');
}

export async function loadQuote(id) {
  await waitAuth();
  const snap = await get(ref(db, `welrix_quotes/${id}`));
  return snap.exists() ? snap.val() : null;
}

export async function markQuoteAccessed(id) {
  await waitAuth();
  const path = `welrix_quotes/${id}/access_log`;
  const newRef = push(ref(db, path));
  await set(newRef, {
    at: Date.now(),
    ua: navigator.userAgent.slice(0, 200),
  });
}

export function buildQuoteUrl(id) {
  const origin = location.origin;
  // 같은 SPA 안에서 ?q=<id> 모드로 분기
  return `${origin}${location.pathname}?q=${id}`;
}

/**
 * 셀프견적 공유 저장 — 주소에는 ID만 남긴다.
 * @param {Array} payload — [선택 쿼리문자열, 줄인 스냅샷]
 * @returns {Promise<{id, url}>}
 */
export async function saveSelfQuote(payload) {
  const 저장값 = JSON.stringify(payload);
  let 마지막탈 = null;
  // ★있는지 먼저 «읽지» 않는다 — 없는 문서 읽기는 규칙이 막는다(링크 훑기 방지).
  //   이미 쓴 자리에 또 쓰는 것은 규칙이 update 로 보고 막으므로, 부딪히면 새 ID로 다시 한다.
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = 짧은아이디();
    const 자리 = doc(shareDb, 공유컬렉션, id);
    try {
      await setDoc(자리, {
        quote_id: id,
        kind: 'self',
        created_at: Date.now(),
        expires_at: Date.now() + 살릴기간,
        payload: 저장값,
      });
      return { id, url: buildSelfQuoteUrl(id) };
    } catch (e) {
      마지막탈 = e;
    }
  }
  throw 마지막탈 || new Error('견적 ID 생성 실패 — 다시 시도하세요');
}

/** 없거나 기간이 지났으면 null.
 *  ★규칙은 «없는 문서»도 거부로 답한다(링크를 훑지 못하게). 거부와 없음을 같게 본다. */
export async function loadSelfQuote(id) {
  let snap;
  try {
    snap = await getDoc(doc(shareDb, 공유컬렉션, id));
  } catch {
    return null;
  }
  if (!snap.exists()) return null;
  const 값 = snap.data();
  if (값.kind !== 'self') return null;
  if (Number(값.expires_at || 0) <= Date.now()) return null;
  if (typeof 값.payload !== 'string') return null;
  try {
    const payload = JSON.parse(값.payload);
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function buildSelfQuoteUrl(id) {
  return `${공유도메인}/s/${id}`;
}
