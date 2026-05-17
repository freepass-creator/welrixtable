"""차량DB 매칭 v2 — 더 강력한 정규화로 전체 그림 보기"""
import json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/excel_db.json', 'r', encoding='utf-8') as f:
    excel = json.load(f)
with open('_audit/inline_db.json', 'r', encoding='utf-8') as f:
    inline = json.load(f)

# === 트림명 영문↔한글 ===
TRIM_KO_EN = {
    '스마트': 'Smart', '모던': 'Modern', '인스퍼레이션': 'Inspiration',
    '프리미엄': 'Premium', '익스클루시브': 'Exclusive', '캘리그래피': 'Calligraphy',
    '캘리그래피 블랙': 'Calligraphy Black', '캘리그래피 우드': 'Calligraphy Wood',
    '아너스': 'Honors', '르블랑': 'Le Blanc',
    '프레스티지': 'Prestige', '노블레스': 'Noblesse', '시그니처': 'Signature',
    '트렌디': 'Trendy', '베스트 셀렉션': 'Best Selection',
    '디 에센셜': 'Essential', 'N 라인': 'N Line', 'N': 'N',
    '모던 라이트': 'Modern Lite', '노블레스 라이트': 'Noblesse Lite',
    '플래티넘': 'Platinum', '마스터즈': 'Masters',
    '베스트': 'Best',
}
TRIM_EN_KO = {v: k for k, v in TRIM_KO_EN.items()}

# === 모델 접두사 정리 ===
MODEL_PREFIXES = ['더 뉴 ', '디 올 뉴 ', '디 엣지 ', '디 ', '올 뉴 ', '신형 ']
def strip_model_prefix(s):
    if not s: return s
    s = str(s)
    # 트림명 정규화에도 사용
    for p in MODEL_PREFIXES:
        if s.startswith(p):
            return s[len(p):]
    return s

def normalize_trim(s):
    """트림명 정규화 - 한글로 통일"""
    if not s: return ''
    s = s.strip()
    # 영문 트림을 한글로
    for en, ko in TRIM_EN_KO.items():
        if en in s:
            s = s.replace(en, ko)
    return s

def detail_contains_trim(detail, trim_name):
    """detail 텍스트에 트림명이 들어있는지 (한글/영문 모두)"""
    if trim_name in detail: return True
    en = TRIM_KO_EN.get(trim_name)
    if en and en in detail: return True
    return False

ENG = ['1.0','1.4','1.5','1.6','1.7','2.0','2.2','2.4','2.5','3.0','3.3','3.5','5.0']
FUEL_KW = ['하이브리드','HEV','가솔린','LPG','LPi','디젤','전기']

def get_engine(s):
    s = s or ''
    for e in ENG:
        if e in s: return e
    return None

def get_fuel(s):
    s = (s or '').lower()
    if 'hybrid' in s or '하이브리드' in s or 'hev' in s: return 'HEV'
    if 'gasoline' in s or '가솔린' in s: return 'GAS'
    if 'diesel' in s or '디젤' in s: return 'DSL'
    if 'lpg' in s or 'lpi' in s: return 'LPG'
    if '전기' in s or 'ev' in s: return 'EV'
    return None

def has_4wd(s):
    if not s: return False
    sl = s.lower()
    return '4wd' in sl or 'awd' in sl or 'htrac' in sl

def get_seats(s):
    if not s: return None
    m = re.search(r'(\d)인승', s)
    if m: return int(m.group(1))
    return None

def get_rental(s):
    """렌터카 전용 여부"""
    if not s: return False
    return '렌터카' in s or '렌터' in s

def get_van(s):
    if not s: return False
    return '밴' in s or 'van' in (s or '').lower()

def find_matches(it):
    brand = it['brand']
    model = strip_model_prefix(it['model'])
    variant = it['variant'] or ''
    trim_name = normalize_trim(it['name'])
    eng = get_engine(variant) or get_engine(it['name'])
    fuel = get_fuel(variant) or get_fuel(it['name'])
    wd4 = has_4wd(variant)
    seats = get_seats(variant)
    rental = get_rental(variant)
    van = get_van(variant)

    candidates = []
    for ex in excel:
        if ex['brand'] != brand: continue
        det = ex['detail']
        det_clean = strip_model_prefix(det)
        # 모델명 비교 (정규화)
        if model and model not in det and model not in det_clean:
            continue
        # 트림명
        if not detail_contains_trim(det, trim_name):
            continue
        # 엔진 배기량
        ex_eng = get_engine(det)
        if eng and ex_eng and eng != ex_eng:
            continue
        # 연료
        ex_fuel = get_fuel(det)
        if fuel and ex_fuel and fuel != ex_fuel:
            continue
        # 4WD
        ex_4wd = has_4wd(det)
        if wd4 != ex_4wd:
            continue
        # 인승 (variant에 명시되어 있다면 일치 필요)
        ex_seats = get_seats(det)
        if seats and ex_seats and seats != ex_seats:
            continue
        # 렌터카 - 양쪽 일치
        ex_rental = get_rental(det)
        if rental != ex_rental:
            continue
        # 밴
        ex_van = get_van(det)
        if van != ex_van:
            continue
        score = 10
        if eng and eng == ex_eng: score += 5
        if fuel and fuel == ex_fuel: score += 5
        # 트림명이 detail의 끝부분에 있을수록 매칭 좋음
        idx = det.rfind(trim_name) if trim_name in det else (det.rfind(TRIM_KO_EN.get(trim_name, trim_name)))
        score += (idx / len(det)) * 3
        # 라이트/블랙 등 suffix 정확 매칭
        if 'Lite' in trim_name or '라이트' in trim_name:
            if not ('Lite' in det or '라이트' in det): score -= 100
        if 'Black' in trim_name or '블랙' in trim_name:
            if not ('Black' in det or '블랙' in det): score -= 100
        candidates.append((ex, score))
    if not candidates: return []
    candidates.sort(key=lambda x: -x[1])
    top = candidates[0][1]
    return [c[0] for c in candidates if c[1] == top]

# === 매칭 실행 ===
excel_matched = set()
matched = []
ambiguous = []
unmatched = []

for it in inline:
    cands = find_matches(it)
    if not cands:
        unmatched.append(it)
    elif len(cands) == 1:
        ex = cands[0]
        # detail+price 키로 중복 매칭 방지용
        key = ex['detail']
        excel_matched.add(key)
        diff = ex['price'] - it['p5']
        matched.append({**it, 'excel_detail': ex['detail'], 'excel_price': ex['price'],
                        'diff': diff, 'excel_r24': ex['r24'], 'excel_r36': ex['r36'],
                        'excel_r48': ex['r48'], 'excel_r60': ex['r60'],
                        'excel_buyback': ex.get('buyback_apply')})
    else:
        ambiguous.append({**it, 'cands': [{'detail': c['detail'], 'price': c['price']} for c in cands]})

print('=== 매칭 결과 v2 ===')
print(f'  Matched (단일): {len(matched)}')
print(f'  Ambiguous (다중): {len(ambiguous)}')
print(f'  Unmatched (인라인에만): {len(unmatched)}')
print(f'  Excel only (엑셀에만): {len(excel) - len(excel_matched)}')

def is_grandeur(m): return (m.get('model') or '') == '그랜저'

diffs = [m for m in matched if m['diff'] != 0 and not is_grandeur(m)]
grandeur_all = [m for m in matched if is_grandeur(m)]
zero = [m for m in matched if m['diff'] == 0]

print(f'\n=== 일치 ({len(zero)}건) ===')
from collections import Counter
for k, v in Counter((m['brand'], m['model']) for m in zero).most_common():
    print(f'  {k[0]} {k[1]}: {v}')

print(f'\n=== 그랜저 ({len(grandeur_all)}건, 페이스리프트 전후 비교) ===')
for m in grandeur_all:
    print(f"  {m['variant'][:18]:<18} {m['name']:<10}: 인라인(FL후) {m['p5']:>10,} / 엑셀(FL전) {m['excel_price']:>10,} (Δ {m['diff']:+,})")

print(f'\n=== ★ 가격 차이 있는 매칭 ({len(diffs)}건, 그랜저 제외) ===')
diffs.sort(key=lambda m: (m['brand'], m['model'] or '', m['variant'] or '', m['name']))
for m in diffs:
    v = (m['variant'] or '')[:22]
    name = m['name'][:14]
    sign = '★' if abs(m['diff']) >= 1000000 else ''
    print(f"  [{m['brand']:<4}] {(m['model'] or ''):<10} | {v:<22} | {name:<14}: "
          f"{m['p5']:>10,} → {m['excel_price']:>10,} (Δ {m['diff']:+,}) {sign}")

print(f'\n=== 모호 매칭 ({len(ambiguous)}건, 상위 10) ===')
for m in ambiguous[:10]:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,}):")
    for c in m['cands'][:3]:
        print(f"     · {c['detail']} ({c['price']:,})")

print(f'\n=== 매칭 안 된 인라인 트림 ({len(unmatched)}건, 상위 30) ===')
for m in unmatched[:30]:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,})")

# 차이 패턴 분류
print(f'\n=== 차이 패턴 분류 ===')
pat = Counter()
for m in diffs:
    pat[m['diff']] += 1
for d, c in sorted(pat.items(), key=lambda x: -abs(x[0])):
    print(f'  {d:+,} 차이: {c}건')

with open('_audit/diff_report_v2.json', 'w', encoding='utf-8') as f:
    json.dump({
        'matched_diffs': diffs,
        'grandeur_all': grandeur_all,
        'ambiguous': ambiguous,
        'unmatched_inline': unmatched,
        'all_matched': matched,
    }, f, ensure_ascii=False, indent=1)
