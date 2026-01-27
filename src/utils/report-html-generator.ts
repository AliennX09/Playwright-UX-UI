import { ElementIssue } from './screenshot-analyzer';

export class ReportHTMLGenerator {
  /**
   * Generate HTML section for recommendations
   */
  static generateRecommendationsSection(recommendations: Record<string, string[]>): string {
    if (Object.keys(recommendations).length === 0) {
      return '';
    }

    let html = `
    <div class="section">
      <h2 class="section-title">📋 Fix Recommendations by Category</h2>
      <div class="recommendations-grid">
    `;

    Object.entries(recommendations).forEach(([category, items]) => {
      html += `
        <div class="recommendation-card">
          <h3>${category}</h3>
          <ul>
      `;

      items.forEach(item => {
        html += `<li>${item}</li>`;
      });

      html += `
          </ul>
        </div>
      `;
    });

    html += `
      </div>
    </div>
    `;

    return html;
  }

  /**
   * Generate HTML section for element issues with coordinates
   */
  static generateElementIssuesSection(issues: ElementIssue[]): string {
    if (issues.length === 0) {
      return '';
    }

    // Group issues by severity
    const byySeverity = {
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
    };

    let html = `
    <div class="section">
      <h2 class="section-title">🎯 Problem Elements & Coordinates</h2>
      <div class="elements-issues">
    `;

    // High severity issues
    if (byySeverity.high.length > 0) {
      html += this.generateIssueSeverityGroup('High Severity', byySeverity.high, 'high');
    }

    // Medium severity issues
    if (byySeverity.medium.length > 0) {
      html += this.generateIssueSeverityGroup('Medium Severity', byySeverity.medium, 'medium');
    }

    // Low severity issues
    if (byySeverity.low.length > 0) {
      html += this.generateIssueSeverityGroup('Low Severity', byySeverity.low, 'low');
    }

    html += `
      </div>
    </div>
    `;

    return html;
  }

  private static generateIssueSeverityGroup(title: string, issues: ElementIssue[], severity: string): string {
    const severityBadge = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    }[severity] || '⚪';

    let html = `
      <div class="severity-group">
        <h3>${severityBadge} ${title} (${issues.length} issues)</h3>
        <div class="issues-list">
    `;

    issues.forEach((issue, index) => {
      html += `
        <div class="issue-card">
          <div class="issue-header">
            <h4>#${index + 1}: ${issue.description}</h4>
            <span class="recommendation-tag">${issue.recommendation}</span>
          </div>
          <div class="issue-details">
            <table>
              <tr>
                <td><strong>CSS Selector:</strong></td>
                <td><code>${this.escapeHtml(issue.selector)}</code></td>
              </tr>
              <tr>
                <td><strong>Position:</strong></td>
                <td>X: ${issue.x}px, Y: ${issue.y}px</td>
              </tr>
              <tr>
                <td><strong>Size:</strong></td>
                <td>Width: ${issue.width}px, Height: ${issue.height}px</td>
              </tr>
      `;

      if (issue.screenshotPath) {
        html += `
              <tr>
                <td><strong>Screenshot:</strong></td>
                <td><a href="${this.getRelativePath(issue.screenshotPath)}" target="_blank">View Issue Screenshot</a></td>
              </tr>
        `;
      }

      html += `
            </table>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Get relative path for screenshot links
   */
  private static getRelativePath(fullPath: string): string {
    // Extract filename from path
    const parts = fullPath.split(/[\\\/]/);
    return `./screenshots/${parts[parts.length - 1]}`;
  }

  /**
   * Escape HTML characters
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate complete element issues and recommendations CSS
   */
  static generateElementIssuesCSS(): string {
    return `
    .recommendations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .recommendation-card {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      border-radius: 4px;
    }

    .recommendation-card h3 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 1.1em;
    }

    .recommendation-card ul {
      list-style: none;
      padding: 0;
    }

    .recommendation-card li {
      padding: 8px 0;
      padding-left: 20px;
      position: relative;
      color: #555;
      line-height: 1.5;
    }

    .recommendation-card li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #28a745;
      font-weight: bold;
    }

    .elements-issues {
      margin-top: 20px;
    }

    .severity-group {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 5px solid #667eea;
    }

    .severity-group h3 {
      margin-bottom: 20px;
      font-size: 1.2em;
      color: #333;
    }

    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .issue-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      transition: box-shadow 0.3s ease;
    }

    .issue-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      gap: 10px;
    }

    .issue-header h4 {
      color: #333;
      font-size: 1em;
      margin: 0;
      flex: 1;
    }

    .recommendation-tag {
      background: #667eea;
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      white-space: nowrap;
    }

    .issue-details table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
    }

    .issue-details table tr {
      border-bottom: 1px solid #e0e0e0;
    }

    .issue-details table tr:last-child {
      border-bottom: none;
    }

    .issue-details table td {
      padding: 10px;
      vertical-align: top;
    }

    .issue-details table td:first-child {
      width: 150px;
      color: #666;
      font-weight: 500;
    }

    .issue-details code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      word-break: break-all;
    }

    .issue-details a {
      color: #667eea;
      text-decoration: none;
      border-bottom: 1px dashed #667eea;
    }

    .issue-details a:hover {
      color: #764ba2;
      border-bottom-color: #764ba2;
    }
    `;
  }
}
