"""
PDF (제조사 공식 가격표) vs 카탈로그 JSON (src/data/car-master) 정합성 감사.

Phase 1: 인벤토리 + 매핑 (어떤 PDF가 어떤 카탈로그로 가는지)
Phase 2: 매핑된 쌍에 대해 트림명 + base price 대조
Phase 3: Markdown 리포트 생성

실행: python _audit/audit_pdf_vs_catalog.py > _audit/REPORT.md
"""
from __future__ import annotations
import json, re, sys, io, os, glob
from collections import defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pricepdf"
CATALOG_DIR = ROOT / "src" / "data" / "car-master"

# ============================================================
# 1) PDF 파일명 → 카탈로그 ID 매핑 (heuristic)
# ============================================================
PDF_TO_CATALOGS = {
    # 기아
    "price_k5.pdf":                       ["kia_k5_dl3_facelift", "kia_k5_dl3_facelift_hybrid"],
    "price_k8.pdf":                       ["kia_k8_gl3", "kia_k8_gl3_hybrid", "kia_k8_gl3_pre", "kia_k8_gl3_pre_hybrid"],
    "price_k9.pdf":                       ["kia_k9_rj", "kia_k9_rj_pre"],
    "price_morning.pdf":                  ["kia_morning_sa_facelift", "kia_morning_sa", "kia_morning_ja"],
    "price_niro.pdf":                     ["kia_niro_sg2", "kia_niro_sg2_hybrid"],
    "price_ray.pdf":                      ["kia_ray_tam_facelift1", "kia_ray", "kia_ray_ev"],
    "price_seltos.pdf":                   ["kia_seltos_sp3", "kia_seltos_sp2", "kia_seltos"],
    "price_sorento.pdf":                  ["kia_sorento_mq4_facelift", "kia_sorento_mq4_facelift_hybrid",
                                            "kia_sorento_mq4", "kia_sorento_mq4_hybrid"],
    "price_sportage.pdf":                 ["kia_sportage_nq5", "kia_sportage_nq5_hybrid"],
    "price_carnival.pdf":                 ["kia_carnival_ka4_facelift", "kia_carnival_ka4_facelift_hybrid",
                                            "kia_carnival_ka4"],
    "price_carnival-hi-limousine.pdf":    ["kia_carnival_ka4_hi_limousine_facelift", "kia_carnival_ka4_hi_limousine"],

    # 현대 (gasoline / hybrid 분리)
    "avante-2026-price.pdf":              ["hyundai_avante_cn7", "hyundai_avante_cn7_pre"],
    "avante-hybrid-2026-price.pdf":       ["hyundai_avante_cn7_hybrid"],
    "AX_CASPER_price.pdf":                ["hyundai_casper", "hyundai_casper_pre"],
    "the-new-grandeur-price.pdf":         ["hyundai_grandeur_gn7_fl", "hyundai_grandeur_gn7"],
    "the-new-grandeur-hybrid-price.pdf":  ["hyundai_grandeur_gn7_fl_hybrid", "hyundai_grandeur_gn7_hybrid"],
    "kona-2027-price.pdf":                ["hyundai_kona_sx2"],
    "kona-hybrid-2027-price.pdf":         ["hyundai_kona_sx2_hybrid"],
    "palisade-2025-price.pdf":            ["hyundai_palisade_lx3"],
    "palisade-hev-2025-price.pdf":        ["hyundai_palisade_lx3_hybrid"],
    "santafe-2026-price.pdf":             ["hyundai_santafe_mx5"],
    "santafe-hev-2026-price.pdf":         ["hyundai_santafe_mx5_hybrid"],
    "sonata-the-edge2026-price.pdf":      ["hyundai_sonata_dn8_edge"],
    "sonata-the-edge-hybrid2026-price.pdf": ["hyundai_sonata_dn8_edge_hybrid"],
    "tucson-2026-price.pdf":              ["hyundai_tucson_nx4"],
    "tucson-hybrid-2026-price.pdf":       ["hyundai_tucson_nx4_hybrid"],
    "venue-2025-price.pdf":               ["hyundai_venue"],
    "porter2-2026-price.pdf":             [],  # 카탈로그에 포터 없음

    # 제네시스
    "genesis-g70-pricelist-kor-202605.pdf":  ["genesis_g70", "genesis_g70_st"],
    "genesis-g80-pricelist-kor-202605.pdf":  ["genesis_g80_rg3", "genesis_g80_rg3_pre"],
    "genesis-g80-black-pricelist-kor-202605.pdf": [],  # G80 Black Edition - 카탈로그에 없음
    "genesis-g90-pricelist-kor-202605.pdf":  ["genesis_g90_rs4"],
    "genesis-g90-black-pricelist-kor-202605.pdf": [],  # G90 Black - 카탈로그에 없음
    "genesis-g90-long-wheel-base-black-pricelist-kor-202605.pdf": [],  # G90 LWB Black - 없음
    "genesis-gv70-pricelist-kor-202605.pdf": ["genesis_gv70", "genesis_gv70_e", "genesis_gv70_pre"],
    "genesis-gv80-pricelist-kor-202605.pdf": ["genesis_gv80", "genesis_gv80_coupe", "genesis_gv80_pre"],
}

# ============================================================
# 2) PDF txt 에서 트림+가격 추출
# ============================================================
# 기아: "프레스티지 3,393만" / "베스트 셀렉션 3,502만" 등 (만 단위, 콤마 OK)
# 현대/제네시스: "Premium 32,510,000" (원 단위)
PRICE_MAN  = re.compile(r'([0-9]{1,2}[,.]?[0-9]{3})\s*만')      # "3,393만" 또는 "3393만"
PRICE_WON  = re.compile(r'([0-9]{2,3}[,.][0-9]{3}[,.][0-9]{3})\s*(?:원)?')  # "32,510,000"

def extract_trims_from_txt(txt_path: Path) -> list[dict]:
    """PDF에서 추출된 텍스트에서 (트림명, 가격) 쌍을 보수적으로 추출.
    한 라인에 가격이 있고 한국어/영어 트림 키워드가 같이 있는 줄만 채택.
    중복 줄(친환경차 세제혜택 후 가격 등) 은 첫 번째만.
    """
    if not txt_path.exists():
        return []
    text = txt_path.read_text(encoding='utf-8', errors='replace')

    results = []
    seen_prices = set()

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        # 가격 매칭 (만 또는 원)
        m_man = PRICE_MAN.search(line)
        m_won = PRICE_WON.search(line)

        if m_man:
            price_str = m_man.group(1).replace(',', '').replace('.', '')
            try:
                won = int(price_str) * 10000
            except ValueError:
                continue
        elif m_won:
            price_str = m_won.group(1).replace(',', '').replace('.', '')
            try:
                won = int(price_str)
            except ValueError:
                continue
        else:
            continue

        # 너무 작거나 큰 값 거름 (트림 가격이 아니라 옵션/세제혜택)
        if won < 10_000_000 or won > 300_000_000:
            continue

        # 같은 가격 중복은 무시 (세제혜택 후 가격 등)
        if won in seen_prices:
            continue
        seen_prices.add(won)

        # 가격 빼고 나머지에서 트림 후보 추출 — 짧게 (앞 100자)
        short = re.sub(r'\s+', ' ', line)[:120]
        results.append({"price_won": won, "raw_line": short})

    return results


# ============================================================
# 3) 카탈로그 JSON 로드
# ============================================================
def load_catalog(catalog_id: str) -> dict | None:
    p = CATALOG_DIR / f"{catalog_id}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        return {"_error": str(e)}


def catalog_trim_summary(cat: dict) -> list[dict]:
    """카탈로그의 트림 목록 [{name, base_price_won}]"""
    trims = cat.get("trims", {})
    out = []
    for name, info in trims.items():
        price = info.get("price", {}).get("base")
        out.append({"name": name, "base_price_won": price})
    return out


# ============================================================
# 4) Markdown 리포트 생성
# ============================================================
def fmt_won(w: int | None) -> str:
    if w is None:
        return "—"
    return f"{w:,}"

def fmt_man(w: int | None) -> str:
    if w is None:
        return "—"
    man = w / 10_000
    return f"{man:,.0f}만"


def main():
    print("# PDF ↔ 카탈로그 트림·가격 정합성 감사")
    print()
    print(f"- PDF 폴더: `{PDF_DIR.relative_to(ROOT)}`")
    print(f"- 카탈로그 폴더: `{CATALOG_DIR.relative_to(ROOT)}`")
    print()

    # 인벤토리
    all_pdfs = sorted({p.name for p in PDF_DIR.glob("*.pdf")})
    all_catalogs = sorted({p.stem for p in CATALOG_DIR.glob("*.json") if not p.stem.startswith("_")})

    mapped_catalogs = set()
    for cats in PDF_TO_CATALOGS.values():
        mapped_catalogs.update(cats)

    unmapped_pdfs = [p for p in all_pdfs if p not in PDF_TO_CATALOGS]
    orphan_catalogs = [c for c in all_catalogs if c not in mapped_catalogs]

    print("## 인벤토리 요약")
    print()
    print(f"- PDF: **{len(all_pdfs)}개**")
    print(f"- 카탈로그: **{len(all_catalogs)}개**")
    print(f"- 매핑된 PDF: {len([p for p in all_pdfs if p in PDF_TO_CATALOGS])}개")
    print(f"- 매핑된 카탈로그: {len(mapped_catalogs)}개")
    if unmapped_pdfs:
        print(f"- ⚠️ 매핑 누락 PDF: {unmapped_pdfs}")
    if orphan_catalogs:
        print(f"- ⚠️ PDF 없는 카탈로그: {orphan_catalogs}")
    print()

    # 매핑별 트림 대조
    print("## 모델별 트림·가격 대조")
    print()

    for pdf_name, cat_ids in PDF_TO_CATALOGS.items():
        if not cat_ids:
            continue
        txt_path = PDF_DIR / pdf_name.replace(".pdf", ".txt")
        pdf_trims = extract_trims_from_txt(txt_path)

        print(f"### {pdf_name}")
        print(f"- 매핑 카탈로그: {', '.join(cat_ids)}")
        print()

        # 카탈로그 합쳐서 트림 모음
        catalog_trims_all = []
        for cid in cat_ids:
            cat = load_catalog(cid)
            if not cat:
                print(f"  - ❌ 카탈로그 없음: `{cid}`")
                continue
            if cat.get("_error"):
                print(f"  - ❌ 카탈로그 로드 실패: `{cid}` — {cat['_error']}")
                continue
            for t in catalog_trim_summary(cat):
                catalog_trims_all.append({**t, "catalog": cid})

        # 카탈로그 가격 set (만원 단위)
        cat_price_set = {round(t["base_price_won"] / 10_000) for t in catalog_trims_all if t.get("base_price_won")}
        # PDF 가격 set (만원 단위)
        pdf_price_set = {round(t["price_won"] / 10_000) for t in pdf_trims}

        print("**PDF 추출 가격 (line snippet):**")
        if not pdf_trims:
            print("- (추출 실패 또는 .txt 없음)")
        else:
            print()
            print("| 가격 | 라인 |")
            print("|---|---|")
            for t in pdf_trims[:30]:  # 너무 많으면 컷
                in_cat = "✓" if round(t["price_won"] / 10_000) in cat_price_set else "🔴"
                print(f"| {fmt_man(t['price_won'])} {in_cat} | `{t['raw_line']}` |")
            if len(pdf_trims) > 30:
                print(f"\n*(+ {len(pdf_trims) - 30}건 생략)*")
        print()

        print("**카탈로그 트림:**")
        if not catalog_trims_all:
            print("- (카탈로그 없음)")
        else:
            print()
            print("| 트림 | base 가격 | 카탈로그 | PDF 일치 |")
            print("|---|---|---|---|")
            for t in catalog_trims_all:
                price = t.get("base_price_won")
                in_pdf = "✓" if (price and round(price / 10_000) in pdf_price_set) else "🔴"
                print(f"| {t['name']} | {fmt_man(price)} | {t['catalog']} | {in_pdf} |")
        print()

        # 요약
        cat_only = cat_price_set - pdf_price_set
        pdf_only = pdf_price_set - cat_price_set
        if cat_only:
            print(f"- ⚠️ 카탈로그에만 있는 가격(만원): {sorted(cat_only)}")
        if pdf_only:
            print(f"- ⚠️ PDF에만 있는 가격(만원): {sorted(pdf_only)}")
        if not cat_only and not pdf_only:
            print(f"- ✅ 가격 일치")
        print()
        print("---")
        print()


if __name__ == "__main__":
    main()
