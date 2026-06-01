#!/usr/bin/env python
# Wikimedia Commons API 로 차종별 이미지 일괄 검색 + 다운로드 + 1000px 리사이즈
import urllib.request, urllib.parse, json, os, sys, io
from PIL import Image

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (welrix-img-fetch)'

# (slug, 검색어 후보 리스트) — 가장 매칭 잘 되는 순서
TARGETS = [
    ('avante',     ['Hyundai Avante 2024', 'Hyundai Elantra 2024', 'Hyundai Elantra CN7']),
    ('sonata',     ['Hyundai Sonata 2024', 'Hyundai Sonata DN8 facelift', 'Hyundai Sonata Edge']),
    ('venue',      ['Hyundai Venue 2023', 'Hyundai Venue QXi']),
    ('kona',       ['Hyundai Kona 2024', 'Hyundai Kona SX2', 'Hyundai Kona N']),
    ('tucson',     ['Hyundai Tucson 2024', 'Hyundai Tucson NX4', 'Hyundai Tucson Hybrid']),
    ('santafe',    ['Hyundai Santa Fe 2024', 'Hyundai Santa Fe MX5', 'Hyundai Santa Fe 5th generation']),
    ('porter',     ['Hyundai Porter 2', 'Hyundai Porter II', 'Hyundai H-100']),
    # 기아
    ('morning',    ['Kia Morning 2023', 'Kia Picanto 2023', 'Kia Picanto JA']),
    ('ray',        ['Kia Ray 2024', 'Kia Ray TAM']),
    ('k5',         ['Kia K5 2024', 'Kia Optima DL3', 'Kia K5 DL3']),
    ('k8',         ['Kia K8 2023', 'Kia K8 GL3']),
    ('k9',         ['Kia K9 2023', 'Kia K900 RJ2', 'Kia Quoris']),
    ('niro',       ['Kia Niro 2024', 'Kia Niro SG2']),
    ('seltos',     ['Kia Seltos 2024', 'Kia Seltos SP2 facelift']),
    ('sportage',   ['Kia Sportage 2024', 'Kia Sportage NQ5']),
    ('sorento',    ['Kia Sorento 2024', 'Kia Sorento MQ4 facelift']),
    # 제네시스
    ('g70',        ['Genesis G70 2023', 'Genesis G70 facelift']),
    ('g90',        ['Genesis G90 2023', 'Genesis G90 RS4', 'Genesis G90 second generation']),
    ('gv70',       ['Genesis GV70 2024', 'Genesis GV70 facelift']),
    ('gv80',       ['Genesis GV80 2024', 'Genesis GV80 facelift']),
]

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'cars')

def search_commons(query):
    """검색해서 매칭되는 파일명 후보들 리턴"""
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json',
        'list': 'search', 'srsearch': query,
        'srnamespace': 6,  # File namespace
        'srlimit': 5,
    })
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
    return [hit['title'] for hit in data.get('query', {}).get('search', [])]

def get_image_info(file_title):
    """이미지 다운로드용 URL 얻기"""
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json',
        'titles': file_title,
        'prop': 'imageinfo',
        'iiprop': 'url|size|mime',
    })
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
    pages = data.get('query', {}).get('pages', {})
    for p in pages.values():
        if 'imageinfo' in p:
            return p['imageinfo'][0]
    return None

def download_and_save(slug, info):
    url = info['url']
    mime = info.get('mime', '')
    print(f'  fetching {url} ({mime})')
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    im = Image.open(io.BytesIO(raw))
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    # 가로 1000px 기준 리사이즈
    if im.size[0] > 1000:
        ratio = 1000 / im.size[0]
        im = im.resize((1000, int(im.size[1] * ratio)), Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, f'{slug}.jpg')
    im.save(out_path, 'JPEG', quality=88, optimize=True)
    print(f'  saved {slug}.jpg {im.size}')
    return True

def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    results = {}
    for slug, queries in TARGETS:
        if only and slug not in only:
            continue
        out_path = os.path.join(OUT_DIR, f'{slug}.jpg')
        if os.path.exists(out_path) and not only:
            print(f'[skip] {slug} (already exists)')
            continue
        print(f'[{slug}] trying...')
        ok = False
        for q in queries:
            try:
                hits = search_commons(q)
                if not hits:
                    print(f'  no hits for "{q}"')
                    continue
                # 차량 이미지로 적절한 후보 — 측면/카탈로그 우선
                for title in hits:
                    low = title.lower()
                    # 인테리어/내부/뒷모습/엔진 제외
                    if any(b in low for b in ['interior', 'engine', 'dashboard', 'rear only', '_rear.', 'logo']):
                        continue
                    info = get_image_info(title)
                    if not info:
                        continue
                    # 너무 작은 파일 스킵
                    if info.get('width', 0) < 600:
                        continue
                    try:
                        download_and_save(slug, info)
                        ok = True
                        results[slug] = title
                        break
                    except Exception as e:
                        print(f'  download failed: {e}')
                        continue
                if ok:
                    break
            except Exception as e:
                print(f'  search "{q}" failed: {e}')
        if not ok:
            print(f'  !! {slug} 실패')
            results[slug] = None
    # 결과 요약
    print('\n=== 결과 요약 ===')
    ok_count = sum(1 for v in results.values() if v)
    print(f'성공: {ok_count}/{len(results)}')
    for slug, src in results.items():
        mark = 'OK' if src else 'FAIL'
        print(f'  [{mark}] {slug}  <-  {src or "(없음)"}')

if __name__ == '__main__':
    main()
