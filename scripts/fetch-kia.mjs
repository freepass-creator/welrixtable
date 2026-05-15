// welrix — 기아 PDF 가격표 다운로드 + Claude Vision 으로 파싱
// 기아는 가격을 PDF 로 제공 (현대와 다름)
//
// 동작:
//   1. kia-models.json 에서 모델별 PDF URL 로드
//   2. PDF 다운로드 → _cache/kia/{chassis}.pdf
//   3. Claude Vision API 호출 (별도 단계 — claude-parse-kia.mjs)
//   4. catalog json 출력 → src/data/car-master/{chassis}.json
//
// 사용:
//   node scripts/fetch-kia.mjs --download         # 모든 PDF 다운로드
//   node scripts/fetch-kia.mjs --download <chassis>

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(REPO_ROOT, '_cache', 'kia');
const MODELS_FILE = path.join(__dirname, 'kia-models.json');
const UA = 'Mozilla/5.0 (welrix-catalog-builder)';

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : `https://www.kia.com${loc}`;
        return downloadFile(next, outPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(outPath)));
    }).on('error', reject);
  });
}

function loadModelsMeta() {
  const data = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('_')) out[k] = v;
  }
  return out;
}

async function downloadOne(chassis, meta) {
  ensureDir(CACHE_DIR);
  const outPath = path.join(CACHE_DIR, `${chassis}.pdf`);
  const url = `https://www.kia.com${meta.pdf}`;
  console.log(`  ↓ ${chassis} ← ${url}`);
  try {
    await downloadFile(url, outPath);
    const size = fs.statSync(outPath).size;
    console.log(`    ✓ ${(size / 1024).toFixed(0)} KB → ${outPath}`);
    return { ok: true, path: outPath, size };
  } catch (e) {
    console.error(`    ✗ ${e.message}`);
    return { ok: false, error: e.message };
  }
}

const args = process.argv.slice(2);
if (args[0] === '--download') {
  const allMeta = loadModelsMeta();
  const targets = args[1] ? [args[1]] : Object.keys(allMeta);
  console.log(`기아 PDF 다운로드 (${targets.length}개)...\n`);
  for (const chassis of targets) {
    if (!allMeta[chassis]) {
      console.error(`✗ ${chassis}: 매핑 없음`);
      continue;
    }
    await downloadOne(chassis, allMeta[chassis]);
  }
} else {
  console.error('사용: node scripts/fetch-kia.mjs --download [chassis]');
  process.exit(1);
}
