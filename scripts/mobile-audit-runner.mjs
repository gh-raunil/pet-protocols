import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\rouna\\.gemini\\antigravity-ide\\brain\\8a6f4a8f-989d-4a64-94b0-5914a11c0e87';
const BEFORE_DIR = path.join(ARTIFACT_DIR, 'screenshots', 'before');
const AFTER_DIR = path.join(ARTIFACT_DIR, 'screenshots', 'after');

fs.mkdirSync(BEFORE_DIR, { recursive: true });
fs.mkdirSync(AFTER_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'mobile-430', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, isMobile: false, hasTouch: true },
  { name: 'desktop-1280', width: 1280, height: 800, isMobile: false, hasTouch: false },
];

const ROUTES = [
  { app: 'user', url: 'http://localhost:3000', name: 'user-home' },
  { app: 'user', url: 'http://localhost:3000/menu', name: 'user-menu' },
  { app: 'user', url: 'http://localhost:3000/cart', name: 'user-cart' },
  { app: 'user', url: 'http://localhost:3000/auth/login', name: 'user-login' },
  { app: 'admin', url: 'http://localhost:3001/login', name: 'admin-login' },
  { app: 'admin', url: 'http://localhost:3001', name: 'admin-home' },
  { app: 'admin', url: 'http://localhost:3001/kitchen', name: 'admin-kitchen' },
  { app: 'admin', url: 'http://localhost:3001/cashier', name: 'admin-cashier' },
  { app: 'admin', url: 'http://localhost:3001/delivery', name: 'admin-delivery' },
  { app: 'admin', url: 'http://localhost:3001/products', name: 'admin-products' },
  { app: 'superadmin', url: 'http://localhost:3002/login', name: 'superadmin-login' },
  { app: 'superadmin', url: 'http://localhost:3002', name: 'superadmin-home' },
];

export async function runAudit({ mode = 'before' } = {}) {
  const targetDir = mode === 'before' ? BEFORE_DIR : AFTER_DIR;
  console.log(`\n======================================================`);
  console.log(`Starting Mobile Touch & Layout Audit (Mode: ${mode.toUpperCase()})`);
  console.log(`Output directory: ${targetDir}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const auditResults = {
    timestamp: new Date().toISOString(),
    mode,
    routesAudited: 0,
    overflowIssues: [],
    smallTouchTargets: [],
    successfulScreenshots: [],
  };

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();
      const pageId = `${route.name}-${vp.name}`;

      try {
        const response = await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000); // Allow hydration & animations

        // 1. Check document horizontal overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
          const clientWidth = docEl.clientWidth;
          const hasHorizontalScroll = scrollWidth > clientWidth + 2; // small tolerance

          let culpritTag = null;
          let culpritClass = null;
          let maxElementWidth = 0;

          if (hasHorizontalScroll) {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientWidth + 2 && rect.width > maxElementWidth) {
                maxElementWidth = rect.width;
                culpritTag = el.tagName;
                culpritClass = (el.className || '').toString().slice(0, 100);
              }
            }
          }

          return {
            hasHorizontalScroll,
            scrollWidth,
            clientWidth,
            culpritTag,
            culpritClass,
          };
        });

        if (overflow.hasHorizontalScroll) {
          auditResults.overflowIssues.push({
            pageId,
            route: route.url,
            viewport: vp.name,
            scrollWidth: overflow.scrollWidth,
            clientWidth: overflow.clientWidth,
            culprit: `${overflow.culpritTag}.${overflow.culpritClass}`,
          });
          console.warn(`[OVERFLOW] ${pageId}: scrollWidth ${overflow.scrollWidth}px > clientWidth ${overflow.clientWidth}px (Culprit: ${overflow.culpritTag}.${overflow.culpritClass})`);
        }

        // 2. Measure interactive controls for touch target size (WCAG 2.5.8 / 44px standard) on mobile viewports
        if (vp.isMobile) {
          const smallTargets = await page.evaluate(() => {
            const interactiveSelectors = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]';
            const elements = Array.from(document.querySelectorAll(interactiveSelectors));
            const defects = [];

            for (const el of elements) {
              // check if visible
              const style = window.getComputedStyle(el);
              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.opacity === '0' ||
                el.offsetParent === null
              ) {
                continue;
              }

              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;

              // If either dimension is under 36px, or both are under 44px
              if (rect.width < 40 || rect.height < 40) {
                const label = (
                  el.innerText ||
                  el.getAttribute('aria-label') ||
                  el.getAttribute('placeholder') ||
                  el.getAttribute('name') ||
                  el.tagName
                ).trim().slice(0, 40);

                defects.push({
                  tag: el.tagName.toLowerCase(),
                  label: label || 'unnamed',
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  className: (el.className || '').toString().slice(0, 80),
                });
              }
            }

            return defects;
          });

          if (smallTargets.length > 0) {
            auditResults.smallTouchTargets.push({
              pageId,
              viewport: vp.name,
              route: route.url,
              count: smallTargets.length,
              samples: smallTargets.slice(0, 5),
            });
          }
        }

        // 3. Capture screenshot
        const screenshotPath = path.join(targetDir, `${pageId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        auditResults.successfulScreenshots.push(screenshotPath);
        auditResults.routesAudited++;
        console.log(`[PASS] ${pageId} screenshot captured.`);
      } catch (err) {
        console.error(`[FAIL] ${pageId}: ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  const reportPath = path.join(ARTIFACT_DIR, `audit_report_${mode}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  console.log(`\nAudit completed! Report saved to: ${reportPath}`);
  console.log(`Total Routes/Viewports Tested: ${auditResults.routesAudited}`);
  console.log(`Total Horizontal Overflow Defects: ${auditResults.overflowIssues.length}`);
  console.log(`Pages with Sub-40px Touch Targets: ${auditResults.smallTouchTargets.length}`);
  return auditResults;
}

if (process.argv[1] && process.argv[1].endsWith('mobile-audit-runner.mjs')) {
  const mode = process.argv[2] === 'after' ? 'after' : 'before';
  runAudit({ mode });
}
