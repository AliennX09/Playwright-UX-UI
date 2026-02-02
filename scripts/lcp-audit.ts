import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const url = process.env.TEST_URL || 'https://jigsawaiteam.com/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to', url);
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  console.log('Status:', resp?.status());

  // Wait some extra time to allow LCP to settle
  await page.waitForTimeout(7000);

  const report = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const lcp = lcpEntries.map((e) => ({
      startTime: (e as any).startTime || 0,
      renderTime: (e as any).renderTime || 0,
      loadTime: (e as any).loadTime || 0,
      size: (e as any).size || null,
      element: (e as any).element ? ((e as any).element.outerHTML || (e as any).element.tagName) : null,
      url: (e as any).url || null,
      toString: e.toString(),
      entry: e.toJSON ? e.toJSON() : null,
    }));

    const topResources = resourceEntries
      .map(r => ({
        name: r.name,
        initiatorType: r.initiatorType,
        transferSize: r.transferSize || 0,
        duration: r.duration,
        startTime: r.startTime
      }))
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 20);

    return {
      url: location.href,
      navigation: nav ? {
        loadEventEnd: nav.loadEventEnd,
        domContentLoaded: nav.domContentLoadedEventEnd,
        domInteractive: nav.domInteractive
      } : null,
      lcpEntries: lcp,
      topResources
    };
  });

  const outPath = './outputs/ux-report/lcp-audit.json';
  fs.mkdirSync('./outputs/ux-report', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('LCP audit saved to', outPath);

  await browser.close();
})();
