"""그랜저 VEHICLE_DB 트림 operating: false 제거 (cascade 표시 복구)."""
import re, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
p = ROOT / "index.html"
html = p.read_text(encoding='utf-8')

# 그랜저 model_id 가 1525 line 근처에서 시작. 다음 model_id 까지 영역에 한해 operating:false 제거.
# 더 안전한 패턴: 'model_id: "grandeur"' 부터 그 다음 model_id 까지
import re
m = re.search(r'model_id:\s*"grandeur"', html)
if not m:
    print("grandeur block not found")
    sys.exit(1)
start = m.start()
nxt = re.search(r'model_id:\s*"[^"]+"', html[start+50:])
end = start + 50 + (nxt.start() if nxt else len(html))
block = html[start:end]
removed_count = block.count('operating: false,')
new_block = block.replace(' operating: false,', '')
new_html = html[:start] + new_block + html[end:]
p.write_text(new_html, encoding='utf-8')
print(f"✅ 그랜저 영역에서 operating: false {removed_count}건 제거")
