import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const url = process.env.TEST_URL || 'https://jigsawaiteam.com/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Inject observer before any navigation
  await page.addInitScript(() => {
    (window as any).__lcpEntries = [];
    try {
      const po = new PerformanceObserver((list) => {
        (window as any).__lcpEntries.push(...list.getEntries().map(e => ({
          startTime: (e as any).startTime || 0,
          renderTime: (e as any).renderTime || 0,
          loadTime: (e as any).loadTime || 0,
          size: (e as any).size || null,
          url: (e as any).url || null,
          element: (e as any).element ? ((e as any).element.outerHTML || (e as any).element.tagName) : null,
          toString: e.toString(),
        })));
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      (window as any).__lcpError = `${e}`;
    }
  });

  console.log('Navigating to', url);
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  console.log('Status:', resp?.status());

  // Wait additional time to ensure LCP reported
  await page.waitForTimeout(7000);

  const report = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      url: location.href,
      navigation: nav ? {
        loadEventEnd: nav.loadEventEnd,
        domContentLoaded: nav.domContentLoadedEventEnd,
        domInteractive: nav.domInteractive
      } : null,
      lcpEntries: (window as any).__lcpEntries || [],
      lcpError: (window as any).__lcpError || null
    };
  });

  const outPath = './outputs/ux-report/lcp-audit-observe.json';
  fs.mkdirSync('./outputs/ux-report', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('LCP observe audit saved to', outPath);

  await browser.close();
})();
