// ============================================================================
//  견적 규격 — 뼈대와 계산기가 주고받는 «말»
// ----------------------------------------------------------------------------
//  화면은 계산기를 모른다. 뼈대는 업무 의미와 단위를 소유하고,
//  계산기(Adapter)는 외부 계산 시스템의 전송/매핑/오류를 소유한다.
//
//  공통 단위:
//    금액 = 원(number, 0 이상)
//    비율 = 퍼센트(number, 10 = 10%)
//    기간 = 개월(integer)
// ============================================================================
export const 견적계약버전 = 'quote-v1';

const 유한숫자 = (v) => typeof v === 'number' && Number.isFinite(v);
const 빈문자아님 = (v) => typeof v === 'string' && v.trim().length > 0;

function 금액검사(이름, 값) {
  if (!유한숫자(값) || 값 < 0) return `${이름} 금액이 올바르지 않습니다`;
  return null;
}

function 비율검사(이름, 값) {
  if (!유한숫자(값) || 값 < 0 || 값 > 100) return `${이름} 비율이 올바르지 않습니다`;
  return null;
}

/** 요청이 규격에 맞나 — 계산기를 부르기 전에 뼈대가 스스로 본다 */
export function 요청검사(요청) {
  if (!요청 || typeof 요청 !== 'object') return '견적 요청이 없습니다';
  if (!빈문자아님(요청?.차?.종류)) return '차량 종류가 올바르지 않습니다';
  if (!빈문자아님(요청?.차?.키)) return '차를 아직 고르지 않았습니다';

  for (const [이름, 값] of [
    ['차량가', 요청.차.차량가],
    ['옵션가', 요청.차.옵션가],
    ['색상 추가금', 요청.차.색추가금],
    ['할인', 요청.차.할인],
  ]) {
    const 오류 = 금액검사(이름, 값);
    if (오류) return 오류;
  }

  const 조건 = 요청.조건;
  if (!조건 || typeof 조건 !== 'object') return '계약 조건이 없습니다';
  for (const [이름, 값] of [
    ['신용', 조건.신용], ['주행거리', 조건.주행], ['정비', 조건.정비],
    ['대물', 조건.대물], ['추가운전자', 조건.추가운전자],
  ]) {
    if (!빈문자아님(값)) return `${이름} 조건이 올바르지 않습니다`;
  }
  for (const [이름, 값] of [
    ['탁송비', 조건.탁송비], ['썬팅비', 조건.썬팅비], ['블랙박스비', 조건.블박비],
  ]) {
    const 오류 = 금액검사(이름, 값);
    if (오류) return 오류;
  }
  {
    const 오류 = 비율검사('수수료율', 조건.수수료율);
    if (오류) return 오류;
  }

  if (!Array.isArray(요청.안들) || !요청.안들.length) return '기간이 정해지지 않았습니다';
  const 기간들 = new Set();
  for (const a of 요청.안들) {
    if (!a || typeof a !== 'object') return '견적안이 올바르지 않습니다';
    if (!Number.isInteger(a.기간) || a.기간 < 1 || a.기간 > 120) return '기간이 올바르지 않습니다';
    if (기간들.has(a.기간)) return '같은 기간이 중복되어 있습니다';
    기간들.add(a.기간);

    const 보증금오류 = 비율검사('보증금', a.보증금);
    if (보증금오류) return 보증금오류;
    const 선납오류 = 비율검사('선납금', a.선납);
    if (선납오류) return 선납오류;
  }
  return null;
}

/** 결과 한 칸의 빈 모양 — 계산기가 값을 못 냈을 때 */
export const 빈칸 = null;

/** 결과가 규격에 맞나 — 계산기를 믿지 않고 뼈대가 받은 자리에서 본다 */
export function 결과검사(결과, 안들) {
  if (!Array.isArray(결과)) return '계산기가 목록을 주지 않았습니다';
  if (!Array.isArray(안들)) return '비교할 견적안이 없습니다';
  if (결과.length !== 안들.length) return `계산기가 ${안들.length}개를 줘야 하는데 ${결과.length}개를 줬습니다`;

  for (let i = 0; i < 결과.length; i++) {
    const r = 결과[i];
    if (r == null) continue;
    if (typeof r !== 'object') return `${i + 1}번째 계산 결과가 올바르지 않습니다`;

    const 월오류 = 금액검사('월 대여료', r.월대여료);
    if (월오류) return 월오류;

    for (const [이름, 값] of [
      ['보증금', r.보증금], ['선납금', r.선납금], ['인수가', r.인수가],
      ['총차량가', r.총차량가], ['수수료', r.수수료],
    ]) {
      if (값 == null) continue;
      const 오류 = 금액검사(이름, 값);
      if (오류) return 오류;
    }
  }
  return null;
}
