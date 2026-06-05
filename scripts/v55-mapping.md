# v5.5 엑셀 ↔ calc.js DEFAULT_CFG 셀 매핑

다음 버전(v5.6, v6.0) 엑셀이 와도 **이 셀들만 추출해서 비교**하면 변경점 즉시 발견.
자동 추출은 `scripts/verify-v55-mapping.cjs` 로 실행.

## 1. 신용도별 이자율/IRR/수익률 (목록박스_정리필요 시트)

| 등급 | 엑셀 셀 | calc.js | 현재값 |
|------|--------|---------|--------|
| 신용 interest | G25 | credit_lookup.신용.interest | 0.064 |
| 중신용 interest | G26 | credit_lookup.중신용.interest | 0.064 |
| 저신용 interest | G27 | credit_lookup.저신용.interest | 0.064 |
| 신용 profit (IRR) | J25 | credit_lookup.신용.profit | 0.019 |
| 중신용 profit (IRR) | J26 | credit_lookup.중신용.profit | **0.041** (v5.5 변경) |
| 저신용 profit (IRR) | J27 | credit_lookup.저신용.profit | 0.084 |
| 신용 deposit (수익률) | M25 | credit_lookup.신용.deposit | 0.05 |
| 중신용 deposit (수익률) | M26 | credit_lookup.중신용.deposit | 0.20 |
| 저신용 deposit (수익률) | M27 | credit_lookup.저신용.deposit | 0.30 |

## 2. 잔가표 (직군 및 잔가 시트)

군별/개월수별 base 잔가율 = `vehicles.json` r24/r36/r48/r60 으로 미리 계산되어 저장.
엑셀 직군 시트 변경 시 vehicles.json 도 같이 업데이트 필요.

| 셀 범위 | 의미 |
|---------|------|
| B5:N5 | 24M 군별 잔가 |
| B6:N6 | 36M 군별 잔가 |
| B7:N7 | 48M 군별 잔가 |
| B8:N8 | 60M 군별 잔가 |
| E9:N21 | 군별 차종 분류 |

## 3. 비용 상수 (견적1 시트)

| 엑셀 셀 | 의미 | calc.js | 현재값 |
|--------|------|---------|--------|
| C13 | 등록비 | costs.registration_fee | 200,000 |
| C35 | **1차탁송료** | costs.delivery_first | **500,000** (v5.5 변경, 기존 300,000) |
| I14 | 자동차 수리율 (연) | costs.repair_rate_annual | 0.02 |
| C12 비율 | 취득세 (일반) | costs.acquisition_tax_rate | 0.04 |
| C12 비율 (포터) | 취득세 (포터) | costs.acquisition_tax_rate_porter | 0.05 |

## 4. 서비스 단가 (견적1 시트)

| 엑셀 셀 | 의미 | calc.js | 현재값 |
|--------|------|---------|--------|
| I17 (웰스Basic) | 정비 월 (12,900*12=154,800/년) | services.wells_basic_monthly | 12,900 |
| I17 (웰스Self) | 정비 연 (96,000) | services.wells_self_yearly | 96,000 |
| I19 | GPS 월 (11,000*12=132,000/년) | services.gps_monthly | 11,000 |
| I16 / 목록박스 G37-G39 | 정기검사 연 | services.inspection_fee_yearly | 76,000 |

## 5. 자동차보험 (견적1 시트)

| 엑셀 셀 | 차종 | calc.js | 현재값 |
|--------|------|---------|--------|
| I10 (일반) | 일반 차량 | insurance.base_normal | 820,750 |
| I10 (다인승) | 7인승+ | insurance.base_multi_seat | 732,880 |
| **I10 (포터)** | 포터 | insurance.base_porter | **확인필요: 우리 1,400,000 vs 엑셀 2,000,000** |
| I12 | 대물 가산 | insurance.property_extra | {1억:0, 2억:10000, 3억:20000, 5억:30000} |

## 6. 잔존가 추가율

| 엑셀 셀/식 | 의미 | calc.js | 현재값 |
|----------|------|---------|--------|
| I5 (신용일 때) | 매각잔가 가산 (신용=차량별 buyback_apply) | residuals.buyback_rate_add.by_credit.신용 | 0 |
| I5 (그 외) | 매각잔가 가산 (중/저/무신용 = 4%) | residuals.buyback_rate_add.by_credit.{중,저,무}신용 | 0.04 |
| I6 (고신용 0%, 중 2%, 저 4%) | 인수가율 가산 | residuals.buyback_rate_add.by_credit | 신용 0, 고 0, 중 0.02, 저 0.04, 무 0.04 |
| I6 (제네시스 23%) | 브랜드 가산 | residuals.buyback_rate_add.by_brand.제네시스 | 0.25 |
| I6 (K9/하이리무진 +25%) | 모델 가산 | residuals.buyback_rate_add.by_model | K9: 0.20, 하이리무진: 0.20 |
| I4 km 조정 | 약정 주행거리 조정 | residuals.km_adjustment | 1만:+0.02, 2만:0, 3만:-0.04, 4만:-0.10 |

## 7. 기간/신용 대여료 가산 (견적1 시트)

| 엑셀 셀 | 의미 | calc.js | 현재값 |
|--------|------|---------|--------|
| I21 (중신용 3%) | 신용 가산 (대여료) | residuals.credit_premium | 신용 0, 중 0.03, 저 0.05 |
| I22 (60M -3%, 48M -0.5%, 36M +5%) | 기간 가산 (대여료) | residuals.term_surcharge.by_term_code | 3: 0.05, 4: -0.005, 5: -0.03 |

## 8. 보증금 처리

| 엑셀 셀 | 의미 | calc.js | 현재값 |
|--------|------|---------|--------|
| C37 = -F13 * 0.03 * 년 | 보증금 할인율 | fees.deposit_discount_rate | 0.03 |
| F13 (보증금 한도) | min/max | deposit_buckets | step 500k, max 7,500k |

## 9. 영업 필수 항목 (영업자가 매번 선택)

| 항목 | 엑셀 위치 | 영업자 디폴트 (권장) |
|------|---------|---------------------|
| 블랙박스 | F9 = 견적서_고객!BC17 | 딥플라이 DF7 (175,000) |
| 썬팅 | F10 = 견적서_고객!BC15 | 루마 GG 전면 (105,000) |
| 탁송 | I18 = 견적서_고객!BC13 | 서울 광역시 (99,000) |

## v5.5 변경 이력 (v4.5 → v5.5)

| 변경점 | 이전 | v5.5 | 영향 |
|--------|------|------|------|
| 중신용 profit | 0.035 | 0.041 | 모든 중신용 견적 +1.5% |
| 1차탁송료 | 300,000 | 500,000 | 모든 견적 +3,333원/월 |
| (확인필요) 포터 보험 | 1,400,000 | 2,000,000? | 포터 견적만 영향 |
