import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ========================================
// Screenshot & Element Analysis
// ========================================

export interface ElementIssue {
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
  screenshotPath?: string;
}

export interface ProblemArea {
  category: string;
  test: string;
  issues: ElementIssue[];
  fullPageScreenshot?: string;
}

export class ScreenshotAnalyzer {
  private screenshotsDir: string;
  private problemAreas: ProblemArea[] = [];

  constructor(screenshotsDir: string) {
    this.screenshotsDir = screenshotsDir;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Take a full page screenshot and save it
   */
  async takeFullPageScreenshot(page: Page, testName: string): Promise<string> {
    const filename = `${testName}-fullpage-${Date.now()}.png`;
    const filepath = path.join(this.screenshotsDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  /**
   * Take screenshot of a specific element
   */
  async takeElementScreenshot(
    page: Page,
    selector: string,
    testName: string
  ): Promise<string | null> {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      
      if (count === 0) {
        return null;
      }

      const filename = `${testName}-element-${Date.now()}.png`;
      const filepath = path.join(this.screenshotsDir, filename);
      await locator.first().screenshot({ path: filepath });
      return filepath;
    } catch (error) {
      console.error(`Failed to capture element: ${selector}`, error);
      return null;
    }
  }

  /**
   * Record element coordinates and create problem area report
   */
  async recordProblemArea(
    page: Page,
    category: string,
    test: string,
    selector: string,
    description: string,
    severity: 'high' | 'medium' | 'low',
    recommendation: string,
    takeScreenshot: boolean = true
  ): Promise<ElementIssue | null> {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();

      if (count === 0) {
        return null;
      }

      // Get element coordinates
      const boundingBox = await locator.first().boundingBox();
      if (!boundingBox) {
        return null;
      }

      // Take screenshot if requested
      let screenshotPath: string | undefined;
      if (takeScreenshot) {
        screenshotPath = await this.takeElementScreenshot(page, selector, `${category}-${test}`) || undefined;
      }

      const issue: ElementIssue = {
        selector,
        x: Math.round(boundingBox.x),
        y: Math.round(boundingBox.y),
        width: Math.round(boundingBox.width),
        height: Math.round(boundingBox.height),
        description,
        severity,
        recommendation,
        screenshotPath,
      };

      // Store in problem areas
      this.storeProblemArea(category, test, issue);

      return issue;
    } catch (error) {
      console.error(`Error recording problem area for ${selector}:`, error);
      return null;
    }
  }

  /**
   * Store problem area for reporting
   */
  private storeProblemArea(category: string, test: string, issue: ElementIssue): void {
    const existing = this.problemAreas.find(pa => pa.category === category && pa.test === test);
    
    if (existing) {
      existing.issues.push(issue);
    } else {
      this.problemAreas.push({
        category,
        test,
        issues: [issue],
      });
    }
  }

  /**
   * Get all problem areas
   */
  getProblemAreas(): ProblemArea[] {
    return this.problemAreas;
  }

  /**
   * Clear recorded problem areas
   */
  clearProblemAreas(): void {
    this.problemAreas = [];
  }

  /**
   * Get fix recommendations grouped by category
   */
  getRecommendationsByCategory(): Record<string, string[]> {
    const recommendations: Record<string, string[]> = {};

    this.problemAreas.forEach(area => {
      if (!recommendations[area.category]) {
        recommendations[area.category] = [];
      }

      area.issues.forEach(issue => {
        if (!recommendations[area.category].includes(issue.recommendation)) {
          recommendations[area.category].push(issue.recommendation);
        }
      });
    });

    return recommendations;
  }

  /**
   * Get high severity issues
   */
  getHighSeverityIssues(): ElementIssue[] {
    return this.problemAreas
      .flatMap(pa => pa.issues)
      .filter(issue => issue.severity === 'high');
  }

  /**
   * Generate screenshot report with annotations
   */
  async generateAnnotatedScreenshot(
    page: Page,
    testName: string,
    issues: ElementIssue[]
  ): Promise<string | null> {
    try {
      // This would require additional libraries like sharp or canvas
      // For now, we'll return the full page screenshot path
      return await this.takeFullPageScreenshot(page, `annotated-${testName}`);
    } catch (error) {
      console.error('Failed to generate annotated screenshot:', error);
      return null;
    }
  }

  /**
   * Create a summary of all issues found
   */
  createIssueSummary(): {
    totalIssues: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const allIssues = this.problemAreas.flatMap(pa => pa.issues);
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };

    allIssues.forEach(issue => {
      const category = this.problemAreas.find(pa => pa.issues.includes(issue))?.category || 'Unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;
      bySeverity[issue.severity]++;
    });

    return {
      totalIssues: allIssues.length,
      byCategory,
      bySeverity,
    };
  }

  /**
   * Save problem areas to JSON for reporting
   */
  saveProblemAreasToFile(outputPath: string): void {
    const data = {
      timestamp: new Date().toISOString(),
      problemAreas: this.problemAreas,
      summary: this.createIssueSummary(),
      recommendations: this.getRecommendationsByCategory(),
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }
}
