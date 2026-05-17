"""인라인 VEHICLE_DB의 base_price_5를 엑셀(=카눈) 가격으로 일괄 수정.

전략:
- _audit/diff_report_v2.json 의 matched_diffs 사용
- 그랜저(페이스리프트 후 인라인 → 엑셀 페이스리프트 전 무시) 제외
- 각 트림의 base_price_5 만원 단위로 변경
- base_price_3_5 는 엑셀에 없으므로 동일 비율로 자동 조정 (5% → 3.5% 비율 유지)
- car-master JSON 도 함께 업데이트하지만, 그건 별도 단계
"""
import json, re, sys, io, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/diff_report_v2.json', 'r', encoding='utf-8') as f:
    report = json.load(f)

diffs = report['matched_diffs']
# 그랜저는 별도 처리 (FL 이슈)
diffs = [d for d in diffs if (d.get('model') or '') != '그랜저']
print(f'수정 대상: {len(diffs)}건')

# index.html 백업 + 읽기
shutil.copy('index.html', '_audit/index.html.bak')
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 각 diff에 대해 인라인의 해당 트림 라인을 찾아 base_price_5/base_price_3_5 교체
# 매칭 키: trim_id + name 이 유니크하지 않을 수 있으므로 brand+model+variant 까지 좁혀야 함.
# 인라인 텍스트에서 model_name 위치를 anchor로 사용

start = html.find('const VEHICLE_DB = {')
end_markers = ['\n  const $ = (id)', '\nconst $ = (id)', '\nfunction setExtSwatch', '\nfunction state(']
end = -1
for m in end_markers:
    e = html.find(m, start)
    if e > 0 and (end < 0 or e < end):
        end = e
if end < 0: end = start + 600000
db_block = html[start:end]
prefix = html[:start]
suffix = html[end:]

# brand/model/variant 별 (start,end) 범위 계산
brand_positions = [(m.start(), m.group(1)) for m in re.finditer(r'manufacturer_name:\s*"([^"]+)"', db_block)]
model_positions = [(m.start(), m.group(1)) for m in re.finditer(r'model_name:\s*"([^"]+)"', db_block)]
variant_positions = [(m.start(), m.group(1)) for m in re.finditer(r'variant_name:\s*"([^"]+)"', db_block)]

def find_section(positions, anchor_pos):
    """anchor_pos 직전의 라스트 매칭"""
    candidates = [p for p in positions if p[0] <= anchor_pos]
    return candidates[-1] if candidates else None

# 인라인의 모든 트림 위치 (trim_id 부터 base_price_5 까지)
trim_positions = []
for m in re.finditer(r'trim_id:\s*"([^"]+)"', db_block):
    pos = m.start()
    next_trim_m = re.search(r'trim_id:\s*"', db_block[pos+10:pos+2000])
    chunk_end = pos + 10 + next_trim_m.start() if next_trim_m else pos + 1500
    chunk = db_block[pos:chunk_end]
    name_m = re.search(r'name:\s*"([^"]+)"', chunk)
    p5_m = re.search(r'base_price_5:\s*([\d.]+)', chunk)
    p35_m = re.search(r'base_price_3_5:\s*([\d.]+)', chunk)
    if not (name_m and p5_m): continue
    b = find_section(brand_positions, pos)
    mo = find_section(model_positions, pos)
    v = find_section(variant_positions, pos)
    trim_positions.append({
        'pos': pos,
        'chunk_end': chunk_end,
        'brand': b[1] if b else None,
        'model': mo[1] if mo else None,
        'variant': v[1] if v else None,
        'trim_id': m.group(1),
        'name': name_m.group(1),
        'p5_old': int(float(p5_m.group(1)) * 10000),
        'p35_old': int(float(p35_m.group(1)) * 10000) if p35_m else None,
        'p5_str_start': pos + p5_m.start(),
        'p5_str_end': pos + p5_m.end(),
        'p5_str_value': p5_m.group(1),
        'p35_str_start': pos + p35_m.start() if p35_m else None,
        'p35_str_end': pos + p35_m.end() if p35_m else None,
        'p35_str_value': p35_m.group(1) if p35_m else None,
    })

print(f'인라인 트림 인덱스: {len(trim_positions)}')

# 수정 대상 매칭: diff 의 brand+model+variant+name 으로 trim_positions 검색
def match_trim(diff):
    cands = []
    for t in trim_positions:
        if t['brand'] != diff['brand']: continue
        if t['model'] != diff['model']: continue
        if (t.get('variant') or '') != (diff.get('variant') or ''): continue
        if t['name'] != diff['name']: continue
        cands.append(t)
    return cands

# 교체할 위치 수집 (역순 적용)
replacements = []  # (start, end, new_str)
not_found = []
multi_match = []

for diff in diffs:
    matches = match_trim(diff)
    if not matches:
        not_found.append(diff)
        continue
    if len(matches) > 1:
        multi_match.append((diff, matches))
        continue
    t = matches[0]
    # 새 가격: 만원 단위
    new_p5_man = diff['excel_price'] // 10000
    # p35 비율 유지: p5_old:p35_old = new_p5:new_p35
    if t['p35_old'] and t['p5_old']:
        ratio = t['p35_old'] / t['p5_old']
        new_p35_man = int(round(new_p5_man * ratio))
    else:
        new_p35_man = new_p5_man
    # base_price_5: NNN -> 새값
    new_str_p5 = f'base_price_5: {new_p5_man}'
    replacements.append((t['p5_str_start'], t['p5_str_end'], new_str_p5))
    if t['p35_str_start']:
        new_str_p35 = f'base_price_3_5: {new_p35_man}'
        replacements.append((t['p35_str_start'], t['p35_str_end'], new_str_p35))

print(f'교체 예정: {len(replacements)//2}건 (p5+p35 페어)')
print(f'못 찾음: {len(not_found)}건')
print(f'다중 매칭: {len(multi_match)}건')

if not_found:
    print('\n=== 못 찾은 트림 (수정 안 됨) ===')
    for d in not_found[:10]:
        print(f"  {d['brand']} {d['model']} {d.get('variant')} {d['name']}")

if multi_match:
    print('\n=== 다중 매칭 (수정 안 됨) ===')
    for d, ms in multi_match[:5]:
        print(f"  {d['brand']} {d['model']} {d.get('variant')} {d['name']} -- {len(ms)} matches")

# 역순 적용
replacements.sort(key=lambda r: -r[0])
new_db = db_block
for s, e, new in replacements:
    new_db = new_db[:s] + new + new_db[e:]

# 미리보기: 변경된 부분 일부 출력
print('\n=== 변경 미리보기 (앞 5건) ===')
for diff in diffs[:5]:
    matches = match_trim(diff)
    if matches:
        t = matches[0]
        new_p5_man = diff['excel_price'] // 10000
        print(f"  {t['brand']} {t['model']} {t.get('variant')} {t['name']}: "
              f"{t['p5_old']//10000:>5}만 → {new_p5_man:>5}만 (Δ {(diff['excel_price']-t['p5_old']):+,})")

# 파일 쓰기
new_html = prefix + new_db + suffix
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
print(f'\n✅ index.html 수정 완료 (백업: _audit/index.html.bak)')

# 결과 검증 - 다시 추출해서 일치 확인
import subprocess
print('\n=== 사후 검증: 다시 추출해서 매칭 ===')
