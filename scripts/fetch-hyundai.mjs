// welrix — 현대 신차 가격/트림 크롤러
// 자체 구축. 외부 의존 없음 (Node 내장만 사용).
//
// 동작:
//   1. https://www.hyundai.com/kr/ko/e/vehicles/{slug}/price 메인 페이지 fetch
//   2. HTML 안의 정적 fragment URL 추출 (NUXT escape 풀고 정규식)
//   3. 각 fragment 다운로드 (https://www.hyundai.com/contents/repn-car/html/homepage/price/{frag})
//   4. fragment HTML 파싱 → 트림 목록 + 가격 + 옵션
//   5. wel catalog 스키마로 출력 (src/data/car-master/{chassis}.json)
//
// 사용:
//   node scripts/fetch-hyundai.mjs <chassis_id> <slug> [title]
// 예:
//   node scripts/fetch-hyundai.mjs hyundai_grandeur_gn7_fl the-new-grandeur "디 뉴 그랜저"

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(REPO_ROOT, '_cache', 'hyundai');
const OUT_DIR = path.join(REPO_ROOT, 'src', 'data', 'car-master');
const MODELS_FILE = path.join(__dirname, 'hyundai-models.json');
const UA = 'Mozilla/5.0 (welrix-catalog-builder)';

// 모델 메타 로드
function loadModelsMeta() {
  if (!fs.existsSync(MODELS_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));
  // _doc, _format 같은 메타 키 제외
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('_')) out[k] = v;
  }
  return out;
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function fetchHtml(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : `https://www.hyundai.com${loc}`;
        return fetchHtml(next, attempt + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

async function fetchCached(url, key) {
  ensureDir(CACHE_DIR);
  const p = path.join(CACHE_DIR, key);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  const html = await fetchHtml(url);
  fs.writeFileSync(p, html);
  return html;
}

// fragment 이름에서 엔진/연료/구동/시트 추정 → 라벨 (한 모델에 fragment 여러 개일 때 구분용)
function fragmentLabel(fragName) {
  // 패턴 예시: grandeur-fl-J-G2.5_price.content / palisade-J-G2.5T-7_price.content
  const s = fragName.replace(/_price\.(content|html)$/, '');
  const labels = [];
  if (/-H(?:-|_|$)/.test(s)) labels.push('장애인용');
  if (/-R(?:-|_|$)/.test(s)) labels.push('영업용');
  if (/(?:^|-)nline(?:-|_|$)|-n-/.test(s)) labels.push('N라인');
  const m = s.match(/-([GLDH])(\d+(?:\.\d+)?)(T)?(?:-(\d+))?$/);
  if (m) {
    const fuel = { G: '가솔린', L: 'LPG', D: '디젤', H: '하이브리드' }[m[1]] || '';
    const size = m[2] + (m[3] || '');
    let lbl = `${fuel} ${size}`;
    if (m[4]) lbl += ` ${m[4]}인승`;
    labels.push(lbl);
  }
  return labels.join(' ');
}

// 옵션 한 줄(<li>) → { name, code, price, note? }
function parseOption(liBody) {
  const nameM = liBody.match(/<span class="spec_opts"(?:\s+data-car-spc-cd="([^"]+)")?[^>]*>([^<]+)<\/span>/);
  const priceM = liBody.match(/<span class="item-price">\s*([\d,]+)/);
  if (!nameM || !priceM) return null;
  const entry = {
    name: nameM[2].trim(),
    price: parseInt(priceM[1].replace(/,/g, ''), 10),
  };
  if (nameM[1]) entry.code = nameM[1];
  const noteM = liBody.match(/<br\s*\/?>※\s*([^<\n]+)/);
  if (noteM) entry.note = noteM[1].trim();
  return entry;
}

// fragment HTML → 트림 배열 [{ trim_id, name_en, name_kr, price, select_groups, h_genuine }]
function parseFragment(html, suffix = '') {
  const blocks = [...html.matchAll(/<tr\s+data-trim="([^"]+)">([\s\S]*?)<\/tr>/g)];
  const trims = [];
  for (const b of blocks) {
    const trimId = b[1];
    const body = b[2];
    const enM = body.match(/<span class="en">([^<]+)<\/span>/);
    const krM = body.match(/<span class="kr">\(?([^<)]+)/);
    const priceM = body.match(/(\d{1,3}(?:,\d{3}){2,3})/);
    if (!priceM) continue;
    const price = parseInt(priceM[1].replace(/,/g, ''), 10);

    // 카테고리(선택품목 / H Genuine Accessories) split — list-title 마커 기준
    const sections = body.split(/<button class="list-title"/);
    const select_groups = [];
    const h_genuine = [];
    // sections[0] = 앞부분 (기본품목), sections[1+] = 각 카테고리
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];
      const labelM = sec.match(/<label[^>]*>([^<]+)<\/label>/);
      const category = labelM ? labelM[1].trim() : '';
      const liBlocks = [...sec.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
      for (const li of liBlocks) {
        const entry = parseOption(li[1]);
        if (!entry) continue;
        if (category === 'H Genuine Accessories') h_genuine.push(entry);
        else select_groups.push(entry);
      }
    }

    trims.push({
      trim_id: trimId,
      name_en: enM ? enM[1].trim() : '',
      name_kr: krM ? krM[1].trim() : '',
      price,
      select_groups,
      h_genuine,
      variant_suffix: suffix,
    });
  }
  return trims;
}

// fragment HTML caption 에서 엔진 정보 추출 (fragmentLabel 보완)
// 예: "TUCSON 스마트스트림 가솔린 1.6 터보 가격표 ..." → "가솔린 1.6T"
//     "GRANDEUR HYBRID 가격표 ..." → "하이브리드"
function captionEngine(fragHtml) {
  const m = fragHtml.match(/<caption>([\s\S]*?)<\/caption>/);
  if (!m) return '';
  const cap = m[1];
  let fuel = cap.match(/(가솔린|LPG|디젤|하이브리드)/)?.[0];
  if (!fuel) {
    if (/HYBRID|HEV/i.test(cap)) fuel = '하이브리드';
    else if (/GASOLINE/i.test(cap)) fuel = '가솔린';
    else if (/DIESEL/i.test(cap)) fuel = '디젤';
  }
  if (!fuel) return '';
  const size = cap.match(/(\d\.\d)\s*(터보|T)?/);
  if (!size) return fuel;  // 배기량 없으면 연료만 (normalize 가 보강)
  const t = size[2] ? 'T' : '';
  return `${fuel} ${size[1]}${t}`;
}

async function crawl(chassis, slug, title) {
  console.log(`\n=== ${chassis} (slug: ${slug}) ===`);
  const priceUrl = `https://www.hyundai.com/kr/ko/e/vehicles/${slug}/price`;
  const html = await fetchCached(priceUrl, `${slug}_price.html`);
  // NUXT escape 풀기
  const unescaped = html.replace(/\\u002[Ff]/g, '/');
  const fragRe = /\/price\/([a-z][a-zA-Z0-9._-]*_price\.content)/g;
  const fragments = [...new Set([...unescaped.matchAll(fragRe)].map((m) => m[1]))];
  if (fragments.length === 0) {
    throw new Error(`fragment URL 발견 실패: ${slug}`);
  }
  console.log(`  fragments(${fragments.length}):`, fragments);

  const allTrims = [];
  for (const frag of fragments) {
    const fragUrl = `https://www.hyundai.com/contents/repn-car/html/homepage/price/${frag}`;
    const fragHtml = await fetchCached(fragUrl, frag);
    // 엔진 라벨: fragment 이름 → 빈 경우 caption fallback
    let suffix = fragmentLabel(frag);
    if (!suffix) suffix = captionEngine(fragHtml);
    const trims = parseFragment(fragHtml, suffix);
    console.log(`  ✓ ${frag} (${suffix || '-'}) — ${trims.length} trims`);
    for (const t of trims) allTrims.push({ ...t, source_fragment: frag });
  }

  // catalog 스키마로 변환
  const trimsObj = {};
  for (const t of allTrims) {
    // 트림명: "프리미엄 가솔린 2.5" 또는 "프리미엄 (장애인용 LPG 3.5)" 등
    const baseName = t.name_kr || t.name_en;
    const trimName = t.variant_suffix
      ? `${baseName} ${t.variant_suffix}`
      : baseName;
    trimsObj[trimName] = {
      slug: t.trim_id,
      price: { base: t.price },
      select_groups: t.select_groups,
      h_genuine: t.h_genuine,
      source_fragment: t.source_fragment,
    };
  }

  // 모델 메타 (model_name_kr, year_start, year_end) — 매핑 파일에서 자동 로드
  const allMeta = loadModelsMeta();
  const meta = allMeta[chassis] || {};

  const catalog = {
    catalog_id: chassis,
    title: meta.title || title || slug,
    model_name_kr: meta.model_name_kr || title || slug,
    maker: '현대',
    year_start: meta.year_start || null,
    year_end: meta.year_end || '현재',
    status: meta.status || 'current',
    source: 'hyundai_official',
    source_urls: [priceUrl, ...fragments.map((f) => `https://www.hyundai.com/contents/repn-car/html/homepage/price/${f}`)],
    fetched_at: new Date().toISOString().slice(0, 10),
    fetched_hash: crypto.createHash('sha256').update(JSON.stringify(allTrims)).digest('hex').slice(0, 12),
    trims: trimsObj,
  };

  ensureDir(OUT_DIR);
  const outPath = path.join(OUT_DIR, `${chassis}.json`);
  // 기존 파일이 있으면 hash 비교
  let prevHash = null;
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      prevHash = prev.fetched_hash;
    } catch {}
  }
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));
  console.log(`\n  → ${outPath}`);
  console.log(`  trims: ${Object.keys(trimsObj).length}`);
  if (prevHash) {
    console.log(`  hash: ${prevHash} → ${catalog.fetched_hash} ${prevHash === catalog.fetched_hash ? '(변경 없음)' : '⚠ 변경됨'}`);
  } else {
    console.log(`  hash: ${catalog.fetched_hash} (신규)`);
  }
  return catalog;
}

// 명령행 인자
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('사용:');
  console.error('  node scripts/fetch-hyundai.mjs --all                       (매핑된 전체 모델)');
  console.error('  node scripts/fetch-hyundai.mjs <chassis_id> <slug> [title] (단일 모델)');
  process.exit(1);
}

async function main() {
  if (args[0] === '--all') {
    const allMeta = loadModelsMeta();
    const targets = Object.keys(allMeta);
    console.log(`전체 ${targets.length}개 모델 크롤링 시작...\n`);
    const results = { ok: [], fail: [] };
    for (const chassis of targets) {
      try {
        await crawl(chassis, allMeta[chassis].slug, allMeta[chassis].title);
        results.ok.push(chassis);
      } catch (e) {
        console.error(`  ✗ ${chassis}: ${e.message}`);
        results.fail.push({ chassis, error: e.message });
      }
    }
    console.log(`\n=== 결과: 성공 ${results.ok.length} / 실패 ${results.fail.length} ===`);
    if (results.fail.length) {
      console.log('실패:');
      results.fail.forEach((f) => console.log(`  - ${f.chassis} (${f.error})`));
    }
  } else {
    const [chassis, slug, title] = args;
    if (!slug) {
      // 매핑 파일에서 slug 자동 로드
      const meta = loadModelsMeta()[chassis];
      if (!meta) throw new Error(`매핑 파일에 ${chassis} 없음. slug 인자 명시 필요.`);
      await crawl(chassis, meta.slug, meta.title);
    } else {
      await crawl(chassis, slug, title);
    }
  }
}

main().catch((e) => {
  console.error(`\n실패: ${e.message}`);
  process.exit(1);
});
