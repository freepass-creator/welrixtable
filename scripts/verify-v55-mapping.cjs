// v5.5 (이후 새 버전) 엑셀 파일 받으면 자동 비교
//   node scripts/verify-v55-mapping.cjs [엑셀파일경로]
//   기본: _source/견적기/웰릭스모빌리티 신차 견적(20260604)_v5.5_배포용.xlsx
//
// 출력: 매핑된 모든 셀값 ↔ calc.js DEFAULT_CFG 비교 + 차이 highlight
// 다음 v6.0 받으면 이 스크립트 한 번만 돌리면 변경점 즉시 발견

const { execSync } = require('child_process');
const path = require('path');
const PATH = process.argv[2] || '_source/견적기/웰릭스모빌리티 신차 견적(20260604)_v5.5_배포용.xlsx';

// Python 으로 엑셀 셀 값 추출 (openpyxl)
const py = `
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl
wb = openpyxl.load_workbook('${PATH.replace(/\\/g, '/')}', data_only=True)
def get(sheet, coord):
    try: return wb[sheet][coord].value
    except: return None

# v5.5 매핑 셀 추출
out = {
  'credit': {
    '신용':   { 'interest': get('목록박스_정리필요','G25'), 'profit': get('목록박스_정리필요','J25'), 'deposit': get('목록박스_정리필요','M25') },
    '중신용': { 'interest': get('목록박스_정리필요','G26'), 'profit': get('목록박스_정리필요','J26'), 'deposit': get('목록박스_정리필요','M26') },
    '저신용': { 'interest': get('목록박스_정리필요','G27'), 'profit': get('목록박스_정리필요','J27'), 'deposit': get('목록박스_정리필요','M27') },
  },
  'costs': {
    'registration_fee':       get('견적1','C13'),
    'delivery_first':         get('견적1','C35'),
    'repair_rate_annual':     get('견적1','I14'),
  },
  'fees': {
    'deposit_discount_rate':  0.03,  # =-F13*0.03*F11 식 안의 상수
  },
  'services': {
    'wells_basic_monthly':    12900,  # I17 =IF(...12900*12,...)
    'wells_self_yearly':      96000,
    'gps_monthly':            11000,  # I19 =11000*12
    'inspection_fee_yearly':  get('목록박스_정리필요','G37'),
  },
  'insurance': {
    'base_normal':            820750,   # I10 일반
    'base_multi_seat':        732880,   # I10 다인승
    'base_porter':            2000000,  # I10 포터 (=IF(COUNTIF(C4,"*포터*"),2000000,...))
  },
  'residuals': {
    'credit_premium_중신용':  0.03,  # I21 =IF($C$3="중신용",0.03,IF($C$3="저신용",0.05,0))
    'credit_premium_저신용':  0.05,
    'term_surcharge_60M':     -0.03, # I22 60M
    'term_surcharge_48M':     -0.005,
    'term_surcharge_36M':     0.05,
  },
}
print(json.dumps(out, indent=2, ensure_ascii=False, default=str))
`;
let raw;
try {
  raw = execSync(`python -c "${py.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
  // fallback: write py to tmp file
  const fs = require('fs');
  const tmp = path.join(require('os').tmpdir(), 'v55_extract.py');
  fs.writeFileSync(tmp, py);
  raw = execSync(`python "${tmp}"`, { encoding: 'utf-8' });
}
const excel = JSON.parse(raw);

// calc.js DEFAULT_CFG (수동 동기화 — calc.js 변경 시 같이 수정)
const calc = {
  credit: {
    '신용':   { interest: 0.064, profit: 0.019, deposit: 0.05 },
    '중신용': { interest: 0.064, profit: 0.041, deposit: 0.20 },
    '저신용': { interest: 0.064, profit: 0.084, deposit: 0.30 },
  },
  costs: {
    registration_fee:    200000,
    delivery_first:      500000,
    repair_rate_annual:  0.02,
  },
  fees: { deposit_discount_rate: 0.03 },
  services: {
    wells_basic_monthly:    12900,
    wells_self_yearly:      96000,
    gps_monthly:            11000,
    inspection_fee_yearly:  76000,
  },
  insurance: {
    base_normal:      820750,
    base_multi_seat:  732880,
    base_porter:      2000000,
  },
  residuals: {
    credit_premium_중신용: 0.03,
    credit_premium_저신용: 0.05,
    term_surcharge_60M: -0.03,
    term_surcharge_48M: -0.005,
    term_surcharge_36M: 0.05,
  },
};

console.log(`\n=== ${path.basename(PATH)} ↔ calc.js DEFAULT_CFG 비교 ===\n`);

const diffs = [];
function compare(prefix, ex, ca) {
  if (typeof ex === 'object' && ex !== null && !Array.isArray(ex)) {
    for (const k of Object.keys(ex)) {
      compare(prefix ? `${prefix}.${k}` : k, ex[k], ca?.[k]);
    }
    return;
  }
  const exNum = typeof ex === 'string' ? parseFloat(ex) : ex;
  const caNum = typeof ca === 'string' ? parseFloat(ca) : ca;
  const same = (exNum === null || exNum === undefined) ? true
            : (caNum === null || caNum === undefined) ? false
            : Math.abs(exNum - caNum) < 0.0001;
  if (same) {
    console.log(`  ✓ ${prefix.padEnd(40)} ${String(exNum).padStart(12)} (일치)`);
  } else {
    console.log(`  ❌ ${prefix.padEnd(40)} 엑셀: ${String(exNum).padStart(12)}  calc: ${String(caNum).padStart(12)}`);
    diffs.push({ key: prefix, excel: exNum, calc: caNum });
  }
}

compare('', excel, calc);

console.log('\n=== 결과 요약 ===');
console.log(`전체: ${diffs.length === 0 ? '🎉 일치' : `❌ ${diffs.length}건 차이`}`);
if (diffs.length) {
  console.log('차이 항목:');
  diffs.forEach(d => console.log(`  ${d.key}: 엑셀 ${d.excel} ≠ calc ${d.calc}`));
  console.log('\n→ calc.js DEFAULT_CFG 의 해당 키를 엑셀 값으로 업데이트 필요');
}
