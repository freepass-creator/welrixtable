import openpyxl, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

NEW = r'C:\dev\welrixtable\웰릭스모빌리티 신차 견적(20260506)_v4.5_배포용.xlsx'
wb = openpyxl.load_workbook(NEW, data_only=True)

for sheet_idx in [6, 7, 8]:  # 견적1, 견적2, 견적3
    ws = wb.worksheets[sheet_idx]
    print(f'=========== {ws.title} ===========')
    # Print key cells: vehicle name (B2/B3/B4), price (B5), term (G11), credit (B3)
    for r in range(1, 40):
        row_data = []
        for c in range(1, 12):
            v = ws.cell(r, c).value
            if v is None:
                row_data.append('')
            elif isinstance(v, float):
                row_data.append(f'{v:.4f}' if abs(v) < 10 else f'{v:,.0f}')
            else:
                row_data.append(str(v)[:35])
        print(f'R{r:02d}: ' + ' | '.join(row_data))
    print()
