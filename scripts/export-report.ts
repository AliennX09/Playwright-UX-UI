import * as path from 'path';
import { ReportConverter } from '../src/utils/report-converter';

/**
 * Export UX/UI Report to Multiple Formats
 * Converts JSON report to Excel and Word documents
 */

async function exportReport() {
  console.log('🔄 Exporting UX/UI Report to Multiple Formats...\n');

  const reportDir = path.join(__dirname, '../outputs/ux-report');
  const jsonReportPath = path.join(reportDir, 'ux-report.json');
  const excelPath = path.join(reportDir, 'ux-report.xlsx');
  const wordPath = path.join(reportDir, 'ux-report.docx');

  try {
    // Export to Excel
    ReportConverter.convertToExcel(jsonReportPath, excelPath);

    // Export to Word
    await ReportConverter.convertToWord(jsonReportPath, wordPath);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Report Export Complete!');
    console.log('='.repeat(60));
    console.log(`
📁 Report Files:
  📄 HTML:  ${path.join(reportDir, 'ux-report.html')}
  📊 Excel: ${excelPath}
  📝 Word:  ${wordPath}
  📋 JSON:  ${jsonReportPath}

📖 View Reports:
  - Excel: Open with Microsoft Excel or Google Sheets
  - Word:  Open with Microsoft Word or Google Docs
  - HTML:  Open in any web browser
    `);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error exporting report:', error);
    process.exit(1);
  }
}

// Run export
exportReport().catch(console.error);
