"""
v2: 카탈로그 base price가 PDF 텍스트에 그대로 나오는지 확인.
- 매치 = OK
- 미매치 = 카탈로그가 오래되었거나 PDF 가격이 변경됨 (사용자 확인 필요)
"""
from __future__ import annotations
import json, re, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pricepdf"
CATALOG_DIR = ROOT / "src" / "data" / "car-master"

PDF_TO_CATALOGS = {
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
    "porter2-2026-price.pdf":             [],
    "genesis-g70-pricelist-kor-202605.pdf":  ["genesis_g70", "genesis_g70_st"],
    "genesis-g80-pricelist-kor-202605.pdf":  ["genesis_g80_rg3", "genesis_g80_rg3_pre"],
    "genesis-g80-black-pricelist-kor-202605.pdf": [],
    "genesis-g90-pricelist-kor-202605.pdf":  ["genesis_g90_rs4"],
    "genesis-g90-black-pricelist-kor-202605.pdf": [],
    "genesis-g90-long-wheel-base-black-pricelist-kor-202605.pdf": [],
    "genesis-gv70-pricelist-kor-202605.pdf": ["genesis_gv70", "genesis_gv70_e", "genesis_gv70_pre"],
    "genesis-gv80-pricelist-kor-202605.pdf": ["genesis_gv80", "genesis_gv80_coupe", "genesis_gv80_pre"],
}


def load_catalog(catalog_id: str) -> dict | None:
    p = CATALOG_DIR / f"{catalog_id}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding='utf-8'))


def price_in_pdf_text(price_won: int, pdf_text: str) -> bool:
    """가격이 PDF text에 어떤 형태로든 나오는지 확인.
    - 원 단위: 32,510,000 / 32510000
    - 만 단위: 3,251만 / 3251만
    """
    if not price_won:
        return False
    # 원 단위 (콤마 있음/없음)
    won_str = f"{price_won:,}"
    if won_str in pdf_text:
        return True
    if str(price_won) in pdf_text:
        return True
    # 만 단위 (1만 단위 절상/내림)
    man_int = price_won // 10_000
    man_with_comma = f"{man_int:,}"
    # "3,393만" 형태
    if re.search(rf"{man_with_comma}\s*만", pdf_text):
        return True
    if re.search(rf"{man_int}\s*만", pdf_text):
        return True
    # "3,393" 형태 (만이 떨어진 줄 끝일 수 있음)
    if re.search(rf"\b{man_with_comma}\b", pdf_text):
        return True
    return False


def fmt_man(w: int | None) -> str:
    if w is None:
        return "—"
    return f"{w/10_000:,.0f}만"


def main():
    print("# PDF ↔ 카탈로그 가격 정합성 (v2 — 단순 매칭)")
    print()
    print(f"카탈로그의 base price가 PDF 텍스트에 그대로 등장하는지 확인.")
    print(f"미매치 = 카탈로그가 오래됐거나 PDF 변경. 사용자 확인 필요.")
    print()

    total_trims = 0
    matched = 0
    unmatched_summary = []

    for pdf_name, cat_ids in PDF_TO_CATALOGS.items():
        if not cat_ids:
            continue
        txt_path = PDF_DIR / pdf_name.replace(".pdf", ".txt")
        if not txt_path.exists():
            continue
        pdf_text = txt_path.read_text(encoding='utf-8', errors='replace')

        rows = []
        for cid in cat_ids:
            cat = load_catalog(cid)
            if not cat:
                continue
            trims = cat.get("trims", {})
            for tname, info in trims.items():
                price = info.get("price", {}).get("base")
                if not price:
                    continue
                total_trims += 1
                hit = price_in_pdf_text(price, pdf_text)
                if hit:
                    matched += 1
                else:
                    rows.append((cid, tname, price))

        if rows:
            print(f"### ❌ {pdf_name}")
            print()
            print("| 카탈로그 | 트림 | base 가격 |")
            print("|---|---|---|")
            for cid, tname, price in rows:
                print(f"| `{cid}` | {tname} | **{fmt_man(price)}** ({price:,}원) |")
            print()
            unmatched_summary.extend([(pdf_name, cid, tname, price) for cid, tname, price in rows])

    # 헤더 위로 요약 inject 못하니까 끝에 한 번 더
    print("---")
    print(f"\n## 요약")
    print()
    print(f"- 검사한 트림: **{total_trims}**개")
    print(f"- PDF 매치: **{matched}**개 ({matched*100//total_trims if total_trims else 0}%)")
    print(f"- PDF 미매치: **{total_trims - matched}**개")
    print()


if __name__ == "__main__":
    main()
