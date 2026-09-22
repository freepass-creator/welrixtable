import assert from 'node:assert/strict';
import { 요청검사, 결과검사, 견적계약버전 } from '../src/lib/quote/spec.js';
import {
  계산,
  요청을웰릭스몸통으로,
  어댑터계약버전,
} from '../src/lib/quote/engines/welrix.js';

const 기본요청 = () => ({
  차: {
    종류: '신차',
    키: '테스트 차량',
    차량가: 0,
    옵션가: 100000,
    색추가금: 20000,
    할인: 30000,
  },
  조건: {
    신용: '중신용',
    주행: '2만km',
    정비: '웰스 Basic',
    대물: '1억',
    추가운전자: '없음',
    탁송비: 120000,
    썬팅비: 105000,
    블박비: 180000,
    수수료율: 7,
  },
  안들: [
    { 기간: 60, 보증금: 0, 선납: 0 },
    { 기간: 48, 보증금: 0, 선납: 0 },
    { 기간: 36, 보증금: 0, 선납: 0 },
  ],
});

assert.equal(견적계약버전, 'quote-v1');
assert.equal(어댑터계약버전, 'welrix-estimate-v1');
assert.equal(요청검사(기본요청()), null);

{
  const r = 기본요청();
  r.조건.수수료율 = 700;
  assert.match(요청검사(r), /수수료율/);
}
{
  const r = 기본요청();
  r.안들[0].보증금 = 110;
  assert.match(요청검사(r), /보증금/);
}
{
  const r = 기본요청();
  r.안들[0].선납 = -1;
  assert.match(요청검사(r), /선납금/);
}
{
  const r = 기본요청();
  r.안들[1].기간 = 60;
  assert.match(요청검사(r), /중복/);
}
{
  const r = 기본요청();
  r.차.옵션가 = NaN;
  assert.match(요청검사(r), /옵션가/);
}
{
  const r = 기본요청();
  r.차.키 = '   ';
  assert.match(요청검사(r), /차를 아직/);
}

{
  const 몸 = 요청을웰릭스몸통으로(기본요청());
  assert.equal(몸.model, '테스트 차량');
  assert.equal(몸.inputs.length, 3);
  assert.equal(몸.inputs[0].deposit_pct, 0);
  assert.equal(몸.inputs[0].prepay_pct, 0);
  assert.equal(몸.inputs[0].feeRate, 0.07);
  assert.equal(몸.inputs[0].optionPrice, 120000);
  assert.equal(몸.inputs[0].stockDiscount, 30000);
}

{
  const err = 결과검사([
    { 월대여료: 500000, 보증금: 3000000, 선납금: 0, 인수가: 10000000, 총차량가: 30000000, 수수료: 500000 },
    { 월대여료: 520000, 보증금: 3000000, 선납금: 0, 인수가: 10000000, 총차량가: 30000000, 수수료: 500000 },
    { 월대여료: 550000, 보증금: 3000000, 선납금: 0, 인수가: 10000000, 총차량가: 30000000, 수수료: 500000 },
  ], 기본요청().안들);
  assert.equal(err, null);
}
{
  const err = 결과검사([
    { 월대여료: -1 },
    null,
    null,
  ], 기본요청().안들);
  assert.match(err, /월 대여료/);
}

const 원래fetch = globalThis.fetch;
let 호출수 = 0;
try {
  globalThis.fetch = async (url, init) => {
    호출수++;
    assert.equal(url, '/api/estimate');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.inputs[0].deposit_pct, 0);
    assert.equal(body.inputs[0].feeRate, 0.07);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          price: 30000000,
          results: body.inputs.map((_, i) => ({
            monthlyRent: 500000 + i * 10000,
            deposit: 3000000,
            prepay: 0,
            acquirePrice: 10000000,
            totalCarPrice: 30000000,
            payFee: 500000,
          })),
        };
      },
    };
  };

  const 답 = await 계산(기본요청());
  assert.equal(답.차량가, 30000000);
  assert.equal(답.결과.length, 3);
  assert.equal(답.결과[0].월대여료, 500000);
  assert.equal(호출수, 1);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, price: 30000000, results: [] };
    },
  });
  await assert.rejects(() => 계산(기본요청()), /3개 결과/);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        price: 30000000,
        results: 기본요청().안들.map(() => ({
          monthlyRent: null,
          deposit: 3000000,
          prepay: 0,
          acquirePrice: 10000000,
          totalCarPrice: 30000000,
          payFee: 500000,
        })),
      };
    },
  });
  await assert.rejects(() => 계산(기본요청()), /월 대여료/);

  let 실패호출 = 0;
  globalThis.fetch = async () => {
    실패호출++;
    return {
      ok: false,
      status: 502,
      async json() { return { error: 'upstream down' }; },
    };
  };
  await assert.rejects(() => 계산(기본요청()), /upstream down/);
  assert.equal(실패호출, 1, '웰릭스 실패 시 다른 계산기로 재시도/대체하면 안 된다');
} finally {
  globalThis.fetch = 원래fetch;
}

console.log('PASS self-quote contract: request/unit/response/fail-closed');
