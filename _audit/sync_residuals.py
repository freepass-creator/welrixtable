"""vehicles.json 의 r24/r36/r48/r60/buyback_apply 를 엑셀 차량DB 기준으로 sync.

매칭 키: vehicles.json 의 'trim' (전체 표기) ↔ 엑셀 'detail'
같은 trim 텍스트가 직접 일치하는 경우 그대로 사용, 일부 차이는 정규화 후 fuzzy 매칭.
"""
import json, sys, io, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/excel_db.json', 'r', encoding='utf-8') as f:
    excel = json.load(f)
with open('src/data/vehicles.json', 'r', encoding='utf-8') as f:
    veh = json.load(f)

print(f'엑셀: {len(excel)} / vehicles.json: {len(veh)}')

# 엑셀 detail 정규화 — 매칭 키 만들기
def normalize(s):
    if not s: return ''
    s = str(s)
    # 영문 → 한글
    en_ko = {
        'Smart': '스마트', 'Modern Lite': '모던 라이트', 'Modern': '모던',
        'Inspiration': '인스퍼레이션', 'Premium': '프리미엄',
        'Exclusive': '익스클루시브', 'Calligraphy': '캘리그래피',
        'Honors': '아너스', 'Le Blanc': '르블랑', 'Prestige': '프레스티지',
        'Noblesse Lite': '노블레스 라이트', 'Noblesse': '노블레스',
        'Signature': '시그니처', 'Trendy': '트렌디',
        'Best Selection': '베스트 셀렉션', 'Platinum': '플래티넘',
        'Masters': '마스터즈', 'Black Exterior': '블랙 익스테리어',
        'Black Ink': '블랙 잉크', 'Black': '블랙', 'Standard': '스탠다드',
    }
    for en, ko in en_ko.items():
        s = s.replace(en, ko)
    # 차종명 접두사 정리
    for p in ['더 뉴 ', '디 올 뉴 ', '디 엣지 ', '올 뉴 ', '신형 ']:
        if s.startswith(p): s = s[len(p):]
    # 로마숫자 → 아라비아
    s = s.replace('Ⅰ','1').replace('Ⅱ','2').replace('Ⅲ','3')
    # 공백 정리
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# 엑셀 항목 인덱싱 (정규화된 detail 으로)
excel_by_norm = {}
for e in excel:
    key = normalize(e['detail'])
    excel_by_norm.setdefault(key, []).append(e)

# vehicles.json의 trim 항목별로 엑셀 매칭
def find_excel(v):
    trim = v.get('trim') or ''
    norm_trim = normalize(trim)
    # 1차: 정확 매칭
    if norm_trim in excel_by_norm:
        cands = excel_by_norm[norm_trim]
        if len(cands) == 1: return cands[0]
    # 2차: 부분 매칭 (vehicles 의 trim 이 엑셀 detail 에 포함되거나 그 역)
    candidates = []
    for e in excel:
        if e['brand'] != v.get('brand'): continue
        ne = normalize(e['detail'])
        # 양방향 포함 비교
        if norm_trim == ne: candidates.append((e, 100))
        elif norm_trim in ne or ne in norm_trim: candidates.append((e, 80))
        else:
            # 토큰 기반 매칭
            tk_v = set(norm_trim.split())
            tk_e = set(ne.split())
            inter = tk_v & tk_e
            if len(inter) >= 3:
                candidates.append((e, len(inter)))
    if not candidates: return None
    candidates.sort(key=lambda x: -x[1])
    return candidates[0][0]

matched_count = 0
updated_count = 0
not_found = []
no_change = 0

for v in veh:
    e = find_excel(v)
    if not e:
        not_found.append(v); continue
    matched_count += 1
    # 잔가율, 인수가율, 그룹, 면세, 다인승 sync
    changes = {}
    if e.get('r24') is not None and round(v.get('r24', 0), 4) != round(e['r24'], 4):
        changes['r24'] = (v.get('r24'), e['r24'])
    if e.get('r36') is not None and round(v.get('r36', 0), 4) != round(e['r36'], 4):
        changes['r36'] = (v.get('r36'), e['r36'])
    if e.get('r48') is not None and round(v.get('r48', 0), 4) != round(e['r48'], 4):
        changes['r48'] = (v.get('r48'), e['r48'])
    if e.get('r60') is not None and round(v.get('r60', 0), 4) != round(e['r60'], 4):
        changes['r60'] = (v.get('r60'), e['r60'])
    bp = e.get('buyback_apply')
    if bp is not None and round(v.get('buyback_apply', 0) or 0, 4) != round(bp, 4):
        changes['buyback_apply'] = (v.get('buyback_apply'), bp)

    if changes:
        for k in ['r24','r36','r48','r60','buyback_apply']:
            if e.get(k) is not None:
                v[k] = e[k]
        updated_count += 1

print(f'매칭: {matched_count} / vehicles.json 미매칭: {len(not_found)}')
print(f'잔가율/인수가율 업데이트: {updated_count}건')
print()
if not_found:
    print('=== 매칭 안 됨 (상위 15) ===')
    for v in not_found[:15]:
        print(f"  {v.get('brand')} {v.get('trim')}")

# 백업 + 저장
shutil.copy('src/data/vehicles.json', '_audit/vehicles.json.bak')
with open('src/data/vehicles.json', 'w', encoding='utf-8') as f:
    json.dump(veh, f, ensure_ascii=False, indent=2)
print(f'\n✅ vehicles.json 저장 (백업: _audit/vehicles.json.bak)')
