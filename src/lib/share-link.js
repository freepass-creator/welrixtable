// ============================================================================
//  공유 링크 — 고른 내용을 «주소에» 담는다
// ----------------------------------------------------------------------------
//  ★대표 2026-09-17 「공유는 좀 있었으면 좋겠어 — 내가 친구한테 할 수도 있고
//    손님한테 할 수도 있으니까」
//
//  ★왜 저장을 안 하고 주소에 담나
//    원래 견적 발송은 RTDB(`welrix_quotes/<id>`)에 저장해야 돌았는데,
//    그 DB 는 owner 가 꺼 놨다(2026-09-17 콘솔: "disabled by a database owner").
//    주소에 담으면 저장이 아예 필요 없다 — 링크 하나로 그 견적이 그대로 열린다.
//    카톡으로 던지든 문자로 보내든 받은 사람 화면에서 똑같이 재현된다.
//
//  ★담는 것은 «고른 것»뿐이다. 수수료·신용 같은 값은 담지 않는다 —
//    받는 사람의 역할(손님/담당자)에 맞게 그쪽에서 정해진다.
//    그래야 담당자가 보낸 링크를 손님이 열어도 손님 기준으로 보인다.
// ============================================================================

/* 주소 글자를 아끼려고 한 글자 키를 쓴다 */
const 키 = {
  b: 'manufacturer',
  m: 'model',
  v: 'variant',
  t: 'trim',
};

/** 지금 고른 것을 주소 뒤에 붙일 문자열로 — 아무것도 안 골랐으면 빈 문자열 */
export function 담기(vehicleState, quoteState) {
  const p = new URLSearchParams();
  for (const [짧, 긴] of Object.entries(키)) {
    const v = vehicleState?.[긴];
    if (v) p.set(짧, String(v));
  }
  const 옵 = [...(vehicleState?.options || [])];
  if (옵.length) p.set('o', 옵.join('.'));
  if (vehicleState?.color != null && vehicleState.color !== '') p.set('c', String(vehicleState.color));

  const c = quoteState?.cond;
  if (c?.km && c.km !== 2) p.set('k', String(c.km));
  if (c?.colorInt) p.set('ci', c.colorInt);
  /* 기간 셋 중 손님이 바꿔 둔 게 있으면 담는다 */
  const 기간 = (quoteState?.scenarios || []).map((s) => s.term).join('.');
  if (기간 && 기간 !== '60.48.36') p.set('y', 기간);

  return p.toString();
}

/** 주소에 담겨 온 것을 상태에 푼다. 푼 게 있으면 true */
export function 풀기(vehicleState, quoteState, 주소 = location.search) {
  let p;
  try { p = new URLSearchParams(주소); } catch { return false; }
  if (!p.get('b') && !p.get('m')) return false;

  for (const [짧, 긴] of Object.entries(키)) {
    const v = p.get(짧);
    if (v) vehicleState[긴] = v;
  }
  /* ★파워트레인 id 는 차 목록을 다시 만들면 바뀔 수 있다(2026-09-18 인승·구동을 트림 쪽으로 내리며 바뀌었다).
     트림(=웰릭스 model 키)은 안 바뀌므로, 트림으로 파워트레인을 거꾸로 찾아 맞춘다 — 옛 링크도 열린다. */
  if (vehicleState.trim) {
    try {
      const 모델 = window.VEHICLE_DB?.manufacturers?.find((b) => b.manufacturer_id === vehicleState.manufacturer)
        ?.models?.find((m) => m.model_id === vehicleState.model);
      const 갈래 = 모델?.variants?.find((v) => v.trims.some((t) => t.trim_id === vehicleState.trim));
      if (갈래) vehicleState.variant = 갈래.variant_id;
    } catch { /* 못 찾으면 링크 값 그대로 */ }
  }
  const o = p.get('o');
  vehicleState.options = new Set(o ? o.split('.').filter(Boolean) : []);
  const c = p.get('c');
  if (c != null && c !== '') vehicleState.color = isNaN(+c) ? c : +c;

  const km = p.get('k');
  if (km) quoteState.cond.km = +km || quoteState.cond.km;
  const ci = p.get('ci');
  if (ci) quoteState.cond.colorInt = ci;
  const y = p.get('y');
  if (y) {
    const 들 = y.split('.').map(Number).filter(Boolean);
    들.forEach((t, i) => { if (quoteState.scenarios[i]) quoteState.scenarios[i].term = t; });
  }

  /* ★링크로 들어왔으면 «차를 다 고른» 자리에서 시작한다.
     처음 화면(제조사)으로 떨어뜨리면 받은 사람이 그 견적을 못 본다. */
  vehicleState.subStep = vehicleState.trim ? 'options' : 'brand';
  /* ★차가 다 골라진 링크면 «견적 페이지»부터 보인다 — 받은 사람이 보려는 건 그 금액이다 */
  vehicleState.견적부터 = !!vehicleState.trim;
  return true;
}

/** 지금 화면을 그대로 여는 주소 (staff 는 role.js 의 손님링크가 떼어 낸다) */
export function 지금주소(vehicleState, quoteState) {
  const u = new URL(location.href);
  u.search = 담기(vehicleState, quoteState);
  /* ★force=mobile 을 지킨다 — 빠지면 받은 사람이 PC 로 열 때 «담당자용 PC 화면»으로 넘어간다 */
  u.searchParams.set('force', 'mobile');
  return u.toString();
}
