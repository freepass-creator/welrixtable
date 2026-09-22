# Self Quote 견적 계약 규격

최종 갱신: 2026-09-19

## 원칙

FreePass Self Quote는 자체 대여료 계산기를 제공하는 제품이 아니다.

- 화면/선택 뼈대: FreePass
- 차량/트림/옵션 매핑: FreePass가 웰릭스 원천을 계층화한 Adapter
- 대여료 계산: 웰릭스 `/api/estimate`
- 공유 견적: 계산 당시 Snapshot
- 웰릭스 실패 시: 계산 중단. 로컬 엔진 fallback 금지

## 경계

```text
UI
 -> Quote Engine(공통 의미/단위)
 -> Welrix Adapter(매핑/단위변환/통신/오류)
 -> Welrix Estimate API
```

공통 Quote Engine 안에서는 비율을 퍼센트로 보관한다.

- 보증금 0% = `0`
- 선납금 0% = `0`
- 수수료율 7% = `7`

Welrix Adapter 안에서만 API 비율로 변환한다.

- `deposit_pct: 0`
- `prepay_pct: 0`
- `feeRate: 0.07`

이 단위 변환은 UI나 공통 Engine으로 새어 나오면 안 된다.

## fail-closed

다음은 모두 견적 실패로 처리한다.

- HTTP 오류
- `ok !== true`
- 차량가가 숫자가 아님
- 결과 개수가 요청 시나리오 개수와 다름
- 월 대여료/보증금/선납금/인수가/총차량가/수수료 중 비정상 값
- 부분 결과

실패 시 `calc.js`나 다른 계산기로 자동 대체하지 않는다.

## 자동 검증

`npm run check:quote-contract`

검증 범위:

- % 단위 경계
- 보증금/선납/수수료율 범위
- 중복 기간 차단
- NaN/음수 금액 차단
- Welrix body 변환
- 응답 개수/금액 무결성
- upstream 실패 시 fallback 없음

실제 웰릭스와의 0원 대조는 별도 live 검사다.

`npm run check:welrix-live`

외부 서버 의존 검사는 일반 PR CI의 필수 게이트로 두지 않는다.

## 계약 버전

- 공통 견적 계약: `quote-v1`
- 웰릭스 Adapter 계약: `welrix-estimate-v1`

향후 API body나 의미 단위가 바뀌면 버전을 올리고, Snapshot/QA와 함께 회귀 검증한다.
