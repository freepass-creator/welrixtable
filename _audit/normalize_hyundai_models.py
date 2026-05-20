"""
현대차 model 명을 제조사 공식 표기로 통일 (페이스리프트/연료 prefix 포함).

기존 데이터 — model 이 짧고 페이스리프트 prefix + 연료가 trim 에 있던 형태:
  model="그랜저", trim="디 올 뉴 그랜저 1.6 하이브리드 2WD Premium"

신규 — 현대 홈페이지 표기 그대로 model 에 포함:
  model="더 뉴 그랜저 Hybrid", trim="1.6 2WD Premium"

cascade dropdown 에서 손님이 보는 명칭이 제조사 공식 표기와 일치하도록 정규화.

실행:
  python _audit/normalize_hyundai_models.py  # public/ + src/ 둘 다 in-place 업데이트
"""
import json, re, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HYUNDAI_MAP = {
    "그랜저":    {"base": "더 뉴 그랜저",         "hybrid": "더 뉴 그랜저 Hybrid"},
    "쏘나타":    {"base": "쏘나타 디 엣지",       "hybrid": "쏘나타 디 엣지 Hybrid"},
    "아반떼":    {"base": "아반떼",               "hybrid": "아반떼 Hybrid"},
    "코나":      {"base": "코나",                 "hybrid": "코나 Hybrid"},
    "팰리세이드":{"base": "디 올 뉴 팰리세이드",   "hybrid": "디 올 뉴 팰리세이드 Hybrid"},
    "싼타페":    {"base": "싼타페",               "hybrid": "싼타페 Hybrid"},
    "투싼":      {"base": "투싼",                 "hybrid": "투싼 Hybrid"},
    "캐스퍼":    {"base": "더 뉴 캐스퍼"},
    "베뉴":      {"base": "베뉴"},
    "포터2":     {"base": "포터2"},
}
PREFIXES = ["디 올 뉴 ", "더 뉴 ", "디 엣지 "]

def clean_trim(trim, old_model):
    t = trim
    for p in PREFIXES:
        if t.startswith(p):
            t = t[len(p):]
            break
    if t.startswith(old_model):
        t = t[len(old_model):].strip()
    elif old_model == "포터2" and t.startswith("포터"):
        t = t[len("포터"):].strip()
        if t.startswith("II"): t = t[2:].strip()
        elif t.startswith("2"): t = t[1:].strip()
    if t.startswith("디 엣지 "):
        t = t[len("디 엣지 "):]
    # 연료 키워드는 model 명에 포함 → trim 에서 제거 (가솔린/LPG/디젤은 trim 유지, 하이브리드만 제거)
    t = re.sub(r"(\s|^)하이브리드(\s|$)", r" ", t)
    return t.strip()

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "public/data/vehicles.json", ROOT / "src/data/vehicles.json"]

for path in TARGETS:
    with open(path, encoding="utf-8") as f:
        veh = json.load(f)
    changed = 0
    for v in veh:
        if v["brand"] != "현대":
            continue
        old_model = v["model"]
        trim = v["trim"]
        mapping = HYUNDAI_MAP.get(old_model)
        if not mapping:
            continue
        is_hybrid = "하이브리드" in trim
        new_model = mapping.get("hybrid" if is_hybrid else "base", mapping["base"])
        new_trim = clean_trim(trim, old_model)
        if v["model"] != new_model or v["trim"] != new_trim:
            v["model"] = new_model
            v["trim"] = new_trim
            changed += 1
    with open(path, "w", encoding="utf-8") as f:
        json.dump(veh, f, ensure_ascii=False, indent=2)
    print(f"[OK] {path.relative_to(ROOT)} — 변경 {changed}건")
