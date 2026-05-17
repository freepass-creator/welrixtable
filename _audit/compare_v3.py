"""차량DB 매칭 v3 — 인승 디폴트, suffix 트림, 제네시스/포터 지원"""
import json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/excel_db.json', 'r', encoding='utf-8') as f:
    excel = json.load(f)
with open('_audit/inline_db.json', 'r', encoding='utf-8') as f:
    inline = json.load(f)

TRIM_EN_KO = {
    'Smart': '스마트', 'Modern': '모던', 'Inspiration': '인스퍼레이션',
    'Premium': '프리미엄', 'Exclusive': '익스클루시브', 'Calligraphy': '캘리그래피',
    'Honors': '아너스', 'Le Blanc': '르블랑', 'Prestige': '프레스티지',
    'Noblesse': '노블레스', 'Signature': '시그니처', 'Trendy': '트렌디',
    'Best Selection': '베스트 셀렉션', 'Essential': '디 에센셜',
    'N Line': 'N 라인', 'Modern Lite': '모던 라이트', 'Noblesse Lite': '노블레스 라이트',
    'Platinum': '플래티넘', 'Masters': '마스터즈', 'Best': '베스트',
    'Black Exterior': '블랙 익스테리어', 'Black Ink': '블랙 잉크',
    'Black': '블랙',
}
TRIM_KO_EN = {v: k for k, v in TRIM_EN_KO.items()}

# 차종명 alias (엑셀 표기 vs 우리 표기)
MODEL_ALIASES = {
    '캐스퍼 일렉트릭': '캐스퍼 EV',
}
MODEL_PREFIXES = ['더 뉴 ', '디 올 뉴 ', '디 엣지 ', '디 ', '올 뉴 ', '신형 ',
                  'The new ', 'The All New ', 'The New ', 'All New ', 'New ']

def strip_prefix(s):
    if not s: return s
    s = str(s)
    for p in MODEL_PREFIXES:
        if s.startswith(p):
            return s[len(p):]
    return s

def normalize_text(s):
    """텍스트 정규화 (영문 → 한글, 별명 통일)"""
    if not s: return ''
    s = strip_prefix(s)
    for en, ko in TRIM_EN_KO.items():
        s = s.replace(en, ko)
    return s

def contains_trim(detail, trim_name):
    """detail 에 트림명 포함 (한/영 모두)"""
    norm_det = normalize_text(detail)
    norm_trim = normalize_text(trim_name)
    if norm_trim in norm_det: return True
    if trim_name in detail: return True
    en = TRIM_KO_EN.get(trim_name)
    if en and en in detail: return True
    return False

ENG = ['1.0','1.4','1.5','1.6','1.7','2.0','2.2','2.4','2.5','3.0','3.3','3.5','5.0']

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
    if '전기' in s or '전동' in s: return 'EV'
    return None

def has_4wd(s):
    sl = (s or '').lower()
    return '4wd' in sl or 'awd' in sl or 'htrac' in sl

def get_seats(s):
    if not s: return None
    m = re.search(r'(\d)인승', s)
    if m: return int(m.group(1))
    return None

def is_rental_only(s):
    return '렌터카' in (s or '') or '렌터 전용' in (s or '')

def is_van(s):
    return '밴' in (s or '') or 'van' in (s or '').lower()

def is_disabled(s):
    """장애인용"""
    return '장애' in (s or '')

def get_suffix_token(name):
    """트림명에 suffix 토큰 (블랙 익스테리어, 블랙 잉크, N 라인, 라이트 등)"""
    sfx = []
    norm = normalize_text(name)
    for tok in ['블랙 익스테리어', '블랙 잉크', '블랙', 'N 라인', '라이트', 'X-Line', 'X 라인']:
        if tok in norm: sfx.append(tok)
    return sfx

def normalize_trim_name(name):
    """트림명 정규화 (영문→한글, 공백/괄호 정리)"""
    if not name: return ''
    n = normalize_text(name)
    n = re.sub(r'\s+', ' ', n).strip()
    return n

def find_matches(it):
    brand = it['brand']
    model = strip_prefix(it['model']) if it['model'] else None
    variant = it['variant'] or ''
    raw_name = it['name']
    trim_name = normalize_trim_name(raw_name)

    eng = get_engine(variant) or get_engine(raw_name)
    fuel = get_fuel(variant) or get_fuel(raw_name)
    wd4 = has_4wd(variant)
    seats = get_seats(variant)
    rental = is_rental_only(variant) or is_rental_only(raw_name)
    van = is_van(variant) or is_van(model or '')
    disabled = is_disabled(variant)
    sfx = set(get_suffix_token(raw_name))

    candidates = []
    for ex in excel:
        if ex['brand'] != brand: continue
        det = ex['detail']
        det_clean = strip_prefix(det)
        det_norm = normalize_text(det)

        # 모델명 — 우리 model이 detail에 포함
        if model and model not in det and model not in det_clean and model not in det_norm:
            # K9 같은 경우 detail에 "K9_" 형태로 있을 수도
            if model.upper() not in det.upper():
                continue

        # 트림명 포함
        if not contains_trim(det, raw_name):
            continue

        # suffix 토큰 일치 (블랙 익스/N 라인 등이 한쪽에만 있으면 미스매칭)
        ex_sfx = set(get_suffix_token(det))
        if sfx != ex_sfx:
            continue

        # 배기량
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

        # 인승 — variant에 명시되면 일치 필수, 없으면 5인승 default
        ex_seats = get_seats(det)
        if seats:
            if ex_seats and seats != ex_seats:
                continue
        else:
            # variant 인승 미명시 → 5인승 default
            if ex_seats and ex_seats != 5:
                continue

        # 렌터카 — 양쪽 일치
        ex_rental = is_rental_only(det)
        if rental != ex_rental:
            continue

        # 밴
        ex_van = is_van(det)
        if van != ex_van:
            continue

        # 장애인용 — 양쪽 일치
        ex_disabled = is_disabled(det)
        if disabled != ex_disabled:
            continue

        score = 10
        if eng and eng == ex_eng: score += 5
        if fuel and fuel == ex_fuel: score += 5
        idx = det.rfind(trim_name) if trim_name in det else 0
        score += (idx / max(len(det), 1)) * 3
        if sfx & ex_sfx: score += 2
        candidates.append((ex, score))

    if not candidates: return []
    candidates.sort(key=lambda x: -x[1])
    top = candidates[0][1]
    return [c[0] for c in candidates if c[1] == top]


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
        excel_matched.add(ex['detail'])
        diff = ex['price'] - it['p5']
        matched.append({**it, 'excel_detail': ex['detail'], 'excel_price': ex['price'],
                        'diff': diff, 'excel_r24': ex['r24'], 'excel_r36': ex['r36'],
                        'excel_r48': ex['r48'], 'excel_r60': ex['r60']})
    else:
        ambiguous.append({**it, 'cands': [{'detail': c['detail'], 'price': c['price']} for c in cands]})

print('=== 매칭 결과 v3 ===')
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

print(f'\n=== ★ 새로 발견된 가격 차이 ({len(diffs)}건) ===')
diffs.sort(key=lambda m: (m['brand'], m['model'] or '', m['variant'] or '', m['name']))
for m in diffs:
    v = (m['variant'] or '')[:24]
    name = m['name'][:16]
    sign = '★' if abs(m['diff']) >= 1000000 else ''
    print(f"  [{m['brand']:<4}] {(m['model'] or ''):<10} | {v:<24} | {name:<16}: "
          f"{m['p5']:>10,} → {m['excel_price']:>10,} (Δ {m['diff']:+,}) {sign}")

print(f'\n=== 모호 매칭 ({len(ambiguous)}건) ===')
for m in ambiguous:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,}):")
    for c in m['cands'][:3]:
        print(f"     · {c['detail']} ({c['price']:,})")

print(f'\n=== 매칭 안 된 인라인 트림 ({len(unmatched)}건) ===')
for m in unmatched:
    print(f"  [{m['brand']}] {m['model']:<10} | {(m['variant'] or '')[:28]:<28} | {m['name']:<18} ({m['p5']:,})")

with open('_audit/diff_report_v3.json', 'w', encoding='utf-8') as f:
    json.dump({
        'matched_diffs': diffs,
        'grandeur_all': grandeur_all,
        'ambiguous': ambiguous,
        'unmatched_inline': unmatched,
        'all_matched': matched,
    }, f, ensure_ascii=False, indent=1)
