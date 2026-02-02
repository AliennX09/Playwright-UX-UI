import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ScreenshotAnalyzer, ElementIssue } from '../utils/screenshot-analyzer';

// ========================================
// Types & Interfaces
// ========================================

interface TestResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
  elements?: ElementIssue[];
  recommendations?: string[];
}

interface LargestContentfulPaintEntry {
  startTime: number;
  renderTime: number;
  loadTime: number;
  size: number | null;
  url: string | null;
  element: string | null;
  toString?: string | null;
}

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  largestContentfulPaintEntry?: LargestContentfulPaintEntry | null;
  totalSize: number;
  requestCount: number;
}

interface AccessibilityIssue {
  type: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  description: string;
  wcagLevel: string;
}

interface ResponsiveTestResult {
  device: string;
  width: number;
  height: number;
  issues: string[];
  screenshot?: string;
}

interface UXReport {
  url: string;
  testDate: string;
  overallScore: number;
  results: TestResult[];
  performance: PerformanceMetrics;
  accessibility: AccessibilityIssue[];
  responsive: ResponsiveTestResult[];
  recommendations: string[];
}

// ========================================
// Configuration
// ========================================

const config = {
  url: 'https://jigsawaiteam.com/',
  outputDir: path.join(__dirname, '../../outputs/ux-report'),
  screenshotsDir: path.join(__dirname, '../../outputs/ux-report/screenshots'),
  devices: [
    { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
    { name: 'Desktop 1366x768', width: 1366, height: 768 },
    { name: 'Tablet iPad', width: 768, height: 1024 },
    { name: 'Mobile iPhone 12', width: 390, height: 844 },
    { name: 'Mobile Samsung S21', width: 360, height: 800 },
  ],
  timeouts: {
    navigation: 30000,
    default: 10000,
  },
};

// ========================================
// UX/UI Testing Class
// ========================================

export class UXUITester {
  private browser!: Browser;
  private context!: BrowserContext;
  private page!: Page;
  private results: TestResult[] = [];
  private performanceMetrics: PerformanceMetrics = {
    loadTime: 0,
    domContentLoaded: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    totalSize: 0,
    requestCount: 0,
  };
  private accessibilityIssues: AccessibilityIssue[] = [];
  private responsiveResults: ResponsiveTestResult[] = [];
  private screenshotAnalyzer!: ScreenshotAnalyzer;

  constructor() {
    this.setupDirectories();
    this.screenshotAnalyzer = new ScreenshotAnalyzer(config.screenshotsDir);
  }

  private setupDirectories(): void {
    [config.outputDir, config.screenshotsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // ========================================
  // Browser Setup
  // ========================================

  async initialize(): Promise<void> {
    console.log('🚀 Initializing browser...');
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    this.page = await this.context.newPage();
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up...');
    await this.browser.close();
  }

  // ========================================
  // Helper Methods
  // ========================================

  private addResult(
    category: string,
    test: string,
    status: 'pass' | 'fail' | 'warning',
    score: number,
    details: string,
    severity: 'high' | 'medium' | 'low' = 'medium',
    elements?: ElementIssue[],
    recommendations?: string[]
  ): void {
    this.results.push({
      category,
      test,
      status,
      score,
      details,
      severity,
      timestamp: new Date().toISOString(),
      elements,
      recommendations,
    });
  }

  private async takeScreenshot(name: string): Promise<string> {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(config.screenshotsDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  // ========================================
  // Performance Testing
  // ========================================

  async testPerformance(): Promise<void> {
    console.log('⚡ Testing performance...');
    
    const startTime = Date.now();
    
    // Get performance metrics (page already loaded by runAllTests)
    const loadTime = Date.now() - startTime;

    // Get performance metrics from browser
    const metrics = await this.page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
      };
    });

    // Get resource metrics
    const resources = await this.page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return {
        count: entries.length,
        totalSize: entries.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      };
    });

    // Get LCP (capture entry details using buffered observer)
    const lcpResult = await this.page.evaluate(() => {
      return new Promise<any>((resolve) => {
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any || null;
            if (!lastEntry) return;
            const e: any = lastEntry;
            const entry = {
              startTime: e.startTime || 0,
              renderTime: e.renderTime || e.loadTime || 0,
              loadTime: e.loadTime || 0,
              size: e.size || null,
              url: e.url || null,
              element: e.element ? (e.element.outerHTML || e.element.tagName) : null,
              toString: e.toString ? e.toString() : null,
            };
            resolve({ value: entry.renderTime, entry });
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (err) {
          resolve({ value: 0, entry: null });
        }

        setTimeout(() => resolve({ value: 0, entry: null }), 5000);
      });
    });

    const lcp = lcpResult?.value || 0;
    const lcpEntry = lcpResult?.entry || null;

    this.performanceMetrics = {
      loadTime,
      domContentLoaded: metrics.domContentLoaded,
      firstPaint: metrics.firstPaint,
      firstContentfulPaint: metrics.firstContentfulPaint,
      largestContentfulPaint: lcp,
      largestContentfulPaintEntry: lcpEntry,
      totalSize: resources.totalSize,
      requestCount: resources.count,
    };

    // Evaluate performance
    const loadScore = loadTime < 3000 ? 10 : loadTime < 5000 ? 7 : loadTime < 8000 ? 4 : 1;
    this.addResult(
      'Performance',
      'Page Load Time',
      loadTime < 3000 ? 'pass' : loadTime < 5000 ? 'warning' : 'fail',
      loadScore,
      `Page loaded in ${loadTime}ms. Recommended: < 3000ms`,
      loadTime > 5000 ? 'high' : 'medium'
    );

    const lcpScore = lcp < 2500 ? 10 : lcp < 4000 ? 7 : 4;
    this.addResult(
      'Performance',
      'Largest Contentful Paint',
      lcp < 2500 ? 'pass' : lcp < 4000 ? 'warning' : 'fail',
      lcpScore,
      `LCP: ${Math.round(lcp)}ms. Recommended: < 2500ms`,
      lcp > 4000 ? 'high' : 'medium'
    );

    const sizeScore = resources.totalSize < 3000000 ? 10 : resources.totalSize < 5000000 ? 7 : 4;
    this.addResult(
      'Performance',
      'Total Page Size',
      resources.totalSize < 3000000 ? 'pass' : 'warning',
      sizeScore,
      `Total size: ${(resources.totalSize / 1024 / 1024).toFixed(2)}MB, ${resources.count} requests`,
      'low'
    );
  }

  // ========================================
  // Visual & Layout Testing
  // ========================================

  async testVisualHierarchy(): Promise<void> {
    console.log('👁️  Testing visual hierarchy...');

    // Check for H1
    const h1Count = await this.page.locator('h1').count();
    this.addResult(
      'Visual Design',
      'H1 Heading',
      h1Count === 1 ? 'pass' : 'fail',
      h1Count === 1 ? 10 : 0,
      `Found ${h1Count} H1 tag(s). Recommended: exactly 1`,
      h1Count === 0 ? 'high' : 'medium'
    );

    // Check heading hierarchy
    const headings = await this.page.evaluate(() => {
      const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      return tags.map(tag => ({
        tag,
        count: document.querySelectorAll(tag).length
      }));
    });

    const hasProperHierarchy = headings[0].count > 0 && headings[1].count > 0;
    this.addResult(
      'Visual Design',
      'Heading Hierarchy',
      hasProperHierarchy ? 'pass' : 'warning',
      hasProperHierarchy ? 10 : 6,
      `Heading structure: ${headings.map(h => `${h.tag}:${h.count}`).join(', ')}`,
      'medium'
    );

    // Check for alt text on images
    const images = await this.page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const withoutAlt = imgs.filter(img => !img.alt || img.alt.trim() === '');
      return {
        total: imgs.length,
        withoutAlt: withoutAlt.length,
        missingAltSelectors: withoutAlt.slice(0, 3).map((img, i) => {
          return img.id ? `#${img.id}` : img.className ? `.${img.className.split(' ')[0]}` : `img:nth-of-type(${i})`;
        })
      };
    });

    // Capture screenshots of images missing alt text
    if (images.missingAltSelectors.length > 0) {
      for (const selector of images.missingAltSelectors) {
        try {
          await this.screenshotAnalyzer.recordProblemArea(
            this.page,
            'Visual Design',
            'Image Alt Text',
            selector,
            'Image missing alt text - impacts accessibility',
            'high',
            'Add descriptive alt text to all images for better accessibility',
            true
          );
        } catch (e) {
          // Continue if screenshot fails
        }
      }
    }

    const altScore = images.withoutAlt === 0 ? 10 : Math.max(0, 10 - (images.withoutAlt * 2));
    this.addResult(
      'Visual Design',
      'Image Alt Text',
      images.withoutAlt === 0 ? 'pass' : 'fail',
      altScore,
      `${images.withoutAlt} out of ${images.total} images missing alt text`,
      images.withoutAlt > 0 ? 'high' : 'low'
    );
  }

  // ========================================
  // Navigation Testing
  // ========================================

  async testNavigation(): Promise<void> {
    console.log('🧭 Testing navigation...');

    // Check for navigation element
    const navExists = await this.page.locator('nav, [role="navigation"]').count() > 0;
    this.addResult(
      'Navigation',
      'Navigation Element',
      navExists ? 'pass' : 'fail',
      navExists ? 10 : 0,
      navExists ? 'Navigation element found' : 'No semantic navigation element found',
      'high'
    );

    // Check for logo/home link
    const logoExists = await this.page.evaluate(() => {
      const selectors = [
        'a[href="/"]', 
        'a[href="./"]',
        '.logo a',
        '.brand a',
        'nav a:first-child'
      ];
      return selectors.some(selector => document.querySelector(selector) !== null);
    });

    this.addResult(
      'Navigation',
      'Logo/Home Link',
      logoExists ? 'pass' : 'warning',
      logoExists ? 10 : 7,
      logoExists ? 'Logo/home link found' : 'No clear home link found',
      'medium'
    );

    // Check menu items
    const menuItems = await this.page.evaluate(() => {
      const nav = document.querySelector('nav, [role="navigation"]');
      if (!nav) return [];
      const links = nav.querySelectorAll('a');
      return Array.from(links).map(a => ({
        text: a.textContent?.trim() || '',
        href: a.getAttribute('href') || ''
      }));
    });

    this.addResult(
      'Navigation',
      'Menu Items',
      menuItems.length > 0 ? 'pass' : 'fail',
      menuItems.length > 2 ? 10 : 5,
      `Found ${menuItems.length} navigation links`,
      'medium'
    );

    // Check for mobile menu (hamburger)
    const mobileMenuExists = await this.page.evaluate(() => {
      const selectors = [
        '.hamburger',
        '.menu-toggle',
        '.mobile-menu-button',
        '[aria-label*="menu" i]',
        'button[aria-expanded]'
      ];
      return selectors.some(selector => document.querySelector(selector) !== null);
    });

    this.addResult(
      'Navigation',
      'Mobile Menu',
      mobileMenuExists ? 'pass' : 'warning',
      mobileMenuExists ? 10 : 7,
      mobileMenuExists ? 'Mobile menu button found' : 'No mobile menu button detected',
      'medium'
    );
  }

  // ========================================
  // Content & Readability Testing
  // ========================================

  async testReadability(): Promise<void> {
    console.log('📖 Testing readability...');

    const textMetrics = await this.page.evaluate(() => {
      const getComputedStyle = (el: Element) => window.getComputedStyle(el);
      
      // Check body text
      const bodyElements = Array.from(document.querySelectorAll('p, li, td, div:not(:has(p))'));
      const textElements = bodyElements.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.length > 20 && !el.querySelector('p, li');
      });

      const fontSizes = textElements.map(el => {
        const style = getComputedStyle(el);
        return parseFloat(style.fontSize);
      });

      const lineHeights = textElements.map(el => {
        const style = getComputedStyle(el);
        const lineHeight = style.lineHeight;
        if (lineHeight === 'normal') return 1.5;
        return parseFloat(lineHeight) / parseFloat(style.fontSize);
      });

      // Check contrast
      const contrastIssues: any[] = [];
      textElements.slice(0, 50).forEach(el => {
        const style = getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        if (color && bgColor) {
          // Simplified contrast check
          contrastIssues.push({ color, bgColor });
        }
      });

      return {
        avgFontSize: fontSizes.length > 0 ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 0,
        minFontSize: Math.min(...fontSizes),
        avgLineHeight: lineHeights.length > 0 ? lineHeights.reduce((a, b) => a + b, 0) / lineHeights.length : 0,
        textElementsCount: textElements.length,
      };
    });

    // Font size check
    const fontSizeScore = textMetrics.minFontSize >= 16 ? 10 : textMetrics.minFontSize >= 14 ? 7 : 4;
    this.addResult(
      'Readability',
      'Font Size',
      textMetrics.minFontSize >= 16 ? 'pass' : 'warning',
      fontSizeScore,
      `Minimum font size: ${textMetrics.minFontSize.toFixed(1)}px. Recommended: >= 16px`,
      textMetrics.minFontSize < 14 ? 'high' : 'medium'
    );

    // Line height check
    const lineHeightScore = textMetrics.avgLineHeight >= 1.5 ? 10 : textMetrics.avgLineHeight >= 1.3 ? 7 : 4;
    this.addResult(
      'Readability',
      'Line Height',
      textMetrics.avgLineHeight >= 1.5 ? 'pass' : 'warning',
      lineHeightScore,
      `Average line height: ${textMetrics.avgLineHeight.toFixed(2)}. Recommended: >= 1.5`,
      'low'
    );

    // Check for text overflow
    const hasOverflow = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let overflowCount = 0;
      elements.forEach(el => {
        if (el.scrollWidth > el.clientWidth) {
          overflowCount++;
        }
      });
      return overflowCount;
    });

    this.addResult(
      'Readability',
      'Text Overflow',
      hasOverflow === 0 ? 'pass' : 'warning',
      hasOverflow === 0 ? 10 : 7,
      hasOverflow > 0 ? `${hasOverflow} elements with horizontal overflow detected` : 'No overflow detected',
      'medium'
    );
  }

  // ========================================
  // Color Contrast Testing
  // ========================================

  async testColorContrast(): Promise<void> {
    console.log('🎨 Testing color contrast...');

    const contrastIssues = await this.page.evaluate(() => {
      // Simple contrast calculation function
      const getContrast = (rgb1: string, rgb2: string): number => {
        const getLuminance = (r: number, g: number, b: number): number => {
          const [rs, gs, bs] = [r, g, b].map(x => {
            x = x / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };

        const parseRgb = (rgb: string): [number, number, number] => {
          const match = rgb.match(/\d+/g);
          return match ? [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])] : [0, 0, 0];
        };

        const [r1, g1, b1] = parseRgb(rgb1);
        const [r2, g2, b2] = parseRgb(rgb2);

        const l1 = getLuminance(r1, g1, b1);
        const l2 = getLuminance(r2, g2, b2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);

        return (lighter + 0.05) / (darker + 0.05);
      };

      const issues: any[] = [];
      const textElements = Array.from(document.querySelectorAll('p, a, button, label, h1, h2, h3, h4, h5, h6, li, span'))
        .slice(0, 100); // Check first 100 elements

      textElements.forEach((el, index) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        const text = el.textContent?.trim() || '';

        if (text.length > 0 && color && bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
          try {
            const contrast = getContrast(color, bgColor);
            // WCAG AA: 4.5:1 for normal text
            if (contrast < 4.5) {
              const selector = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : `${el.tagName.toLowerCase()}:nth-of-type(${index})`;
              issues.push({
                tag: el.tagName,
                selector: selector,
                contrast: contrast.toFixed(2),
                text: text.substring(0, 50)
              });
            }
          } catch (e) {
            // Skip if parsing fails
          }
        }
      });

      return issues;
    });

    // Record problem areas with recommendations
    const recommendations: string[] = [];
    if (contrastIssues.length > 0) {
      recommendations.push('Increase contrast ratio between text and background colors');
      recommendations.push('Use tools like WebAIM Color Contrast Checker to validate WCAG AA compliance (4.5:1)');
      recommendations.push('Consider using darker text on light backgrounds or lighter text on dark backgrounds');
      
      // Capture screenshots of low contrast elements
      for (const issue of contrastIssues.slice(0, 2)) {
        try {
          await this.screenshotAnalyzer.recordProblemArea(
            this.page,
            'Visual Design',
            'Color Contrast',
            issue.selector,
            `Text has low contrast ratio (${issue.contrast}:1, requires 4.5:1)`,
            'high',
            'Increase contrast ratio to meet WCAG AA standards (4.5:1)',
            true
          );
        } catch (e) {
          // Continue if screenshot fails
        }
      }
    }

    const score = contrastIssues.length === 0 ? 10 : Math.max(0, 10 - (contrastIssues.length * 0.5));
    this.addResult(
      'Visual Design',
      'Color Contrast (WCAG AA)',
      contrastIssues.length === 0 ? 'pass' : 'warning',
      score,
      contrastIssues.length === 0 
        ? 'All text has sufficient contrast' 
        : `${contrastIssues.length} text elements have low contrast (< 4.5:1)`,
      contrastIssues.length > 5 ? 'high' : 'medium',
      undefined,
      recommendations
    );
  }

  // ========================================
  // CTA & Button Testing
  // ========================================

  async testCTAButtons(): Promise<void> {
    console.log('🔘 Testing CTA buttons...');

    const buttonAnalysis = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
      
      const ctas = buttons.filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        const ctaKeywords = ['subscribe', 'contact', 'get started', 'learn more', 'download', 'buy', 'register', 'sign up', 'join', 'submit'];
        return ctaKeywords.some(kw => text.includes(kw));
      });

      const smallCTAs = ctas.filter(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width < 80 || rect.height < 40;
      });

      const analysis = {
        totalCTAs: ctas.length,
        smallCTAs: smallCTAs.length,
        smallCTASelectors: smallCTAs.slice(0, 1).map((btn, i) => {
          return btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : `button:nth-of-type(${i})`;
        }),
        notVisible: ctas.filter(btn => {
          const rect = btn.getBoundingClientRect();
          return rect.top < 0 || rect.top > window.innerHeight;
        }).length,
        withAriaLabel: ctas.filter(btn => btn.getAttribute('aria-label')).length,
      };

      return analysis;
    });

    // Capture screenshot of small CTA buttons
    if (buttonAnalysis.smallCTASelectors.length > 0) {
      for (const selector of buttonAnalysis.smallCTASelectors) {
        try {
          await this.screenshotAnalyzer.recordProblemArea(
            this.page,
            'Interactive Elements',
            'CTA Buttons Size',
            selector,
            'CTA button is too small (< 80x40px)',
            'high',
            'Increase button size to at least 80x40px for better usability',
            true
          );
        } catch (e) {
          // Continue if screenshot fails
        }
      }
    }

    const visibility = buttonAnalysis.totalCTAs > buttonAnalysis.notVisible ? 'pass' : 'warning';
    
    const recommendations: string[] = [];
    if (buttonAnalysis.smallCTAs > 0) {
      recommendations.push('Increase CTA button size to at least 80x40px for better touch targets');
      recommendations.push('Ensure buttons are easily clickable on mobile devices (minimum 44x44px recommended)');
    }
    if (buttonAnalysis.notVisible > 0) {
      recommendations.push('Move CTA buttons above the fold to improve visibility');
      recommendations.push('Ensure primary CTAs are visible without scrolling on initial page load');
    }
    if (buttonAnalysis.withAriaLabel < buttonAnalysis.totalCTAs) {
      recommendations.push('Add proper aria-label attributes to all CTA buttons for accessibility');
    }
    
    this.addResult(
      'Interactive Elements',
      'Call-to-Action Buttons',
      visibility,
      buttonAnalysis.totalCTAs > 0 ? (buttonAnalysis.notVisible === 0 ? 10 : 7) : 5,
      `Found ${buttonAnalysis.totalCTAs} CTA buttons, ${buttonAnalysis.smallCTAs} are too small, ${buttonAnalysis.notVisible} not visible above fold`,
      buttonAnalysis.smallCTAs > 2 ? 'high' : 'medium',
      undefined,
      recommendations.length > 0 ? recommendations : undefined
    );
  }

  // ========================================
  // Keyboard Navigation Testing
  // ========================================

  async testKeyboardNavigation(): Promise<void> {
    console.log('⌨️  Testing keyboard navigation...');

    const keyboardAnalysis = await this.page.evaluate(() => {
      const focusableSelectors = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(document.querySelectorAll(focusableSelectors));

      const analysis = {
        totalFocusable: focusable.length,
        withoutVisibleFocus: focusable.filter(el => {
          const style = window.getComputedStyle(el);
          const outline = style.outline;
          const boxShadow = style.boxShadow;
          return outline === 'none' && !boxShadow.includes('rgb');
        }).length,
        tabIndexIssues: focusable.filter(el => {
          const tabindex = el.getAttribute('tabindex');
          return tabindex && parseInt(tabindex) > 0;
        }).length,
      };

      return analysis;
    });

    const recommendations: string[] = [];
    if (keyboardAnalysis.withoutVisibleFocus > 0) {
      recommendations.push('Add visible focus indicators to all interactive elements');
      recommendations.push('Use CSS :focus or :focus-visible pseudo-classes with clear styling (outline, box-shadow, or border)');
      recommendations.push('Ensure focus styles have sufficient contrast to be visible');
    }
    if (keyboardAnalysis.tabIndexIssues > 0) {
      recommendations.push('Avoid using positive tabindex values; let natural HTML order define tab sequence');
      recommendations.push('Use tabindex="0" for elements that need focus but are not naturally focusable');
    }

    this.addResult(
      'Accessibility',
      'Keyboard Navigation',
      keyboardAnalysis.totalFocusable > 3 ? 'pass' : 'warning',
      Math.min(10, keyboardAnalysis.totalFocusable),
      `${keyboardAnalysis.totalFocusable} focusable elements, ${keyboardAnalysis.withoutVisibleFocus} without visible focus, ${keyboardAnalysis.tabIndexIssues} with positive tabindex`,
      keyboardAnalysis.withoutVisibleFocus > 5 ? 'high' : 'medium',
      undefined,
      recommendations.length > 0 ? recommendations : undefined
    );
  }

  // ========================================
  // SEO Basics Testing
  // ========================================

  async testSEOBasics(): Promise<void> {
    console.log('🔍 Testing SEO basics...');

    const seoAnalysis = await this.page.evaluate(() => {
      return {
        hasMetaDescription: !!document.querySelector('meta[name="description"]'),
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        hasMetaKeywords: !!document.querySelector('meta[name="keywords"]'),
        hasCanonical: !!document.querySelector('link[rel="canonical"]'),
        hasOGTags: !!document.querySelector('meta[property^="og:"]'),
        hasStructuredData: !!document.querySelector('script[type="application/ld+json"]'),
        hasH1: document.querySelectorAll('h1').length > 0,
        title: document.title,
        titleLength: document.title.length,
      };
    });

    // Meta description
    const descScore = seoAnalysis.hasMetaDescription && seoAnalysis.metaDescription.length >= 120 && seoAnalysis.metaDescription.length <= 160 ? 10 : 7;
    const descRecommendations: string[] = [];
    if (!seoAnalysis.hasMetaDescription) {
      descRecommendations.push('Add a meta description tag in the <head> section');
    }
    if (seoAnalysis.metaDescription.length < 120 || seoAnalysis.metaDescription.length > 160) {
      descRecommendations.push('Keep meta description between 120-160 characters for optimal display in search results');
    }

    this.addResult(
      'SEO',
      'Meta Description',
      seoAnalysis.hasMetaDescription ? 'pass' : 'fail',
      descScore,
      seoAnalysis.hasMetaDescription ? 
        `Found (${seoAnalysis.metaDescription.length} chars)` : 
        'Missing meta description',
      seoAnalysis.hasMetaDescription ? 'low' : 'high',
      undefined,
      descRecommendations.length > 0 ? descRecommendations : undefined
    );

    // Title tag
    const titleScore = seoAnalysis.titleLength >= 30 && seoAnalysis.titleLength <= 60 ? 10 : 7;
    const titleRecommendations: string[] = [];
    if (!seoAnalysis.title || seoAnalysis.titleLength === 0) {
      titleRecommendations.push('Add a meaningful page title in the <head> section');
    }
    if (seoAnalysis.titleLength < 30 || seoAnalysis.titleLength > 60) {
      titleRecommendations.push('Keep page title between 30-60 characters for optimal search result display');
    }

    this.addResult(
      'SEO',
      'Page Title',
      seoAnalysis.title ? 'pass' : 'fail',
      titleScore,
      `"${seoAnalysis.title.substring(0, 50)}..." (${seoAnalysis.titleLength} chars)`,
      'low',
      undefined,
      titleRecommendations.length > 0 ? titleRecommendations : undefined
    );

    // Canonical tag
    this.addResult(
      'SEO',
      'Canonical Tag',
      seoAnalysis.hasCanonical ? 'pass' : 'warning',
      seoAnalysis.hasCanonical ? 10 : 7,
      seoAnalysis.hasCanonical ? 'Canonical tag present' : 'No canonical tag found',
      'low',
      undefined,
      seoAnalysis.hasCanonical ? undefined : ['Add a canonical tag to prevent duplicate content issues']
    );

    // Structured data
    this.addResult(
      'SEO',
      'Structured Data',
      seoAnalysis.hasStructuredData ? 'pass' : 'warning',
      seoAnalysis.hasStructuredData ? 10 : 5,
      seoAnalysis.hasStructuredData ? 'JSON-LD structured data found' : 'No structured data detected',
      'medium',
      undefined,
      seoAnalysis.hasStructuredData ? undefined : ['Add JSON-LD structured data (schema.org) to help search engines understand your content']
    );
  }

  // ========================================
  // Form Testing
  // ========================================

  async testForms(): Promise<void> {
    console.log('📝 Testing forms...');

    const formAnalysis = await this.page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      
      const inputsWithLabels = inputs.filter(input => {
        const id = input.id;
        if (!id) return false;
        return document.querySelector(`label[for="${id}"]`) !== null;
      });

      const requiredInputs = inputs.filter(input => 
        input.hasAttribute('required') || input.getAttribute('aria-required') === 'true'
      );

      const inputsWithPlaceholder = inputs.filter(input => 
        input.getAttribute('placeholder') !== null && input.getAttribute('placeholder') !== ''
      );

      return {
        formCount: forms.length,
        inputCount: inputs.length,
        inputsWithLabelsCount: inputsWithLabels.length,
        requiredCount: requiredInputs.length,
        placeholderCount: inputsWithPlaceholder.length,
      };
    });

    if (formAnalysis.formCount === 0) {
      this.addResult(
        'Forms',
        'Form Existence',
        'pass',
        10,
        'No forms found on this page',
        'low'
      );
      return;
    }

    // Label association
    const labelScore = formAnalysis.inputsWithLabelsCount === formAnalysis.inputCount ? 10 : 
                       formAnalysis.inputsWithLabelsCount > 0 ? 5 : 0;
    this.addResult(
      'Forms',
      'Input Labels',
      formAnalysis.inputsWithLabelsCount === formAnalysis.inputCount ? 'pass' : 'fail',
      labelScore,
      `${formAnalysis.inputsWithLabelsCount} out of ${formAnalysis.inputCount} inputs have associated labels`,
      formAnalysis.inputsWithLabelsCount < formAnalysis.inputCount ? 'high' : 'low'
    );

    // Required field indication
    this.addResult(
      'Forms',
      'Required Fields',
      'pass',
      10,
      `${formAnalysis.requiredCount} required fields marked`,
      'low'
    );

    // Placeholder usage
    this.addResult(
      'Forms',
      'Placeholder Text',
      formAnalysis.placeholderCount > 0 ? 'pass' : 'warning',
      formAnalysis.placeholderCount > 0 ? 10 : 7,
      `${formAnalysis.placeholderCount} inputs have placeholder text`,
      'low'
    );
  }

  // ========================================
  // Interactive Elements Testing
  // ========================================

  async testInteractiveElements(): Promise<void> {
    console.log('🖱️  Testing interactive elements...');

    const interactiveAnalysis = await this.page.evaluate(() => {
      // Check buttons
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));
      
      // Check links
      const links = Array.from(document.querySelectorAll('a'));
      const externalLinks = links.filter(a => {
        const href = a.getAttribute('href') || '';
        return href.startsWith('http') && !href.includes(window.location.hostname);
      });

      // Check for hover states
      const elementsWithHover = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el, ':hover');
        return style.cursor === 'pointer';
      });

      // Check touch targets
      const smallTouchTargets = buttons.filter(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      });

      return {
        buttonCount: buttons.length,
        linkCount: links.length,
        externalLinkCount: externalLinks.length,
        smallTouchTargetCount: smallTouchTargets.length,
      };
    });

    // Button test
    this.addResult(
      'Interactive Elements',
      'Buttons',
      interactiveAnalysis.buttonCount > 0 ? 'pass' : 'warning',
      interactiveAnalysis.buttonCount > 0 ? 10 : 7,
      `Found ${interactiveAnalysis.buttonCount} buttons`,
      'low'
    );

    // Link test
    this.addResult(
      'Interactive Elements',
      'Links',
      interactiveAnalysis.linkCount > 0 ? 'pass' : 'warning',
      interactiveAnalysis.linkCount > 0 ? 10 : 7,
      `Found ${interactiveAnalysis.linkCount} links (${interactiveAnalysis.externalLinkCount} external)`,
      'low'
    );

    // Touch target size
    const touchScore = interactiveAnalysis.smallTouchTargetCount === 0 ? 10 : 
                       interactiveAnalysis.smallTouchTargetCount < 3 ? 7 : 4;
    this.addResult(
      'Interactive Elements',
      'Touch Target Size',
      interactiveAnalysis.smallTouchTargetCount === 0 ? 'pass' : 'warning',
      touchScore,
      `${interactiveAnalysis.smallTouchTargetCount} buttons/links smaller than 44x44px`,
      interactiveAnalysis.smallTouchTargetCount > 3 ? 'high' : 'medium'
    );
  }

  // ========================================
  // Responsive Design Testing
  // ========================================

  async testResponsive(): Promise<void> {
    console.log('📱 Testing responsive design across configured devices...');

    for (const device of config.devices) {
      try {
        const isMobile = /mobile|iphone|android|s21/i.test(device.name) || device.width <= 420;
        const ctx = await this.browser.newContext({
          viewport: { width: device.width, height: device.height },
          isMobile,
        });
        const p = await ctx.newPage();
        await p.goto(config.url, { waitUntil: 'networkidle', timeout: config.timeouts.navigation });

        const issues: string[] = [];

        // Horizontal scroll
        const hasHorizontalScroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (hasHorizontalScroll) issues.push('Horizontal scrollbar detected');

        // Text readability
        const textTooSmall = await p.evaluate(() => {
          const textElements = Array.from(document.querySelectorAll('p, li, span, div')) as HTMLElement[];
          const tooSmall = textElements.filter(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            const text = el.textContent?.trim() || '';
            return text.length > 10 && fontSize < 14;
          });
          return tooSmall.length;
        });
        if (textTooSmall > 5) issues.push(`${textTooSmall} text elements smaller than 14px`);

        // Touch target check (for mobile/tablet)
        if (isMobile) {
          const smallTargets = await p.evaluate(() => {
            const els = Array.from(document.querySelectorAll('a, button, input, [role="button"]')) as HTMLElement[];
            return els.filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44;
            }).length;
          });
          if (smallTargets > 0) issues.push(`${smallTargets} touch targets smaller than 44x44`);
        }

        // Screenshot for visual inspection
        const screenshotPath = path.join(config.screenshotsDir, `${device.name.replace(/\s+/g, '_')}-${Date.now()}.png`);
        await p.screenshot({ path: screenshotPath, fullPage: true });

        this.responsiveResults.push({ device: device.name, width: device.width, height: device.height, issues, screenshot: screenshotPath });

        const deviceScore = issues.length === 0 ? 10 : issues.length === 1 ? 7 : 5;
        this.addResult(
          'Responsive Design',
          device.name,
          issues.length === 0 ? 'pass' : 'warning',
          deviceScore,
          issues.length === 0 ? 'No issues detected' : issues.join(', '),
          issues.length > 1 ? 'medium' : 'low'
        );

        await p.close();
        await ctx.close();
      } catch (err) {
        console.log(`  ℹ️  Responsive testing for ${device.name} encountered an issue: ${err}`);
        this.addResult(
          'Responsive Design',
          device.name,
          'warning',
          5,
          'Could not fully test responsive design for this device',
          'low'
        );
      }
    }
  }

  // ========================================
  // Accessibility Testing
  // ========================================

  async testAccessibility(): Promise<void> {
    console.log('♿ Testing accessibility...');

    try {
      // Load axe-core, prefer CDN then fallback to local package
      let axeLoaded = false;
      try {
        await this.page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js' });
        axeLoaded = await this.page.evaluate(() => typeof (window as any).axe !== 'undefined');
      } catch (cdnErr) {
        // ignore
      }

      if (!axeLoaded) {
        try {
          // @ts-ignore - dynamic require
          const axePath = require.resolve('axe-core/axe.min.js');
          await this.page.addScriptTag({ path: axePath });
          axeLoaded = await this.page.evaluate(() => typeof (window as any).axe !== 'undefined');
          if (axeLoaded) console.log('  ℹ️  Axe-core loaded from local package');
        } catch (localErr) {
          console.log('  ℹ️  Axe-core could not be loaded (CDN & local fallback failed)');
        }
      } else {
        console.log('  ℹ️  Axe-core loaded from CDN');
      }

      // Run axe if available and report structured issues and recommendations
      if (axeLoaded) {
        const axeResults = await this.page.evaluate(async () => {
          // @ts-ignore
          return (window as any).axe.run();
        });

        const violations = axeResults.violations || [];

        const ruleRecommendations: Record<string, string> = {
          'button-name': 'Ensure buttons with only icons have accessible names (aria-label or visually hidden text)',
          'aria-input-field-name': 'Provide accessible names for form inputs (label element or aria-label)',
          'color-contrast': 'Increase color contrast to meet WCAG AA (4.5:1 for normal text)',
          'scrollable-region-focusable': 'Ensure scrollable regions are keyboard focusable and have a visible focus indicator',
        };

        violations.forEach((violation: any) => {
          const severity = violation.impact === 'critical' || violation.impact === 'serious' ? 'high' : 
                          violation.impact === 'moderate' ? 'medium' : 'minor';

          this.accessibilityIssues.push({
            type: violation.id,
            severity: violation.impact,
            element: violation.nodes[0]?.target.join(', ') || 'Unknown',
            description: violation.description,
            wcagLevel: violation.tags.filter((t: string) => t.startsWith('wcag')).join(', '),
          });

          // Add a specific failing result for important rules
          if (ruleRecommendations[violation.id]) {
            this.addResult(
              'Accessibility',
              violation.id,
              'fail',
              0,
              `${violation.help}: ${violation.nodes[0]?.target.join(', ')}`,
              'high',
              undefined,
              [ruleRecommendations[violation.id]]
            );
          }
        });
      } else {
        this.addResult(
          'Accessibility',
          'axe-core',
          'warning',
          5,
          'axe-core could not be loaded; accessibility automated checks were limited',
          'low'
        );
      }

      // Keyboard navigation test (simulate Tab and ensure focus moves)
      try {
        const focusedSelectors = new Set<string>();
        for (let i = 0; i < 30; i++) {
          await this.page.keyboard.press('Tab');
          // capture a simple descriptor of the activeElement
          const desc = await this.page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el) return 'none';
            const id = el.id ? `#${el.id}` : '';
            const cls = (el.className && typeof el.className === 'string') ? `.${(el.className as string).split(' ')[0]}` : '';
            return `${el.tagName}${id}${cls}`;
          });
          focusedSelectors.add(desc || 'none');
        }

        this.addResult(
          'Accessibility',
          'Keyboard Navigation',
          focusedSelectors.size > 1 ? 'pass' : 'fail',
          focusedSelectors.size > 1 ? 10 : 0,
          `${focusedSelectors.size} distinct focus targets reached via Tab`,
          focusedSelectors.size > 1 ? 'low' : 'high'
        );
      } catch (e) {
        this.addResult(
          'Accessibility',
          'Keyboard Navigation',
          'warning',
          5,
          'Could not simulate keyboard navigation',
          'low'
        );
      }

      // Skip link detection
      try {
        const hasSkipLink = await this.page.evaluate(() => {
          return !!document.querySelector('a.skip, a[href="#main"], a[href="#content"], a[href^="#skip"]');
        });

        this.addResult(
          'Accessibility',
          'Skip Link',
          hasSkipLink ? 'pass' : 'warning',
          hasSkipLink ? 10 : 7,
          hasSkipLink ? 'Skip link present' : 'Consider adding a "skip to content" link for keyboard users',
          hasSkipLink ? 'low' : 'medium'
        );
      } catch (e) {
        this.addResult(
          'Accessibility',
          'Skip Link',
          'warning',
          5,
          'Could not test for skip link',
          'low'
        );
      }

      // Language attribute
      try {
        const hasLang = await this.page.evaluate(() => {
          return document.documentElement.hasAttribute('lang');
        });

        this.addResult(
          'Accessibility',
          'Language Attribute',
          hasLang ? 'pass' : 'fail',
          hasLang ? 10 : 0,
          hasLang ? 'Language attribute present' : 'Missing lang attribute on <html>',
          'high'
        );
      } catch (e) {
        this.addResult(
          'Accessibility',
          'Language Attribute',
          'warning',
          5,
          'Could not test language attribute',
          'low'
        );
      }

      // ARIA landmarks
      try {
        const landmarks = await this.page.evaluate(() => {
          const landmarkRoles = ['banner', 'navigation', 'main', 'contentinfo', 'complementary'];
          return landmarkRoles.map(role => ({
            role,
            count: document.querySelectorAll(`[role="${role}"]`).length + 
                   (role === 'banner' ? document.querySelectorAll('header').length : 0) +
                   (role === 'navigation' ? document.querySelectorAll('nav').length : 0) +
                   (role === 'main' ? document.querySelectorAll('main').length : 0) +
                   (role === 'contentinfo' ? document.querySelectorAll('footer').length : 0)
          }));
        });

        const hasMainLandmark = landmarks.find(l => l.role === 'main' && l.count > 0);
        this.addResult(
          'Accessibility',
          'ARIA Landmarks',
          hasMainLandmark ? 'pass' : 'warning',
          hasMainLandmark ? 10 : 7,
          `Landmarks found: ${landmarks.filter(l => l.count > 0).map(l => l.role).join(', ')}`,
          'medium'
        );
      } catch (e) {
        this.addResult(
          'Accessibility',
          'ARIA Landmarks',
          'warning',
          5,
          'Could not test ARIA landmarks',
          'low'
        );
      }

      // Overall accessibility score
      const criticalCount = this.accessibilityIssues.filter(i => i.severity === 'critical' || i.severity === 'serious').length;
      const accessibilityScore = criticalCount === 0 ? 10 : criticalCount <= 2 ? 7 : criticalCount <= 5 ? 4 : 1;
      
      this.addResult(
        'Accessibility',
        'Overall A11y Issues',
        criticalCount === 0 ? 'pass' : criticalCount <= 2 ? 'warning' : 'fail',
        accessibilityScore,
        `${this.accessibilityIssues.length} total issues (${criticalCount} critical/serious)`,
        criticalCount > 2 ? 'high' : 'medium'
      );
    } catch (error) {
      console.log('  ⚠️  Accessibility testing encountered an error but continuing...');
      this.addResult(
        'Accessibility',
        'Overall A11y Issues',
        'warning',
        5,
        'Accessibility testing could not be fully completed',
        'low'
      );
    }
  }

  // ========================================
  // Generate Recommendations
  // ========================================

  generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze results and generate recommendations
    const highPriorityIssues = this.results.filter(r => r.severity === 'high' && r.status === 'fail');
    const mediumPriorityIssues = this.results.filter(r => r.severity === 'medium' && r.status === 'fail');

    if (highPriorityIssues.length > 0) {
      recommendations.push(`🔴 HIGH PRIORITY: Found ${highPriorityIssues.length} critical issues that need immediate attention`);
      highPriorityIssues.slice(0, 3).forEach(issue => {
        recommendations.push(`   • ${issue.category} - ${issue.test}: ${issue.details}`);
      });
    }

    if (this.performanceMetrics.loadTime > 3000) {
      recommendations.push('⚡ Optimize page load time by compressing images, minifying CSS/JS, and enabling caching');
    }

    if (this.performanceMetrics.largestContentfulPaint > 2500) {
      recommendations.push('⚡ Improve Largest Contentful Paint (LCP) by optimizing above-the-fold content');
    }

    // If we have LCP entry details, add a targeted recommendation
    if (this.performanceMetrics.largestContentfulPaintEntry && this.performanceMetrics.largestContentfulPaintEntry.url) {
      const lcpUrl = this.performanceMetrics.largestContentfulPaintEntry.url;
      recommendations.push(`⚡ Consider optimizing LCP resource: ${lcpUrl} — compress/convert (AVIF/WebP), resize to display size, or preload if it is the hero image`);
    }

    const missingAltImages = this.results.find(r => r.test === 'Image Alt Text' && r.status === 'fail');
    if (missingAltImages) {
      recommendations.push('♿ Add descriptive alt text to all images for better accessibility');
    }

    const responsiveIssues = this.responsiveResults.filter(r => r.issues.length > 0);
    if (responsiveIssues.length > 0) {
      recommendations.push(`📱 Fix responsive design issues on ${responsiveIssues.map(r => r.device).join(', ')}`);
    }

    const criticalA11yIssues = this.accessibilityIssues.filter(i => i.severity === 'critical' || i.severity === 'serious');
    if (criticalA11yIssues.length > 0) {
      recommendations.push(`♿ Address ${criticalA11yIssues.length} critical accessibility issues for WCAG compliance`);
    }

    if (mediumPriorityIssues.length > 5) {
      recommendations.push(`🟡 MEDIUM PRIORITY: ${mediumPriorityIssues.length} issues that should be addressed soon`);
    }

    // Add general best practices
    recommendations.push('📊 Consider implementing user analytics to track real user behavior');
    recommendations.push('🔍 Conduct user testing with real users to validate these findings');
    recommendations.push('✅ Create a prioritized action plan based on severity and business impact');

    return recommendations;
  }

  // ========================================
  // Generate Report
  // ========================================

  async generateReport(): Promise<UXReport> {
    console.log('📊 Generating report...');

    // Calculate overall score
    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = this.results.length * 10;
    const overallScore = Math.round((totalScore / maxScore) * 100);

    const recommendations = this.generateRecommendations();

    const report: UXReport = {
      url: config.url,
      testDate: new Date().toISOString(),
      overallScore,
      results: this.results,
      performance: this.performanceMetrics,
      accessibility: this.accessibilityIssues,
      responsive: this.responsiveResults,
      recommendations,
    };

    return report;
  }

  // ========================================
  // Main Test Runner
  // ========================================

  async runAllTests(): Promise<UXReport> {
    console.log('🎬 Starting UX/UI tests...\n');

    try {
      await this.initialize();
      
      // Navigate to the website
      console.log(`🌐 Navigating to ${config.url}...`);
      await this.page.goto(config.url, { 
        waitUntil: 'networkidle',
        timeout: config.timeouts.navigation 
      });

      // Run all tests
      await this.testPerformance();
      await this.testVisualHierarchy();
      await this.testColorContrast();
      await this.testNavigation();
      await this.testReadability();
      await this.testCTAButtons();
      await this.testForms();
      await this.testInteractiveElements();
      await this.testKeyboardNavigation();
      await this.testSEOBasics();
      await this.testResponsive();
      await this.testAccessibility();

      // Generate report
      const report = await this.generateReport();

      console.log('\n✅ All tests completed!\n');

      return report;

    } catch (error) {
      console.error('❌ Error during testing:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// ========================================
// Report Generator (HTML)
// ========================================

class ReportGenerator {
  static generateHTML(report: UXReport): string {
    const categorizedResults = this.categorizeResults(report.results);
    
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UX/UI Testing Report - ${new URL(report.url).hostname}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { font-size: 1.1em; opacity: 0.9; }
    .score-section {
      padding: 40px;
      text-align: center;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }
    .score-circle {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4em;
      font-weight: bold;
      color: white;
      background: ${this.getScoreColor(report.overallScore)};
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .score-label { font-size: 1.2em; color: #666; }
    .content {
      padding: 40px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
      color: #667eea;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .metric-label {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #333;
    }
    .test-results {
      margin-bottom: 30px;
    }
    .category-section {
      margin-bottom: 30px;
    }
    .category-title {
      font-size: 1.3em;
      margin-bottom: 15px;
      color: #555;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .test-item {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .status-badge {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-pass { background: #4caf50; }
    .status-fail { background: #f44336; }
    .status-warning { background: #ff9800; }
    .test-info {
      flex: 1;
    }
    .test-name {
      font-weight: 600;
      margin-bottom: 3px;
    }
    .test-details {
      font-size: 0.9em;
      color: #666;
    }
    .severity-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
    }
    .severity-high { background: #ffebee; color: #c62828; }
    .severity-medium { background: #fff3e0; color: #ef6c00; }
    .severity-low { background: #e8f5e9; color: #2e7d32; }
    .recommendations {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      border-radius: 4px;
    }
    .recommendations li {
      margin-bottom: 10px;
      line-height: 1.8;
    }
    .accessibility-issues {
      margin-top: 20px;
    }
    .issue-item {
      background: #fff;
      border-left: 3px solid #f44336;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 4px;
    }
    .issue-type {
      font-weight: 600;
      color: #d32f2f;
      margin-bottom: 3px;
    }
    .issue-description {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 5px;
    }
    .issue-wcag {
      font-size: 0.85em;
      color: #999;
    }
    .responsive-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .device-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .device-header {
      background: #667eea;
      color: white;
      padding: 12px;
      font-weight: 600;
    }
    .device-content {
      padding: 15px;
    }
    .device-issues {
      margin-top: 10px;
    }
    .device-issue {
      background: #ffebee;
      color: #c62828;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.9em;
      margin-bottom: 5px;
    }
    .no-issues {
      color: #4caf50;
      font-weight: 600;
    }
    .screenshot {
      max-width: 100%;
      border-radius: 4px;
      margin-top: 10px;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 0.9em;
      border-top: 1px solid #e0e0e0;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>รายงานการทดสอบ UX/UI</h1>
      <p>${report.url}</p>
      <p>วันที่ทดสอบ: ${new Date(report.testDate).toLocaleString('th-TH')}</p>
    </div>

    <div class="score-section">
      <div class="score-circle">${report.overallScore}</div>
      <div class="score-label">คะแนนรวม UX/UI</div>
    </div>

    <div class="content">
      <!-- Performance Metrics -->
      <div class="section">
        <h2 class="section-title">⚡ Performance Metrics</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">เวลาโหลดหน้า</div>
            <div class="metric-value">${(report.performance.loadTime / 1000).toFixed(2)}s</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">First Contentful Paint</div>
            <div class="metric-value">${Math.round(report.performance.firstContentfulPaint)}ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Largest Contentful Paint</div>
            <div class="metric-value">${Math.round(report.performance.largestContentfulPaint)}ms</div>
            ${report.performance.largestContentfulPaintEntry ? `<div class="metric-note">LCP element: ${report.performance.largestContentfulPaintEntry.element ? report.performance.largestContentfulPaintEntry.element.replace(/</g,'&lt;').replace(/>/g,'&gt;') : report.performance.largestContentfulPaintEntry.url || 'n/a'} (${report.performance.largestContentfulPaintEntry.size ? (report.performance.largestContentfulPaintEntry.size/1024).toFixed(1)+'KB' : 'size n/a'})</div>` : ''}
          </div>
          <div class="metric-card">
            <div class="metric-label">ขนาดหน้าเว็บ</div>
            <div class="metric-value">${(report.performance.totalSize / 1024 / 1024).toFixed(2)}MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">จำนวน Requests</div>
            <div class="metric-value">${report.performance.requestCount}</div>
          </div>
        </div>
      </div>

      <!-- Test Results by Category -->
      <div class="section">
        <h2 class="section-title">📋 ผลการทดสอบโดยรายละเอียด</h2>
        ${this.renderTestResults(categorizedResults)}
      </div>

      <!-- Summary Stats -->
      <div class="section">
        <h2 class="section-title">📊 สรุปผลการทดสอบ</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">ทั้งหมด</div>
            <div class="metric-value">${report.results.length}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ผ่าน ✅</div>
            <div class="metric-value">${report.results.filter(r => r.status === 'pass').length}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">คำเตือน ⚠️</div>
            <div class="metric-value">${report.results.filter(r => r.status === 'warning').length}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ล้มเหลว ❌</div>
            <div class="metric-value">${report.results.filter(r => r.status === 'fail').length}</div>
          </div>
        </div>
      </div>

      <!-- Accessibility Issues -->
      ${report.accessibility.length > 0 ? `
      <div class="section">
        <h2 class="section-title">♿ ปัญหา Accessibility</h2>
        <div class="accessibility-issues">
          ${report.accessibility.slice(0, 10).map(issue => `
            <div class="issue-item">
              <div class="issue-type">${issue.type} <span class="severity-badge severity-${this.mapSeverity(issue.severity)}">${issue.severity}</span></div>
              <div class="issue-description">${issue.description}</div>
              <div class="issue-wcag">WCAG: ${issue.wcagLevel} | Element: ${issue.element}</div>
            </div>
          `).join('')}
          ${report.accessibility.length > 10 ? `<p style="margin-top: 15px; color: #666;">และอีก ${report.accessibility.length - 10} ปัญหา...</p>` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Responsive Design -->
      <div class="section">
        <h2 class="section-title">📱 Responsive Design</h2>
        <div class="responsive-grid">
          ${report.responsive.map(device => `
            <div class="device-card">
              <div class="device-header">${device.device} (${device.width}x${device.height})</div>
              <div class="device-content">
                ${device.issues.length === 0 
                  ? '<p class="no-issues">✅ ไม่พบปัญหา</p>' 
                  : `<div class="device-issues">
                       ${device.issues.map(issue => `<div class="device-issue">⚠️ ${issue}</div>`).join('')}
                     </div>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Recommendations -->
      <div class="section">
        <h2 class="section-title">💡 คำแนะนำ</h2>
        <div class="recommendations">
          <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>รายงานนี้สร้างโดย Automated UX/UI Testing Tool</p>
      <p>สำหรับข้อมูลเพิ่มเติมหรือคำถาม กรุณาติดต่อทีมพัฒนา</p>
    </div>
  </div>
</body>
</html>`;
  }

  static categorizeResults(results: TestResult[]): Map<string, TestResult[]> {
    const categorized = new Map<string, TestResult[]>();
    results.forEach(result => {
      if (!categorized.has(result.category)) {
        categorized.set(result.category, []);
      }
      categorized.get(result.category)!.push(result);
    });
    return categorized;
  }

  static renderTestResults(categorized: Map<string, TestResult[]>): string {
    let html = '';
    categorized.forEach((results, category) => {
      html += `
        <div class="category-section">
          <div class="category-title">
            ${this.getCategoryIcon(category)} ${category}
          </div>
          ${results.map(result => `
            <div class="test-item">
              <div class="status-badge status-${result.status}"></div>
              <div class="test-info">
                <div class="test-name">${result.test}</div>
                <div class="test-details">${result.details}</div>
              </div>
              <span class="severity-badge severity-${result.severity}">${result.severity}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
    return html;
  }

  static getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Performance': '⚡',
      'Visual Design': '👁️',
      'Navigation': '🧭',
      'Readability': '📖',
      'Forms': '📝',
      'Interactive Elements': '🖱️',
      'Responsive Design': '📱',
      'Accessibility': '♿',
      'SEO': '🔍',
    };
    return icons[category] || '📌';
  }

  static getScoreColor(score: number): string {
    if (score >= 80) return 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
    if (score >= 60) return 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
    return 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
  }

  static mapSeverity(severity: string): string {
    const map: Record<string, string> = {
      'critical': 'high',
      'serious': 'high',
      'moderate': 'medium',
      'minor': 'low',
    };
    return map[severity] || 'medium';
  }
}

// ========================================
// Main Execution
// ========================================

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   UX/UI Automated Testing Tool      ║');
  console.log('║   Created for jigsawaiteam.com      ║');
  console.log('╚══════════════════════════════════════╝\n');

  const tester = new UXUITester();

  try {
    const report = await tester.runAllTests();

    // Save JSON report
    const jsonPath = path.join(config.outputDir, 'ux-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report saved: ${jsonPath}`);

    // Generate and save HTML report
    const html = ReportGenerator.generateHTML(report);
    const htmlPath = path.join(config.outputDir, 'ux-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved: ${htmlPath}`);

    // Print summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Total Tests: ${report.results.length}`);
    console.log(`Passed: ${report.results.filter(r => r.status === 'pass').length}`);
    console.log(`Failed: ${report.results.filter(r => r.status === 'fail').length}`);
    console.log(`Warnings: ${report.results.filter(r => r.status === 'warning').length}`);
    console.log(`Accessibility Issues: ${report.accessibility.length}`);
    console.log('═'.repeat(50) + '\n');

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { ReportGenerator, UXReport };
