"""인라인 매칭 결과 기반으로 vehicles.json 잔가율 강력 sync.

diff_report_v4.json 의 all_matched 항목 (인라인 트림 ↔ 엑셀 차량DB 매칭됨)을 활용해
같은 brand+model+trim_name 의 vehicles.json 항목에 엑셀 잔가율을 적용.
"""
import json, sys, io, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/diff_report_v4.json', 'r', encoding='utf-8') as f:
    report = json.load(f)
with open('src/data/vehicles.json', 'r', encoding='utf-8') as f:
    veh = json.load(f)

# 토큰화: variant 안의 키워드를 변량 매칭에 사용 ('하이브리드', '1.6', '2WD' 등)
def variant_tokens(s):
    s = s or ''
    tokens = []
    for kw in ['하이브리드','HEV','가솔린','LPG','LPi','디젤','전기',
              '1.0','1.4','1.5','1.6','1.7','2.0','2.2','2.4','2.5','3.0','3.3','3.5','3.8','5.0',
              '2WD','4WD','AWD','HTRAC',
              '터보','승용','승합','밴','일반판매','렌터카']:
        if kw in s: tokens.append(kw)
    sl = s.lower()
    if 'hybrid' in sl: tokens.append('하이브리드')
    if 'gasoline' in sl: tokens.append('가솔린')
    return tokens

# 인라인 매칭된 항목별로 vehicles.json 찾기
updated = 0
not_found = []

for m in report['all_matched']:
    if (m.get('model') or '') == '그랜저': continue  # FL 후 가격 별도
    if m.get('excel_r60') is None: continue

    brand = m['brand']
    model = m['model']
    trim_name = m['name']
    variant = m.get('variant') or ''
    v_tokens = variant_tokens(variant)

    # vehicles.json 에서 후보 찾기
    cands = []
    for v in veh:
        if v.get('brand') != brand: continue
        trim_full = v.get('trim') or ''
        if model not in trim_full: continue
        if trim_name not in trim_full: continue
        # variant 토큰 매칭 점수
        score = sum(1 for t in v_tokens if t in trim_full)
        cands.append((v, score))

    if not cands:
        not_found.append(m); continue

    # 가장 점수 높은 후보 선택
    cands.sort(key=lambda x: -x[1])
    target = cands[0][0]

    # 잔가율 + 인수가율 업데이트
    changed = False
    for field, ex_key in [('r24','excel_r24'),('r36','excel_r36'),('r48','excel_r48'),('r60','excel_r60')]:
        new_val = m.get(ex_key)
        if new_val is not None and round(target.get(field, 0) or 0, 4) != round(new_val, 4):
            target[field] = new_val
            changed = True
    # buyback_apply 는 인라인 매칭 결과에 없음 — 엑셀 P 컬럼은 strategic, O 컬럼이 buyback. 일단 패스
    if changed:
        updated += 1

print(f'매칭된 인라인 트림 (그랜저 제외): {len([x for x in report["all_matched"] if (x.get("model") or "") != "그랜저"])}')
print(f'vehicles.json 업데이트: {updated}건')
print(f'vehicles.json 미매칭: {len(not_found)}건')

if not_found:
    print()
    print('=== 매칭 안 됨 (상위 10) ===')
    for m in not_found[:10]:
        print(f"  {m['brand']} {m['model']} ({m.get('variant') or ''}) {m['name']}")

# 백업 + 저장
shutil.copy('src/data/vehicles.json', '_audit/vehicles.json.bak2')
with open('src/data/vehicles.json', 'w', encoding='utf-8') as f:
    json.dump(veh, f, ensure_ascii=False, indent=2)
print(f'\n✅ vehicles.json 저장 (백업: _audit/vehicles.json.bak2)')
