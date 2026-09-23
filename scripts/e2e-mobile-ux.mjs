import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/mobile.html?force=mobile';
const out = process.env.ARTIFACT_DIR || 'artifacts/mobile-ux';
fs.mkdirSync(out, { recursive: true });

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function noHorizontalOverflow(page, label) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    bodySw: document.body.scrollWidth,
  }));
  ok(r.sw <= r.cw + 1 && r.bodySw <= r.cw + 1,
    `${label}: 가로 overflow (html ${r.sw}/${r.cw}, body ${r.bodySw})`);
}
async function clickFirst(locator, label) {
  ok(await locator.count() > 0, label + ': 항목 없음');
  await locator.first().click();
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ko-KR',
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5173' });
  await context.addInitScript(() => {
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {}
    /* 공유 저장은 운영 Firestore 대신 에뮬레이터로 보낸다 — 시험이 운영에 글을 남기지 않는다 */
    window.__WELRIX_SHARE_EMULATOR__ = { host: '127.0.0.1', port: 8080 };
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('requestfailed', (r) => requestFailures.push({ url: r.url(), error: r.failure()?.errorText || '' }));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sv-brand-card');
  await noHorizontalOverflow(page, '제조사');

  // UI hierarchy / touch sizes
  const ui = await page.evaluate(() => {
    const css = (sel) => getComputedStyle(document.querySelector(sel));
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    return {
      title: css('.sv-title').fontSize,
      titleWeight: css('.sv-title').fontWeight,
      footerH: rect('.m-footer .m-btn--primary').height,
      headerShareH: rect('.m-header .m-act').height,
      shareDisabled: document.querySelector('.m-header .m-act').disabled,
    };
  });
  ok(ui.title === '22px', '페이지 타이틀 규격이 22px 아님: ' + ui.title);
  ok(+ui.titleWeight >= 700, '페이지 타이틀 굵기 부족');
  ok(ui.footerH >= 52, '하단 CTA 터치 높이 부족: ' + ui.footerH);
  ok(ui.headerShareH >= 36, '상단 액션 높이 부족: ' + ui.headerShareH);
  ok(ui.shareDisabled, '견적 전 공유 버튼이 활성화되어 있음');

  // 제조사 → 모델 → 파워트레인(연료·배기량·인승·구동 통합) → 트림
  await page.locator('.sv-brand-card').filter({ hasText: '현대' }).click();
  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('어떤 모델'));
  const santa = page.locator('.sv-row').filter({ hasText: '싼타페' });
  if (await santa.count()) await santa.first().click();
  else await clickFirst(page.locator('.sv-row'), '모델');

  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('파워트레인'));
  const combinedPowertrain = page.locator('.sv-row__label').filter({ hasText: /가솔린|하이브리드/ }).filter({ hasText: /인승/ });
  ok(await combinedPowertrain.count() > 0, '파워트레인에 인승·구동 정보가 합쳐져 있지 않음');
  await clickFirst(page.locator('.sv-row'), '파워트레인');
  ok(await page.locator('.sv-title').filter({ hasText: '인승·구동방식' }).count() === 0,
    '별도 인승·구동 화면이 남아 있음');
  await page.waitForSelector('.sv-trim-card');
  await clickFirst(page.locator('.sv-trim-card'), '트림');

  const footerWidths = await page.locator('.m-footer .m-btn').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().width));
  ok(footerWidths.length === 3, '트림 선택 후 하단 버튼이 3개가 아님: ' + footerWidths.length);
  ok(Math.abs(footerWidths[0] / footerWidths[2] - 0.75) < 0.03
    && Math.abs(footerWidths[1] / footerWidths[2] - 0.75) < 0.03,
  '하단 3버튼 폭이 3:3:4가 아님: ' + JSON.stringify(footerWidths));

  // 트림 선택 뒤 공유는 계산 완료 전에는 아직 막혀 있어야 함
  const shareDuringCalc = await page.locator('.m-header .m-act').first().isDisabled();
  ok(shareDuringCalc, '계산 완료 전 공유가 열림');

  // 다음 → 색상
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('색상'));
  if (await page.locator('.sv-color-card').count()) await page.locator('.sv-color-card').first().click();
  await noHorizontalOverflow(page, '색상');

  // 다음 → 옵션
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('옵션'));
  if (await page.locator('.sv-opt:not(.is-disabled)').count()) {
    await page.locator('.sv-opt:not(.is-disabled)').first().click();
  }

  // 옵션 화면 실제 스크롤 + 하단 고정 영역이 콘텐츠를 가리지 않는지
  const beforeScroll = await page.evaluate(() => {
    const main = document.querySelector('.m-main');
    return { sh: main?.scrollHeight || 0, ch: main?.clientHeight || 0 };
  });
  ok(beforeScroll.sh > beforeScroll.ch, '옵션 화면이 긴데도 본문 스크롤 높이가 생기지 않음');
  await page.evaluate(() => {
    const main = document.querySelector('.m-main');
    if (main) { main.style.scrollBehavior = 'auto'; main.scrollTop = main.scrollHeight; }
  });
  await page.waitForTimeout(200);
  const scrollCheck = await page.evaluate(() => {
    const sticky = document.querySelector('.sq')?.getBoundingClientRect();
    const last = document.querySelector('.sv-total')?.getBoundingClientRect();
    return { y: document.querySelector('.m-main')?.scrollTop || 0, stickyTop: sticky?.top ?? 9999, lastBottom: last?.bottom ?? 0 };
  });
  ok(scrollCheck.y > 0, '본문 스크롤이 실제로 움직이지 않음');
  ok(scrollCheck.lastBottom <= scrollCheck.stickyTop + 2,
    `하단 견적판이 마지막 콘텐츠를 가림: last=${scrollCheck.lastBottom}, sticky=${scrollCheck.stickyTop}`);
  await noHorizontalOverflow(page, '옵션');

  // 조건
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.sc-title')?.textContent?.includes('계약 조건'));
  const km3 = page.locator('.sc-chip').filter({ hasText: '3만km/년' });
  if (await km3.count()) await km3.click();

  // 기간을 하나 빼도 이후 화면/재진입에서 되살아나면 안 된다.
  const term48 = page.locator('.sc-chip').filter({ hasText: '48개월' });
  if (await term48.count()) await term48.click();
  ok(await page.locator('.sc-field').first().locator('.sc-chip.is-selected').count() === 2,
    '기간 1개 해제 후 선택 수가 2가 아님');

  // 용품/서비스
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.se-title')?.textContent?.includes('옵션·서비스'));
  const selfCare = page.locator('.se-card').filter({ hasText: '웰스 Self' });
  if (await selfCare.count()) await selfCare.click();
  const liability = page.locator('.se-chip').filter({ hasText: '5억' });
  if (await liability.count()) await liability.click();
  const driver = page.locator('.se-chip').filter({ hasText: '1명' });
  if (await driver.count()) await driver.click();

  // 견적 결과
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForSelector('.sr-title');
  await page.waitForFunction(() => document.querySelectorAll('.sr-term__monthly b').length > 0, null, { timeout: 20000 });
  const monthly = await page.locator('.sr-term__monthly b').allTextContents();
  ok(monthly.length === 2 && monthly.every(Boolean), '선택한 2개 기간만 결과에 나와야 함: ' + JSON.stringify(monthly));

  // 최종 결과를 끝까지 스크롤했을 때 조건/안내문이 고정 footer 뒤에 가리지 않아야 한다.
  await page.evaluate(() => {
    const main = document.querySelector('.m-main');
    if (main) { main.style.scrollBehavior = 'auto'; main.scrollTop = main.scrollHeight; }
  });
  await page.waitForTimeout(150);
  const resultBottom = await page.evaluate(() => {
    const note = document.querySelector('.sr-note')?.getBoundingClientRect();
    const footer = document.querySelector('.m-footer')?.getBoundingClientRect();
    return { noteBottom: note?.bottom ?? 0, footerTop: footer?.top ?? innerHeight };
  });
  ok(resultBottom.noteBottom <= resultBottom.footerTop + 2,
    `최종 견적 하단 안내가 footer에 가림: note=${resultBottom.noteBottom}, footer=${resultBottom.footerTop}`);
  await page.evaluate(() => { const main = document.querySelector('.m-main'); if (main) main.scrollTop = 0; });
  await page.waitForTimeout(100);

  await page.waitForFunction(() => {
    const b = document.querySelector('.m-header .m-act');
    return b && !b.disabled;
  }, null, { timeout: 5000 });
  const shareReady = !(await page.locator('.m-header .m-act').first().isDisabled());
  ok(shareReady, '계산 완료 후 공유 버튼이 활성화되지 않음');
  await noHorizontalOverflow(page, '견적결과');
  await page.screenshot({ path: `${out}/01-result-390.png`, fullPage: true });

  // 공유 URL 생성
  await page.locator('.m-header .m-act').first().click();
  // 공유는 이제 서버에 견적을 맡기고 온다 — 붙여넣을 글자가 생길 때까지 기다린다.
  let sharedUrl = '';
  for (let i = 0; i < 60 && !sharedUrl; i++) {
    sharedUrl = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    if (!sharedUrl) await page.waitForTimeout(250);
  }
  // 대표 2026-09-23 — 손님이 받는 글자는 https:// 없이 33자다.
  ok(/^welrixtable\.vercel\.app\/s\/[a-z0-9]{8}$/.test(sharedUrl), '공유 URL이 짧은 견적 경로가 아님: ' + sharedUrl);
  ok(!sharedUrl.includes('?'), '공유 URL에 쿼리 파라미터가 남음');
  ok(sharedUrl.length === 33, `공유 URL 길이가 33자가 아님: ${sharedUrl.length}자`);

  // ★받은 사람이 그 링크를 열면 «고른 차와 금액»이 그대로 살아나야 한다.
  const 짧은경로 = sharedUrl.slice(sharedUrl.indexOf('/'));
  const 받은쪽 = await context.newPage();
  // Firestore 연결이 계속 열려 있어 networkidle 이 오지 않는다 — 문서만 뜨면 본다.
  await 받은쪽.goto(new URL(짧은경로, BASE).toString(), { waitUntil: 'domcontentloaded' });
  await 받은쪽.waitForSelector('text=공유받은 견적', { timeout: 20000 });
  const 살아난글 = await 받은쪽.evaluate(() => document.body.innerText);
  ok(/공유받은 견적/.test(살아난글), '공유 링크를 열었는데 공유받은 견적 화면이 아님');
  ok(/총 차량가격[\s\S]{0,40}[0-9][0-9,]{5,}원/.test(살아난글), '공유 링크에 차량가격이 살아나지 않음');
  ok(/월\s*[0-9][0-9,]{4,}원/.test(살아난글), '공유 링크에 월 대여료가 살아나지 않음');
  await 받은쪽.screenshot({ path: `${out}/02-shared-open-390.png`, fullPage: true });
  await 받은쪽.close();

  // 320px 폭 — 헤더/카드/가로 overflow 확인
  const narrow = await context.newPage();
  await narrow.setViewportSize({ width: 320, height: 740 });
  await narrow.goto(BASE, { waitUntil: 'networkidle' });
  await narrow.waitForSelector('.sv-brand-card');
  await noHorizontalOverflow(narrow, '320px 제조사');
  const headerFits = await narrow.evaluate(() => {
    const h = document.querySelector('.m-header');
    return h.scrollWidth <= h.clientWidth + 1;
  });
  ok(headerFits, '320px에서 헤더 액션이 넘침');
  await narrow.screenshot({ path: `${out}/03-brand-320.png`, fullPage: true });

  // PC 담당자 견적기 초기 상태 — 빈 화면처럼 보이지 않고 선택 안내가 있어야 한다.
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1440, height: 1000 });
  await desktop.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'networkidle' });
  await desktop.waitForSelector('.qp-empty-guide');
  ok(await desktop.locator('.qp-empty-guide').isVisible(), 'PC 초기 상태 안내가 보이지 않음');
  await desktop.screenshot({ path: `${out}/04-desktop-index-1440.png`, fullPage: true });

  // 고객 링크를 PC에서 열었을 때도 단일 열 컨셉은 유지하되 540px 읽기 폭을 사용한다.
  const wideMobile = await context.newPage();
  await wideMobile.setViewportSize({ width: 1440, height: 1000 });
  await wideMobile.goto(BASE, { waitUntil: 'networkidle' });
  await wideMobile.waitForSelector('.sv-brand-card');
  const wideWidth = await wideMobile.locator('#m-app').evaluate((el) => el.getBoundingClientRect().width);
  ok(wideWidth >= 530 && wideWidth <= 542, 'PC 고객용 견적 폭이 540px 규격이 아님: ' + wideWidth);
  await wideMobile.screenshot({ path: `${out}/05-mobile-web-wide-1440.png`, fullPage: true });

  /* 외부 CDN이 headless Chromium의 CORP 정책으로 막히는 것은 앱 로직 오류가 아니다.
     대신 localhost의 앱 JS/CSS/API가 실패하면 반드시 실패시킨다. */
  const coreFailures = requestFailures.filter((x) => x.url.startsWith('http://127.0.0.1:5173/'));
  const realConsoleErrors = consoleErrors.filter((x) => !x.includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'));
  ok(coreFailures.length === 0, '앱 핵심 리소스 실패: ' + JSON.stringify(coreFailures));
  ok(realConsoleErrors.length === 0, '브라우저 콘솔 오류: ' + realConsoleErrors.join(' | '));
  console.log(JSON.stringify({
    ok: true,
    monthly,
    sharedUrl,
    sharedUrlLength: sharedUrl.length,
    scrollY: scrollCheck.y,
    ui,
    externalResourceWarnings: requestFailures.filter((x) => !x.url.startsWith('http://127.0.0.1:5173/')),
  }, null, 2));
} finally {
  await browser.close();
}
