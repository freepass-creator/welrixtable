// ============================================================================
//  계산기 ① 웰릭스 — 신차. 계산은 웰릭스 서버가 한다.
// ----------------------------------------------------------------------------
//  Engine(뼈대)은 업무 의미/단위를 소유하고, 이 Adapter는
//  웰릭스 API의 몸통 변환·통신·응답 검증·오류 변환만 소유한다.
//
//  ★ fail-closed:
//    웰릭스가 실패/변경/부분응답이면 로컬 계산으로 대체하지 않는다.
// ============================================================================
export const 이름 = '웰릭스';
export const 다루는차 = ['신차'];
export const 어댑터계약버전 = 'welrix-estimate-v1';

const 유한비음수 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 공통 견적 규격(%) → 웰릭스 API 규격(0~1 비율) */
export function 요청을웰릭스몸통으로(요청) {
  const { 차, 조건, 안들 } = 요청;
  return {
    model: 차.키,
    old: false,
    manualPrice: 차.차량가 || 0,
    inputs: 안들.map((a) => ({
      credit: 조건.신용,
      termMonths: a.기간,
      mileage: 조건.주행,
      optionPrice: (차.옵션가 || 0) + (차.색추가금 || 0),
      stockDiscount: 차.할인 || 0,
      deliveryFee: 조건.탁송비,
      tintFee: 조건.썬팅비,
      dashcamFee: 조건.블박비,
      deposit_pct: (a.보증금 || 0) / 100,
      prepay_pct: (a.선납 || 0) / 100,
      liability: 조건.대물,
      extraDriver: 조건.추가운전자,
      maintenance: 조건.정비,
      feeRate: (조건.수수료율 || 0) / 100,
    })),
  };
}

function 응답검사(j, 기대개수) {
  if (!j || typeof j !== 'object' || j.ok !== true) return '웰릭스 응답 형식이 올바르지 않습니다';
  if (!유한비음수(j.price)) return '웰릭스 차량가가 올바르지 않습니다';
  if (!Array.isArray(j.results)) return '웰릭스 계산 결과가 없습니다';
  if (j.results.length !== 기대개수) return `웰릭스가 ${기대개수}개 결과를 줘야 하는데 ${j.results.length}개를 줬습니다`;

  for (let i = 0; i < j.results.length; i++) {
    const g = j.results[i];
    if (!g || typeof g !== 'object') return `웰릭스 ${i + 1}번째 결과가 비어 있습니다`;
    for (const [이름, 값] of [
      ['월 대여료', g.monthlyRent], ['보증금', g.deposit], ['선납금', g.prepay],
      ['인수가', g.acquirePrice], ['총차량가', g.totalCarPrice], ['수수료', g.payFee],
    ]) {
      if (!유한비음수(값)) return `웰릭스 ${이름} 값이 올바르지 않습니다`;
    }
  }
  return null;
}

/** @param {object} 요청 spec.js 규격
 * @returns {Promise<{차량가:number, 결과:Array}>}
 * @throws 웰릭스가 정확한 결과를 못 내면 던진다 */
export async function 계산(요청, { 신호 } = {}) {
  const 몸 = 요청을웰릭스몸통으로(요청);

  const r = await fetch('/api/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(몸),
    signal: 신호,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `계산 서버 응답 ${r.status}`);

  const 응답오류 = 응답검사(j, 요청.안들.length);
  if (응답오류) throw new Error(응답오류);

  return {
    차량가: j.price,
    결과: j.results.map((g) => ({
      월대여료: g.monthlyRent,
      보증금: g.deposit,
      선납금: g.prepay,
      인수가: g.acquirePrice,
      총차량가: g.totalCarPrice,
      수수료: g.payFee,
    })),
  };
}
