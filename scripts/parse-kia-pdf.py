#!/usr/bin/env python3
"""기아 PDF 가격표 → catalog json
pdfplumber로 표 자동 인식. 트림명·판매가·옵션 추출.

사용:
    python scripts/parse-kia-pdf.py <chassis_id>
    python scripts/parse-kia-pdf.py --all
"""
import sys
import json
import re
import os
import hashlib
from pathlib import Path
import pdfplumber

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / '_cache' / 'kia'
OUT_DIR = REPO_ROOT / 'src' / 'data' / 'car-master'
MODELS_FILE = REPO_ROOT / 'scripts' / 'kia-models.json'

# 엔진 자동 인식 패턴 (페이지 텍스트에서 매칭)
ENGINE_PATTERNS = [
    # (정규식, 라벨)
    (r'하이브리드', '하이브리드'),
    (r'G\s*2\.0\s*T|2\.0\s*터보|2\.0T', '가솔린 2.0T'),
    (r'G\s*1\.6\s*T|1\.6\s*터보|1\.6T', '가솔린 1.6T'),
    (r'G\s*2\.5\s*T|2\.5\s*터보|2\.5T', '가솔린 2.5T'),
    (r'G\s*3\.5\s*T|3\.5\s*터보|3\.5T', '가솔린 3.5T'),
    (r'(?:^|\s)2\.0(?!T)|G\s*2\.0(?!T)|가솔린\s*2\.0', '가솔린 2.0'),
    (r'(?:^|\s)2\.5(?!T)|G\s*2\.5(?!T)|가솔린\s*2\.5', '가솔린 2.5'),
    (r'(?:^|\s)3\.3(?!T)|G\s*3\.3(?!T)|가솔린\s*3\.3', '가솔린 3.3'),
    (r'(?:^|\s)3\.5(?!T)|G\s*3\.5(?!T)|가솔린\s*3\.5', '가솔린 3.5'),
    (r'(?:^|\s)1\.6\s*가솔린|G\s*1\.6(?!T)', '가솔린 1.6'),
    (r'LPG\s*3\.0|L\s*3\.0', 'LPG 3.0'),
    (r'LPG\s*3\.5|L\s*3\.5', 'LPG 3.5'),
    (r'LPG\s*2\.0|L\s*2\.0', 'LPG 2.0'),
    (r'LPG\s*1\.6|L\s*1\.6', 'LPG 1.6'),
    (r'D\s*2\.2|디젤\s*2\.2', '디젤 2.2'),
]


def detect_engine(page_text: str) -> str | None:
    """페이지 헤더에서 엔진 인식. 첫 200자 안에서 우선 매칭."""
    head = page_text[:300]
    for pat, label in ENGINE_PATTERNS:
        if re.search(pat, head):
            return label
    return None


def clean_cell(cell: str | None) -> str:
    if not cell:
        return ''
    return re.sub(r'\s+', ' ', cell.replace('\n', ' ')).strip()


def parse_price_man(text: str) -> int | None:
    """'3,393만' → 33930000"""
    m = re.search(r'(\d{1,3}(?:,\d{3})*)\s*만', text or '')
    if not m:
        return None
    n = int(m.group(1).replace(',', ''))
    return n * 10000


def parse_trim_name(cells: list[str]) -> str | None:
    """첫 두 셀에서 트림명 추출"""
    for c in cells[:2]:
        cleaned = clean_cell(c)
        if not cleaned:
            continue
        # 마커 제거
        cleaned = re.sub(r'^(NEW|HOT|신규|페이스리프트)\s+', '', cleaned)
        # 띄어쓰기 정상화 ('프 레 스 티 지' → '프레스티지' / '노 블 레 스' → '노블레스')
        # 패턴: 1글자 + 공백이 반복되면 합침
        if re.match(r'^([가-힣]\s){2,}[가-힣]$', cleaned):
            cleaned = cleaned.replace(' ', '')
        if cleaned:
            return cleaned
    return None


def is_price_row(row: list) -> bool:
    """행에 가격 셀이 있고 트림명이 있는지"""
    if not row or len(row) < 3:
        return False
    has_price = any('만' in (c or '') for c in row)
    return has_price


def extract_trims_from_page(page) -> list[dict]:
    """한 페이지에서 트림 목록 추출"""
    text = page.extract_text() or ''
    engine = detect_engine(text)
    if not engine:
        return []

    tables = page.extract_tables() or []
    trims = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        # 첫 행이 헤더 (트림/판매가격/...)
        header = [clean_cell(c) for c in table[0]]
        if not any('판매' in h or '트' in h and '림' in h for h in header):
            continue
        # 판매가격 컬럼 위치
        price_col = None
        for i, h in enumerate(header):
            if '판매' in h and '가격' in h:
                price_col = i
                break
        if price_col is None:
            # fallback: 3번째 컬럼이 보통 판매가
            price_col = 2

        for row in table[1:]:
            if not is_price_row(row):
                continue
            trim_name = parse_trim_name(row[:2])
            if not trim_name:
                continue
            price_cell = row[price_col] if price_col < len(row) else ''
            price = parse_price_man(price_cell)
            if not price:
                continue
            trims.append({
                'trim_name': trim_name,
                'engine': engine,
                'price': price,
                'raw_price_cell': clean_cell(price_cell),
            })
    return trims


def is_option_matrix_table(table) -> bool:
    """첫 행이 '구분, ...옵션명...' 형태인 옵션 매트릭스"""
    if not table or len(table) < 3:
        return False
    first = clean_cell(table[0][0]) if table[0] else ''
    return '구분' in first


def merge_option_headers(row0, row1) -> list[str]:
    """row0 + row1 머지 (멀티-row 헤더 처리)"""
    headers = []
    for i in range(max(len(row0), len(row1))):
        h0 = clean_cell(row0[i]) if i < len(row0) else ''
        h1 = clean_cell(row1[i]) if i < len(row1) else ''
        if h1:
            headers.append(h1)
        elif h0:
            headers.append(h0)
        else:
            headers.append('')
    return headers


def parse_option_cell(cell: str | None):
    """'109만' → 1090000 / '기본' → 'basic' / '-' or '' → None"""
    s = clean_cell(cell)
    if not s or s == '-':
        return None
    if s == '기본':
        return 'basic'
    m = re.search(r'(\d{1,4})\s*만', s)
    if m:
        return int(m.group(1)) * 10000
    return None


def extract_options_from_page(page) -> dict[str, list[dict]]:
    """옵션 매트릭스 페이지 → {트림명: [{name, price}, ...]}"""
    tables = page.extract_tables() or []
    result = {}
    for table in tables:
        if not is_option_matrix_table(table):
            continue
        # 헤더 머지 (row0 + row1)
        headers = merge_option_headers(table[0], table[1] if len(table) > 1 else [])
        # 옵션 컬럼 위치 (구분/None 제외)
        opt_columns = []
        for i, h in enumerate(headers):
            if i >= 2 and h and h != '구분':
                opt_columns.append((i, h))
        # 트림 행 (보통 row2 ~ row5)
        for row in table[2:]:
            trim_name = clean_cell(row[0]) or clean_cell(row[1] if len(row) > 1 else '')
            if not trim_name or trim_name in ('패키지 옵션', '세 부 사 양', '구분'):
                continue
            # 띄어쓰기 정규화
            if re.match(r'^([가-힣]\s){2,}[가-힣]$', trim_name):
                trim_name = trim_name.replace(' ', '')
            options = []
            for col_idx, opt_name in opt_columns:
                if col_idx >= len(row):
                    continue
                parsed = parse_option_cell(row[col_idx])
                if parsed is None or parsed == 'basic':
                    continue  # 선택 불가 또는 트림 기본
                options.append({'name': opt_name, 'price': parsed})
            if options:
                result[trim_name] = options
    return result


def parse_pdf(pdf_path: Path) -> tuple[list[dict], dict[str, list[dict]]]:
    """기아 PDF 전체 분석 → (가격 트림 목록, 트림명별 옵션 매트릭스)"""
    all_trims = []
    all_options = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # 가격 추출
            page_trims = extract_trims_from_page(page)
            for t in page_trims:
                t['source_page'] = page_num
                all_trims.append(t)
            # 옵션 매트릭스 추출
            page_options = extract_options_from_page(page)
            for trim_name, opts in page_options.items():
                # 첫 발견 우선, 중복은 무시
                if trim_name not in all_options:
                    all_options[trim_name] = opts
    return all_trims, all_options


def build_catalog(chassis: str, meta: dict, trims: list[dict], options_by_trim: dict) -> dict:
    trims_obj = {}
    for t in trims:
        # 이미 같은 키 있으면 첫번째 유지 (페이지 헤더가 더 정확)
        key = f"{t['trim_name']} {t['engine']}"
        if key in trims_obj:
            continue
        # 트림명만으로 옵션 매트릭스 조회 (엔진 무관 — 옵션은 트림별 동일)
        select_groups = options_by_trim.get(t['trim_name'], [])
        trims_obj[key] = {
            'price': {'base': t['price']},
            'select_groups': select_groups,
            'source_page': t['source_page'],
            'raw_price': t.get('raw_price_cell', ''),
        }

    hash_input = json.dumps(trims, sort_keys=True, ensure_ascii=False)
    fetched_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()[:12]

    catalog = {
        'catalog_id': chassis,
        'title': meta.get('title', chassis),
        'model_name_kr': meta.get('model_name_kr', chassis),
        'maker': '기아',
        'year_start': meta.get('year_start'),
        'year_end': meta.get('year_end', '현재'),
        'status': meta.get('status', 'current'),
        'source': 'kia_official_pdf',
        'source_urls': [f"https://www.kia.com{meta['pdf']}"],
        'fetched_at': __import__('datetime').date.today().isoformat(),
        'fetched_hash': fetched_hash,
        'trims': trims_obj,
    }
    return catalog


def main():
    if len(sys.argv) < 2:
        print('사용: python scripts/parse-kia-pdf.py <chassis_id> | --all')
        sys.exit(1)

    with open(MODELS_FILE, encoding='utf-8') as f:
        all_meta = {k: v for k, v in json.load(f).items() if not k.startswith('_')}

    targets = list(all_meta.keys()) if sys.argv[1] == '--all' else [sys.argv[1]]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for chassis in targets:
        meta = all_meta.get(chassis)
        if not meta:
            print(f'✗ {chassis}: 매핑 없음')
            continue
        pdf_path = CACHE_DIR / f'{chassis}.pdf'
        if not pdf_path.exists():
            print(f'✗ {chassis}: PDF 없음 → fetch-kia.mjs --download 먼저 실행')
            continue
        print(f'\n=== {chassis} → {meta["model_name_kr"]} ===')
        trims, options = parse_pdf(pdf_path)
        print(f'  파싱: {len(trims)} 트림 (raw) / {len(options)} 트림 옵션 매트릭스')
        catalog = build_catalog(chassis, meta, trims, options)
        unique_trims = catalog['trims']
        with_opts = sum(1 for t in unique_trims.values() if t.get('select_groups'))
        print(f'  catalog: {len(unique_trims)} 트림 (unique) / 옵션 포함 {with_opts}')
        out_path = OUT_DIR / f'{chassis}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        print(f'  → {out_path}')
        # 미리보기 5개
        for k, v in list(unique_trims.items())[:5]:
            print(f'    · {k} — {v["price"]["base"]:,}원')


if __name__ == '__main__':
    main()
