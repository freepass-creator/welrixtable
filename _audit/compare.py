import json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('_audit/excel_db.json', 'r', encoding='utf-8') as f:
    excel = json.load(f)
with open('_audit/inline_db.json', 'r', encoding='utf-8') as f:
    inline = json.load(f)

ENG = {'1.0','1.4','1.5','1.6','1.7','2.0','2.2','2.4','2.5','3.0','3.3','3.5','5.0'}
FUEL = {'하이브리드','HEV','가솔린','LPG','LPi','디젤','전기'}
WD = {'2WD','4WD','AWD','HTRAC'}

def tokens(s):
    s = s or ''
    toks = set()
    for kw in ENG | FUEL | WD | {'승용','승합','밴','일반판매','렌터카'}:
        if kw in s: toks.add(kw)
    sl = s.lower()
    if 'hybrid' in sl: toks.add('하이브리드')
    if 'gasoline' in sl: toks.add('가솔린')
    if 'diesel' in sl: toks.add('디젤')
    if 'lpg' in sl or 'lpi' in sl: toks.add('LPG')
    if '4wd' in sl or 'awd' in sl: toks.add('4WD')
    return toks

def find_matches(it):
    brand = it['brand']
    model = it['model']
    variant = it['variant'] or ''
    trim_name = it['name']
    vtoks = tokens(variant)
    candidates = []
    for ex in excel:
        if ex['brand'] != brand:
            continue
        det = ex['detail']
        if model and model not in det:
            continue
        if trim_name not in det:
            continue
        dtoks = tokens(det)
        score = 0
        eng_v = vtoks & ENG
        eng_d = dtoks & ENG
        if eng_v:
            if not (eng_v & eng_d):
                continue
            score += 5
        fuel_v = vtoks & FUEL
        fuel_d = dtoks & FUEL
        if fuel_v:
            f_match = bool(fuel_v & fuel_d)
            if not f_match and '하이브리드' in fuel_v and '하이브리드' in det:
                f_match = True
            if not f_match:
                continue
            score += 5
        wd_v = vtoks & WD
        wd_d = dtoks & WD
        if wd_v:
            v4 = bool({'4WD','AWD','HTRAC'} & wd_v)
            d4 = bool({'4WD','AWD','HTRAC'} & wd_d)
            if v4 == d4:
                score += 3
            elif d4 and not v4:
                continue
        else:
            if {'4WD','AWD','HTRAC'} & wd_d:
                continue
        score += len(vtoks & dtoks)
        candidates.append((ex, score))
    if not candidates:
        return []
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

print('=== 매칭 결과 ===')
print(f'  Matched (단일): {len(matched)}')
print(f'  Ambiguous (다중): {len(ambiguous)}')
print(f'  Unmatched (인라인에만): {len(unmatched)}')
print(f'  Excel only (엑셀에만): {len(excel) - len(excel_matched)}')

def is_grandeur(m):
    return (m.get('model') or '') == '그랜저'

diffs = [m for m in matched if m['diff'] != 0 and not is_grandeur(m)]
grandeur_diffs = [m for m in matched if m['diff'] != 0 and is_grandeur(m)]
zero = [m for m in matched if m['diff'] == 0]

print(f'\n=== 일치 ({len(zero)}건) ===')
from collections import Counter
for k, v in Counter((m['brand'], m['model']) for m in zero).most_common():
    print(f'  {k[0]} {k[1]}: {v}')

print(f'\n=== 그랜저 (페이스리프트 전후 차이, {len(grandeur_diffs)}건) ===')
for m in grandeur_diffs:
    print(f"  {m['variant'][:18]:<18} {m['name']:<10}: 인라인(FL후) {m['p5']:>10,} / 엑셀(FL전) {m['excel_price']:>10,} (Δ {m['diff']:+,})")

print(f'\n=== ★ 가격 차이 있는 매칭 ({len(diffs)}건, 그랜저 제외) ===')
diffs.sort(key=lambda m: (-abs(m['diff']), m['brand'], m['model'] or ''))
for m in diffs:
    flag = '★' if abs(m['diff']) >= 1000000 else ''
    v = (m['variant'] or '')[:20]
    name = m['name'][:14]
    print(f"  [{m['brand']:<4}] {(m['model'] or ''):<10} | {v:<20} | {name:<14}: "
          f"인라인 {m['p5']:>10,} / 엑셀 {m['excel_price']:>10,} (Δ {m['diff']:+,}) {flag}")

print(f'\n=== 모호한 매칭 ({len(ambiguous)}건, 상위 10) ===')
for m in ambiguous[:10]:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,}):")
    for c in m['cands'][:3]:
        print(f"     · {c['detail']} ({c['price']:,})")

print(f'\n=== 매칭 안 된 인라인 트림 ({len(unmatched)}건, 상위 20) ===')
for m in unmatched[:20]:
    print(f"  [{m['brand']}] {m['model']} {m.get('variant')} {m['name']} ({m['p5']:,})")

print(f'\n=== Excel 전용 (인라인에 없음, 상위 30) ===')
ex_only = [e for e in excel if e['detail'] not in excel_matched]
for e in ex_only[:30]:
    print(f"  [{e['brand']}] {e['detail']} ({e['price']:,})")

with open('_audit/diff_report.json', 'w', encoding='utf-8') as f:
    json.dump({
        'matched_diffs': diffs,
        'grandeur_diffs': grandeur_diffs,
        'ambiguous': ambiguous,
        'unmatched_inline': unmatched,
        'excel_only': ex_only,
        'all_matched': matched,
    }, f, ensure_ascii=False, indent=1)
