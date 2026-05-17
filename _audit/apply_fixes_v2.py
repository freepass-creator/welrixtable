"""v4 결과 일괄 적용:
1. matched_diffs 19건 자동 가격 수정 (그랜저 제외)
2. unmatched 74건을 '진짜 엑셀 부재' vs '엑셀 존재 매칭누락'으로 분류
3. '진짜 엑셀 부재'에 해당하는 인라인 트림에 operating: false 플래그 추가
4. '매칭 누락'은 별도 리포트 → 사용자 검토 후 수동 처리
"""
import json, re, sys, io, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/diff_report_v4.json', 'r', encoding='utf-8') as f:
    report = json.load(f)
with open('_audit/excel_db.json', 'r', encoding='utf-8') as f:
    excel = json.load(f)

# ========== STEP 1: 19건 가격 자동 수정 ==========
diffs = [d for d in report['matched_diffs'] if (d.get('model') or '') != '그랜저']
print(f'[1] 가격 수정 대상: {len(diffs)}건')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start = html.find('const VEHICLE_DB = {')
end_markers = ['\n  const $ = (id)', '\nconst $ = (id)', '\nfunction setExtSwatch']
end = -1
for m in end_markers:
    e = html.find(m, start)
    if e > 0 and (end < 0 or e < end): end = e
if end < 0: end = start + 600000
db_block = html[start:end]

brand_re = re.compile(r'manufacturer_name:\s*"([^"]+)"')
model_re = re.compile(r'model_name:\s*"([^"]+)"')
variant_re = re.compile(r'variant_name:\s*"([^"]+)"')

trim_positions = []
for m in re.finditer(r'trim_id:\s*"([^"]+)"', db_block):
    pos = m.start()
    nx = re.search(r'trim_id:\s*"', db_block[pos+10:pos+2000])
    chunk_end = pos + 10 + nx.start() if nx else pos + 1500
    chunk = db_block[pos:chunk_end]
    name_m = re.search(r'name:\s*"([^"]+)"', chunk)
    p5_m = re.search(r'base_price_5:\s*([\d.]+)', chunk)
    p35_m = re.search(r'base_price_3_5:\s*([\d.]+)', chunk)
    if not (name_m and p5_m): continue
    bp = list(brand_re.finditer(db_block[:pos]))
    mp = list(model_re.finditer(db_block[:pos]))
    vp = list(variant_re.finditer(db_block[:pos]))
    trim_positions.append({
        'pos': pos,
        'chunk_end': chunk_end,
        'brand': bp[-1].group(1) if bp else None,
        'model': mp[-1].group(1) if mp else None,
        'variant': vp[-1].group(1) if vp else None,
        'trim_id': m.group(1),
        'name': name_m.group(1),
        'p5_old': int(float(p5_m.group(1)) * 10000),
        'p35_old': int(float(p35_m.group(1)) * 10000) if p35_m else None,
        'p5_str_start': pos + p5_m.start(),
        'p5_str_end': pos + p5_m.end(),
        'p35_str_start': pos + p35_m.start() if p35_m else None,
        'p35_str_end': pos + p35_m.end() if p35_m else None,
    })

def match_trim(diff):
    return [t for t in trim_positions
            if t['brand'] == diff['brand']
            and t['model'] == diff['model']
            and (t.get('variant') or '') == (diff.get('variant') or '')
            and t['name'] == diff['name']]

replacements = []
for diff in diffs:
    matches = match_trim(diff)
    if len(matches) != 1: continue
    t = matches[0]
    new_p5_man = diff['excel_price'] // 10000
    ratio = t['p35_old'] / t['p5_old'] if (t['p35_old'] and t['p5_old']) else 1
    new_p35_man = int(round(new_p5_man * ratio))
    replacements.append((t['p5_str_start'], t['p5_str_end'], f'base_price_5: {new_p5_man}'))
    if t['p35_str_start']:
        replacements.append((t['p35_str_start'], t['p35_str_end'], f'base_price_3_5: {new_p35_man}'))

replacements.sort(key=lambda r: -r[0])
new_db = db_block
for s, e, new in replacements:
    new_db = new_db[:s] + new + new_db[e:]
print(f'    → 적용 완료: {len(replacements)//2}건')

# ========== STEP 2: unmatched 분류 ==========
unmatched = report['unmatched_inline']

# 엑셀 detail 정규화 — 트림명/모델명이 들어있는지 거친 검색
def excel_has(brand, model, trim_name, fuel=None, eng=None):
    """엑셀에 brand+model+trim_name 조합이 존재하는가 (정규식 거친 검색)"""
    candidates = [e for e in excel if e['brand'] == brand]
    if model:
        # 모델명 정규화
        m_short = model
        candidates = [e for e in candidates if m_short in e['detail']]
    matches = []
    for c in candidates:
        det = c['detail']
        # 트림명 (한/영/로마숫자 정규화)
        norm_trim = trim_name.replace('Ⅰ','1').replace('Ⅱ','2').replace('Ⅲ','3')
        norm_det = det.replace('Ⅰ','1').replace('Ⅱ','2').replace('Ⅲ','3')
        # 영문 대응
        en_map = {'스마트':'Smart','모던':'Modern','인스퍼레이션':'Inspiration',
                  '프리미엄':'Premium','익스클루시브':'Exclusive','캘리그래피':'Calligraphy',
                  '아너스':'Honors','프레스티지':'Prestige','노블레스':'Noblesse',
                  '시그니처':'Signature','트렌디':'Trendy','베스트 셀렉션':'Best Selection',
                  '플래티넘':'Platinum','마스터즈':'Masters','스탠다드':'Standard'}
        # 띄어쓰기 무시
        if norm_trim in norm_det: matches.append(c); continue
        if norm_trim.replace(' ','') in norm_det.replace(' ',''): matches.append(c); continue
        for ko, en in en_map.items():
            if ko in norm_trim and en in det: matches.append(c); break
    return matches

really_absent = []   # 엑셀에 진짜 없음 → 비활성화
match_missed = []    # 엑셀에 있는데 매칭 못 잡음 → 검토 필요

for it in unmatched:
    cands = excel_has(it['brand'], it['model'], it['name'])
    if cands:
        match_missed.append({**it, 'excel_candidates': [{'detail': c['detail'], 'price': c['price']} for c in cands[:3]]})
    else:
        really_absent.append(it)

print(f'\n[2] Unmatched 분류:')
print(f'    엑셀에 진짜 없음 (비활성화 대상): {len(really_absent)}건')
print(f'    엑셀에 있지만 매칭 누락 (검토 필요): {len(match_missed)}건')

# ========== STEP 3: '진짜 부재' 인라인 트림에 operating: false 추가 ==========
def find_trim_chunk(it):
    """인라인 텍스트에서 해당 트림 객체의 시작 위치"""
    for t in trim_positions:
        if (t['brand'] == it['brand']
            and t['model'] == it['model']
            and (t.get('variant') or '') == (it.get('variant') or '')
            and t['name'] == it['name']):
            return t
    return None

# operating: false 를 trim 객체의 첫 번째 필드(trim_id) 바로 뒤에 삽입
# 패턴: { trim_id: "X", name: ...  →  { trim_id: "X", operating: false, name: ...

inserts = []  # (position_in_new_db, text)
not_found = []

# 새 db_block 기준으로 다시 위치 인덱스 (이미 가격 수정됐으니까 좌표가 변경됐을 수 있음)
# 안전을 위해 trim_id 별 위치 다시 찾기
new_trim_positions = []
for m in re.finditer(r'trim_id:\s*"([^"]+)"', new_db):
    pos = m.start()
    nx = re.search(r'trim_id:\s*"', new_db[pos+10:pos+2000])
    chunk_end = pos + 10 + nx.start() if nx else pos + 1500
    chunk = new_db[pos:chunk_end]
    name_m = re.search(r'name:\s*"([^"]+)"', chunk)
    if not name_m: continue
    bp = list(brand_re.finditer(new_db[:pos]))
    mp = list(model_re.finditer(new_db[:pos]))
    vp = list(variant_re.finditer(new_db[:pos]))
    # trim_id 종료(닫는 ")) 위치 = m.end()
    new_trim_positions.append({
        'pos': pos,
        'trim_id_end': m.end(),  # ":" 까지
        'brand': bp[-1].group(1) if bp else None,
        'model': mp[-1].group(1) if mp else None,
        'variant': vp[-1].group(1) if vp else None,
        'trim_id': m.group(1),
        'name': name_m.group(1),
    })

# trim_id: "X" 의 닫는 따옴표 위치 정확히 찾기
def trim_id_close_pos(start):
    """start (= trim_id 매치의 시작) 부터 '" 까지의 다음 인덱스"""
    # 패턴: trim_id: "값",   닫는 따옴표 찾기
    m = re.search(r'trim_id:\s*"[^"]*"', new_db[start:start+200])
    if not m: return None
    return start + m.end()  # ", " 직전 (실제로는 " 끝)

for it in really_absent:
    cand = None
    for t in new_trim_positions:
        if (t['brand'] == it['brand']
            and t['model'] == it['model']
            and (t.get('variant') or '') == (it.get('variant') or '')
            and t['name'] == it['name']):
            cand = t; break
    if not cand:
        not_found.append(it); continue
    insert_pos = trim_id_close_pos(cand['pos'])
    if insert_pos is None:
        not_found.append(it); continue
    inserts.append((insert_pos, ', operating: false'))

# 역순 적용
inserts.sort(key=lambda x: -x[0])
for pos, text in inserts:
    new_db = new_db[:pos] + text + new_db[pos:]

print(f'    → operating:false 추가: {len(inserts)}건 (못 찾음: {len(not_found)})')

# ========== 저장 ==========
shutil.copy('index.html', '_audit/index.html.bak2')
final_html = html[:start] + new_db + html[end:]
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)
print(f'\n✅ index.html 저장 (백업: _audit/index.html.bak2)')

# ========== 분류 리포트 저장 ==========
with open('_audit/unmatched_classification.json', 'w', encoding='utf-8') as f:
    json.dump({
        'really_absent_in_excel': really_absent,
        'match_missed': match_missed,
        'apply_failures': not_found,
    }, f, ensure_ascii=False, indent=1)

print(f'\n=== 진짜 엑셀 부재 (비활성화됨, 상위 30) ===')
from collections import Counter
print('차종 분포:')
for k, v in Counter((m['brand'], m['model']) for m in really_absent).most_common():
    print(f'  {k[0]} {k[1]}: {v}')

print(f'\n=== 엑셀에 있는데 매칭 누락 ({len(match_missed)}건, 검토 필요) ===')
for m in match_missed:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant', '')[:20]} {m['name']} ({m['p5']:,})")
    for c in m['excel_candidates'][:2]:
        print(f"       후보: {c['detail']} ({c['price']:,})")
