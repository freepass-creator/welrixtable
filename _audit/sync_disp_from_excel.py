"""
vehicles.json 의 disp (배기량) 를 Excel 차량DB col F 와 동기화.
"""
import json, openpyxl, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

wb = openpyxl.load_workbook(ROOT / "웰릭스모빌리티 신차 견적(20260506)_v4.5_배포용.xlsx", data_only=True)
ws = wb["차량DB"]
# (brand, model, detail) → disp
excel_disp = {}
for r in range(3, ws.max_row + 1):
    b = ws.cell(r, 1).value; m = ws.cell(r, 2).value; d = ws.cell(r, 4).value
    disp = ws.cell(r, 6).value
    if b and m and d and disp is not None:
        excel_disp[(b, m, d)] = int(disp)

for jpath in [ROOT / 'src/data/vehicles.json', ROOT / 'public/data/vehicles.json']:
    veh = json.loads(jpath.read_text(encoding='utf-8'))
    changed_by_text = 0
    changed_by_price = 0
    notfound = 0
    for v in veh:
        # (brand, model, trim) 정확 매칭
        key = (v.get('brand'), v.get('model'), v.get('trim'))
        if key in excel_disp:
            if v.get('disp') != excel_disp[key]:
                v['disp'] = excel_disp[key]
                changed_by_text += 1
            continue
        # 폴백 — 같은 (brand, model) 중 가격 매칭
        candidates = [k for k in excel_disp if k[0] == v.get('brand') and k[1] == v.get('model')]
        for k in candidates:
            r2 = next((rr for rr in range(3, ws.max_row + 1)
                       if ws.cell(rr,1).value==k[0] and ws.cell(rr,2).value==k[1] and ws.cell(rr,4).value==k[2]
                       and ws.cell(rr,5).value == v.get('price')), None)
            if r2:
                new_disp = int(ws.cell(r2, 6).value)
                if v.get('disp') != new_disp:
                    v['disp'] = new_disp
                    changed_by_price += 1
                break
        else:
            notfound += 1
    jpath.write_text(json.dumps(veh, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"{jpath.relative_to(ROOT)}: 텍스트매치 {changed_by_text}, 가격매치 {changed_by_price}, 미매치 {notfound}")
