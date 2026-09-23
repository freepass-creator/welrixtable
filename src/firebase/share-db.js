// 셀프견적 공유 저장소 — welrixtable 프로젝트 Firestore.
//
// ★견적기 본체(견적서·채팅·계약서·리드)는 아직 freepasserp3 RTDB에 있다.
//   새로 쌓는 셀프견적 공유만 여기에 둔다 — ERP(erp3·erp5) 규칙을 건드리지 않기 위해서다.
//   (2026-09-23 대표 결정. erp5 Firestore는 「서버만 쓴다」로 잠겨 있어 브라우저 쓰기를 넣지 않는다)
//
// ⚠ 아래 값들은 «비밀이 아니다». 공개돼도 된다 — 실제 방어는 firestore.rules 가 한다.
//   규칙 정본은 freepass-sales 저장소의 firestore.rules 다.
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const 설정 = {
  apiKey: 'AIzaSyDqPhVTIKLpoFmPySlPk9iAX_tJIcFIyZg',
  authDomain: 'welrixtable.firebaseapp.com',
  projectId: 'welrixtable',
  storageBucket: 'welrixtable.firebasestorage.app',
  messagingSenderId: '480591093407',
  appId: '1:480591093407:web:abb3e592a618f1f5364caa',
};

// 견적기 본체 앱(freepasserp3)과 «다른 앱»으로 띄운다. 기존 인증·RTDB는 그대로 둔다.
const 앱이름 = 'welrix-share';
const app = getApps().find((x) => x.name === 앱이름) || initializeApp(설정, 앱이름);

export const shareDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
