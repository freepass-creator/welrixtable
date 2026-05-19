"""
Excel 차량DB 를 단일 진실 소스로 vehicles.json 재생성.
calc.js 가 필요한 모든 필드: brand, model, trim, price, disp, fuel, tax_exempt,
group, multi_seat, r24, r36, r48, r60, strategic, buyback_apply.
"""
import json, sys, io, openpyxl
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

XLSX = ROOT / "웰릭스모빌리티 신차 견적(20260506)_v4.5_배포용.xlsx"
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["차량DB"]

vehicles = []
for r in range(3, ws.max_row + 1):
    brand = ws.cell(r, 1).value
    model = ws.cell(r, 2).value
    name = ws.cell(r, 3).value
    trim = ws.cell(r, 4).value
    price = ws.cell(r, 5).value
    disp = ws.cell(r, 6).value
    fuel = ws.cell(r, 7).value
    tax_exempt = ws.cell(r, 8).value
    group = ws.cell(r, 9).value
    multi_seat = ws.cell(r, 10).value
    r24 = ws.cell(r, 11).value
    r36 = ws.cell(r, 12).value
    r48 = ws.cell(r, 13).value
    r60 = ws.cell(r, 14).value
    strategic = ws.cell(r, 15).value or 0
    buyback = ws.cell(r, 16).value or 0
    if not (brand and model and trim and price):
        continue
    vehicles.append({
        "brand": brand,
        "model": model,
        "name": name or model,
        "trim": trim,
        "price": int(price),
        "disp": int(disp) if disp else 0,
        "fuel": fuel,
        "tax_exempt": tax_exempt,
        "group": group,
        "multi_seat": multi_seat,
        "r24": round(r24, 4) if r24 else None,
        "r36": round(r36, 4) if r36 else None,
        "r48": round(r48, 4) if r48 else None,
        "r60": round(r60, 4) if r60 else None,
        "strategic": round(strategic, 4),
        "buyback_apply": round(buyback, 4),
    })

print(f"📊 Excel 차량DB → {len(vehicles)} 건 vehicles.json 생성")

# 두 곳 모두 작성
for jpath in [ROOT / 'src/data/vehicles.json', ROOT / 'public/data/vehicles.json']:
    jpath.write_text(json.dumps(vehicles, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"  → {jpath.relative_to(ROOT)}")

# 카니발만 검증 출력
print()
print('=== 카니발 검증 ===')
for v in vehicles:
    if v['model'] == '카니발':
        print(f'  {v["trim"]:<55} disp={v["disp"]} multi={v["multi_seat"]} group={v["group"]} price={v["price"]:,}')
