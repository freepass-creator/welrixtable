"""차량DB 매칭 v4 — 로마숫자/제네시스/K9 정규화 추가"""
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
    'Best Selection': '베스트 셀렉션', 'Best Selection 1': '베스트 셀렉션 1',
    'Best Selection 2': '베스트 셀렉션 2', 'Essential': '디 에센셜',
    'N Line': 'N 라인', 'Modern Lite': '모던 라이트', 'Noblesse Lite': '노블레스 라이트',
    'Platinum': '플래티넘', 'Masters': '마스터즈', 'Best': '베스트',
    'Black Exterior': '블랙 익스테리어', 'Black Ink': '블랙 잉크',
    'Black': '블랙', 'Standard': '스탠다드', 'Standard Model': '기본 모델',
}
# 양방향
TRIM_KO_EN = {v: k for k, v in TRIM_EN_KO.items()}

# 제네시스: "스탠다드" ↔ "기본 모델"
GENESIS_TRIM_ALIASES = {
    '스탠다드': ['기본 모델', '기본'],
    'Standard': ['기본 모델', '기본'],
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

def normalize_roman(s):
    """로마숫자 Ⅰ/Ⅱ/Ⅲ → 1/2/3"""
    if not s: return s
    return s.replace('Ⅰ','1').replace('Ⅱ','2').replace('Ⅲ','3').replace('Ⅳ','4').replace('Ⅴ','5')

def normalize_text(s):
    if not s: return ''
    s = strip_prefix(s)
    s = normalize_roman(s)
    for en, ko in TRIM_EN_KO.items():
        s = s.replace(en, ko)
    # 공백/특수문자 정리
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def contains_trim(detail, trim_name, brand=None):
    """detail 에 트림명 포함 (한/영/로마숫자/별명 모두)"""
    nd = normalize_text(detail)
    nt = normalize_text(trim_name)
    if nt in nd: return True
    if trim_name in detail: return True
    en = TRIM_KO_EN.get(trim_name)
    if en and en in detail: return True
    # 제네시스 트림 alias
    if brand == '제네시스':
        for alias_set in GENESIS_TRIM_ALIASES.values():
            if trim_name in alias_set + list(GENESIS_TRIM_ALIASES.keys()):
                for a in alias_set + list(GENESIS_TRIM_ALIASES.keys()):
                    if a in detail or a in nd: return True
        # 'Graphite Edition' 같은 영문 트림
        if 'Graphite' in trim_name and ('Graphite' in detail or '그래파이트' in detail): return True
    # 띄어쓰기 무시 매칭
    if nt.replace(' ','') in nd.replace(' ',''):
        return True
    return False

ENG = ['1.0','1.4','1.5','1.6','1.7','2.0','2.2','2.4','2.5','3.0','3.3','3.5','3.8','5.0','48V']

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
    sl = (s or '').lower()
    return '4wd' in sl or 'awd' in sl or 'htrac' in sl

def get_seats(s):
    if not s: return None
    m = re.search(r'(\d)인승', s)
    if m: return int(m.group(1))
    return None

def is_rental_only(s): return '렌터카' in (s or '') or '렌터 전용' in (s or '')
def is_van(s): return '밴' in (s or '') or 'van' in (s or '').lower()
def is_disabled(s): return '장애' in (s or '')

def get_suffix_token(name):
    sfx = []
    norm = normalize_text(name)
    for tok in ['블랙 익스테리어', '블랙 잉크', 'N 라인', '라이트', 'X-Line', 'X 라인',
               '스포츠 패키지', '뒷좌석 컴포트', '슈퍼차저']:
        if tok in norm: sfx.append(tok)
    return sfx

def normalize_trim_name(name):
    return normalize_text(name) if name else ''

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

        # 모델명 — 우리 model이 detail에 포함
        if model and model not in det and strip_prefix(model) not in det:
            # 제네시스의 경우 model_name 자체가 'G70' 같은 것이고 detail도 'G70 ...'
            if brand == '제네시스':
                if model not in det: continue
            else:
                continue

        if not contains_trim(det, raw_name, brand):
            continue

        # suffix 일치
        ex_sfx = set(get_suffix_token(det))
        # variant에 스포츠 패키지 명시 안 됐고 detail이 스포츠 패키지면 미스매치
        if '스포츠 패키지' in ex_sfx and '스포츠 패키지' not in sfx:
            continue
        if '스포츠 패키지' in sfx and '스포츠 패키지' not in ex_sfx:
            continue
        if '블랙 익스테리어' in sfx and '블랙 익스테리어' not in ex_sfx: continue
        if '블랙 익스테리어' in ex_sfx and '블랙 익스테리어' not in sfx: continue
        if '블랙 잉크' in sfx and '블랙 잉크' not in ex_sfx: continue
        if '블랙 잉크' in ex_sfx and '블랙 잉크' not in sfx: continue
        if '라이트' in sfx and '라이트' not in ex_sfx: continue
        if '라이트' in ex_sfx and '라이트' not in sfx: continue

        ex_eng = get_engine(det)
        if eng and ex_eng and eng != ex_eng: continue
        ex_fuel = get_fuel(det)
        if fuel and ex_fuel and fuel != ex_fuel: continue
        ex_4wd = has_4wd(det)
        if wd4 != ex_4wd: continue

        ex_seats = get_seats(det)
        if seats:
            if ex_seats and seats != ex_seats: continue
        else:
            if ex_seats and ex_seats != 5: continue

        ex_rental = is_rental_only(det)
        if rental != ex_rental: continue
        ex_van = is_van(det)
        if van != ex_van: continue
        ex_disabled = is_disabled(det)
        if disabled != ex_disabled: continue

        score = 10
        if eng and eng == ex_eng: score += 5
        if fuel and fuel == ex_fuel: score += 5
        if sfx & ex_sfx: score += 2
        # 트림명 정확 매칭 (정규화 후 동일)
        if normalize_text(det).endswith(trim_name) or normalize_text(det).endswith(raw_name):
            score += 3
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

print('=== 매칭 결과 v4 ===')
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

print(f'\n=== ★ 가격 차이 ({len(diffs)}건) ===')
diffs.sort(key=lambda m: (m['brand'], m['model'] or '', m['variant'] or '', m['name']))
for m in diffs:
    v = (m['variant'] or '')[:24]
    name = m['name'][:18]
    sign = '★' if abs(m['diff']) >= 1000000 else ''
    print(f"  [{m['brand']:<4}] {(m['model'] or ''):<10} | {v:<24} | {name:<18}: "
          f"{m['p5']:>10,} → {m['excel_price']:>10,} (Δ {m['diff']:+,}) {sign}")

print(f'\n=== 모호 매칭 ({len(ambiguous)}건) ===')
for m in ambiguous[:10]:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,}):")
    for c in m['cands'][:3]:
        print(f"     · {c['detail']} ({c['price']:,})")

print(f'\n=== 매칭 안 된 인라인 트림 ({len(unmatched)}건) ===')
for m in unmatched:
    print(f"  [{m['brand']}] {m['model']:<10} | {(m['variant'] or '')[:28]:<28} | {m['name']:<20} ({m['p5']:,})")

with open('_audit/diff_report_v4.json', 'w', encoding='utf-8') as f:
    json.dump({
        'matched_diffs': diffs,
        'grandeur_all': grandeur_all,
        'ambiguous': ambiguous,
        'unmatched_inline': unmatched,
        'all_matched': matched,
    }, f, ensure_ascii=False, indent=1)
