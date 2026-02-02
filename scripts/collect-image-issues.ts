import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const url = process.env.TEST_URL || 'https://jigsawaiteam.com/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);

  const images = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map((img, i) => {
      const rect = img.getBoundingClientRect();
      const altAttr = img.getAttribute('alt') || '';
      return {
        index: i,
        src: img.currentSrc || img.src || null,
        alt: altAttr,
        hasAlt: !!(altAttr && altAttr.trim().length > 0),
        ariaHidden: img.getAttribute('aria-hidden') === 'true',
        loading: img.getAttribute('loading') || null,
        naturalWidth: (img as any).naturalWidth || null,
        naturalHeight: (img as any).naturalHeight || null,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        top: rect.top,
        bottom: rect.bottom,
        isAboveFold: rect.top < (window.innerHeight || 900),
        class: img.className || null,
        id: img.id || null,
        outerHTML: img.outerHTML ? img.outerHTML.substring(0, 300) : null
      };
    });
  });

  const missing = images.filter(i => !i.hasAlt && !i.ariaHidden);
  const out = { url, totalImages: images.length, missingAltCount: missing.length, missingAlt: missing, all: images };
  fs.writeFileSync('./outputs/ux-report/image-issues.json', JSON.stringify(out, null, 2));
  console.log('Wrote image issues to ./outputs/ux-report/image-issues.json');

  await browser.close();
})();