import { chromium } from 'playwright';

jest.setTimeout(120_000);

describe('Accessibility CI check (axe)', () => {
  test('no critical/serious axe violations', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.goto('https://jigsawaiteam.com/', { waitUntil: 'networkidle' });

    // Try loading axe from local package if available, otherwise fallback to CDN
    try {
      // @ts-ignore
      const axePath = require.resolve('axe-core/axe.min.js');
      await page.addScriptTag({ path: axePath });
    } catch (e) {
      await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js' });
    }

    // Run axe
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return (window as any).axe.run();
    });

    const violations = results.violations || [];
    const critical = violations.filter((v: any) => v.impact === 'critical');
    const serious = violations.filter((v: any) => v.impact === 'serious');

    // Fail the test if any critical violations exist or serious > 2
    const maxSeriousAllowed = 2;

    if (critical.length > 0 || serious.length > maxSeriousAllowed) {
      const msg = `A11y check failed: critical=${critical.length}, serious=${serious.length}. Top issues: ${violations.slice(0,5).map((v: any) => `${v.id}:${v.impact}`).join(', ')}`;
      await browser.close();
      throw new Error(msg);
    }

    await browser.close();
    expect(critical.length).toBe(0);
    expect(serious.length).toBeLessThanOrEqual(maxSeriousAllowed);
  });
});
