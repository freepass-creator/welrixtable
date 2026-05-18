"""
PDF → 정규화된 trim+price 추출 (proof of concept).
pdfplumber.extract_tables() 우선 시도, 실패 시 텍스트 기반 fallback.

목표 output 형식 (모델당):
{
  "model": "K5",
  "maker": "기아",
  "source_pdf": "price_k5.pdf",
  "fetched": "2026-05-15",
  "trims": [
    {"name": "프레스티지 하이브리드", "price_won": 33930000, "page": 1, "raw": "..."}
  ]
}
"""
from __future__ import annotations
import sys, io, re, json
from pathlib import Path

import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pricepdf"

# 트림 키워드 (한국어 + 영어)
TRIM_KEYWORDS = [
    # 기아
    "트렌디", "프레스티지", "베스트", "노블레스", "시그니처", "캘리그래피",
    "노블레스 라이트", "시그니처 블랙", "그래비티", "GT-Line", "GT라인", "GT 라인",
    # 현대
    "Smart", "Modern", "Inspiration", "N Line", "N라인", "Modern Lite",
    "프리미엄", "익스클루시브", "Honors", "Black Exterior", "Black Ink",
    # 제네시스
    "Standard", "Premium", "Sport", "Special", "Lite", "Black Edition",
    "G70", "G80", "G90",
]
TRIM_RE = re.compile('|'.join(re.escape(k) for k in TRIM_KEYWORDS))

PRICE_MAN = re.compile(r'([0-9]{1,2},?[0-9]{3})\s*만')
PRICE_WON = re.compile(r'([0-9]{2,3},[0-9]{3},[0-9]{3})')


def extract_k5(pdf_path: Path) -> list[dict]:
    """K5 PDF: 기아 만원 단위 표.
    한 페이지에 4 trim block. 각 block:
    - 트림명 좌측 (예: '프레스티지', '베스트 셀렉션')
    - 정상가 / 세제혜택 후 가격 2개
    - 정상가 = 첫번째 만원 가격
    """
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            lines = text.split("\n")

            # 모든 라인에서 (트림키워드 포함) + (만원가격) 쌍 찾기
            for line in lines:
                trim_match = TRIM_RE.search(line)
                price_match = PRICE_MAN.search(line)
                if not (trim_match and price_match):
                    continue
                trim = trim_match.group()
                price_str = price_match.group(1).replace(',', '')
                try:
                    won = int(price_str) * 10_000
                except ValueError:
                    continue
                if won < 10_000_000 or won > 200_000_000:
                    continue
                # 같은 라인의 '세제혜택' 가격은 보통 두 번째 매치 → 첫번째만 정상가
                results.append({
                    "trim": trim.strip(),
                    "price_won": won,
                    "page": i + 1,
                    "raw": re.sub(r'\s+', ' ', line)[:150],
                })
    return results


if __name__ == "__main__":
    pdf = PDF_DIR / "price_k5.pdf"
    out = extract_k5(pdf)
    print(json.dumps(out, ensure_ascii=False, indent=2))
