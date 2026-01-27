import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, HeadingLevel, UnderlineType, AlignmentType, BorderStyle } from 'docx';

interface TestResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface UXReport {
  url: string;
  testDate: string;
  overallScore: number;
  results: TestResult[];
  performance: any;
  accessibility: any[];
  responsive: any[];
  recommendations: string[];
}

class ReportConverter {
  static convertToExcel(reportPath: string, outputPath: string): void {
    console.log('📊 Converting report to Excel...');

    const report: UXReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['UX/UI Testing Report'],
      ['Website:', report.url],
      ['Test Date:', new Date(report.testDate).toLocaleString('th-TH')],
      [''],
      ['Overall Score', report.overallScore + '/100'],
      ['Total Tests', report.results.length],
      ['Passed', report.results.filter(r => r.status === 'pass').length],
      ['Failed', report.results.filter(r => r.status === 'fail').length],
      ['Warnings', report.results.filter(r => r.status === 'warning').length],
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWS['!cols'] = [{ wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

    // Performance sheet
    const perfData = [
      ['Performance Metrics'],
      ['Metric', 'Value', 'Status'],
      ['Page Load Time', `${(report.performance.loadTime / 1000).toFixed(2)}s`, report.performance.loadTime < 3000 ? 'Pass' : 'Warning'],
      ['First Contentful Paint', `${Math.round(report.performance.firstContentfulPaint)}ms`, report.performance.firstContentfulPaint < 2500 ? 'Pass' : 'Warning'],
      ['Largest Contentful Paint', `${Math.round(report.performance.largestContentfulPaint)}ms`, report.performance.largestContentfulPaint < 2500 ? 'Pass' : 'Warning'],
      ['Total Page Size', `${(report.performance.totalSize / 1024 / 1024).toFixed(2)}MB`, report.performance.totalSize < 3000000 ? 'Pass' : 'Warning'],
      ['Number of Requests', report.performance.requestCount.toString(), ''],
    ];
    const perfWS = XLSX.utils.aoa_to_sheet(perfData);
    perfWS['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, perfWS, 'Performance');

    // Test Results sheet
    const resultData = [
      ['Category', 'Test', 'Status', 'Score', 'Details', 'Severity'],
      ...report.results.map(r => [
        r.category,
        r.test,
        r.status,
        r.score,
        r.details,
        r.severity
      ])
    ];
    const resultsWS = XLSX.utils.aoa_to_sheet(resultData);
    resultsWS['!cols'] = [
      { wch: 18 },
      { wch: 25 },
      { wch: 10 },
      { wch: 8 },
      { wch: 45 },
      { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, resultsWS, 'Test Results');

    // Accessibility Issues sheet
    if (report.accessibility.length > 0) {
      const a11yData = [
        ['Accessibility Issues'],
        ['Type', 'Severity', 'Element', 'Description', 'WCAG Level'],
        ...report.accessibility.map(issue => [
          issue.type,
          issue.severity,
          issue.element,
          issue.description,
          issue.wcagLevel
        ])
      ];
      const a11yWS = XLSX.utils.aoa_to_sheet(a11yData);
      a11yWS['!cols'] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 30 },
        { wch: 40 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, a11yWS, 'Accessibility');
    }

    // Recommendations sheet
    const recData = [
      ['Recommendations'],
      [],
      ...report.recommendations.map(rec => [rec])
    ];
    const recWS = XLSX.utils.aoa_to_sheet(recData);
    recWS['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, recWS, 'Recommendations');

    // Save file
    XLSX.writeFile(wb, outputPath);
    console.log(`✅ Excel report saved: ${outputPath}`);
  }

  static convertToWord(reportPath: string, outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📄 Converting report to Word...');

        const report: UXReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

        const sections: any[] = [];

        // Title
        sections.push(
          new Paragraph({
            text: 'UX/UI Testing Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        );

        // Metadata
        sections.push(
          new Paragraph({
            text: `Website: ${report.url}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `Test Date: ${new Date(report.testDate).toLocaleString('th-TH')}`,
            spacing: { after: 200 }
          })
        );

        // Summary
        sections.push(
          new Paragraph({
            text: 'Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          })
        );

        const summaryTable = new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Overall Score', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: `${report.overallScore}/100` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Total Tests', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: report.results.length.toString() })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Passed', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: report.results.filter(r => r.status === 'pass').length.toString() })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Failed', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: report.results.filter(r => r.status === 'fail').length.toString() })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Warnings', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: report.results.filter(r => r.status === 'warning').length.toString() })] })
              ]
            })
          ]
        });

        sections.push(summaryTable);
        sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

        // Performance
        sections.push(
          new Paragraph({
            text: 'Performance Metrics',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          })
        );

        const perfTable = new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Metric', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: 'Value', run: { bold: true } })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Load Time' })] }),
                new TableCell({ children: [new Paragraph({ text: `${(report.performance.loadTime / 1000).toFixed(2)}s` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'First Contentful Paint' })] }),
                new TableCell({ children: [new Paragraph({ text: `${Math.round(report.performance.firstContentfulPaint)}ms` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Largest Contentful Paint' })] }),
                new TableCell({ children: [new Paragraph({ text: `${Math.round(report.performance.largestContentfulPaint)}ms` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Total Page Size' })] }),
                new TableCell({ children: [new Paragraph({ text: `${(report.performance.totalSize / 1024 / 1024).toFixed(2)}MB` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Number of Requests' })] }),
                new TableCell({ children: [new Paragraph({ text: report.performance.requestCount.toString() })] })
              ]
            })
          ]
        });

        sections.push(perfTable);
        sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

        // Test Results
        sections.push(
          new Paragraph({
            text: 'Test Results',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          })
        );

        const resultRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: 'Category', run: { bold: true } })] }),
              new TableCell({ children: [new Paragraph({ text: 'Test', run: { bold: true } })] }),
              new TableCell({ children: [new Paragraph({ text: 'Status', run: { bold: true } })] }),
              new TableCell({ children: [new Paragraph({ text: 'Details', run: { bold: true } })] })
            ]
          }),
          ...report.results.slice(0, 30).map(r => new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: r.category })] }),
              new TableCell({ children: [new Paragraph({ text: r.test })] }),
              new TableCell({ children: [new Paragraph({ text: r.status.toUpperCase() })] }),
              new TableCell({ children: [new Paragraph({ text: r.details })] })
            ]
          }))
        ];

        const resultTable = new Table({ rows: resultRows });
        sections.push(resultTable);

        if (report.results.length > 30) {
          sections.push(
            new Paragraph({
              text: `... and ${report.results.length - 30} more tests (see Excel report for full list)`,
              run: { italics: true },
              spacing: { after: 200 }
            })
          );
        }

        sections.push(new Paragraph({ text: '' }));

        // Accessibility Issues
        if (report.accessibility.length > 0) {
          sections.push(
            new Paragraph({
              text: 'Accessibility Issues',
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            })
          );

          const a11yRows = [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Type', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: 'Severity', run: { bold: true } })] }),
                new TableCell({ children: [new Paragraph({ text: 'Description', run: { bold: true } })] })
              ]
            }),
            ...report.accessibility.slice(0, 20).map(issue => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: issue.type })] }),
                new TableCell({ children: [new Paragraph({ text: issue.severity })] }),
                new TableCell({ children: [new Paragraph({ text: issue.description })] })
              ]
            }))
          ];

          const a11yTable = new Table({ rows: a11yRows });
          sections.push(a11yTable);
          sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));
        }

        sections.push(new Paragraph({ text: '' }));

        // Recommendations
        sections.push(
          new Paragraph({
            text: 'Recommendations',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          })
        );

        report.recommendations.forEach((rec, index) => {
          sections.push(
            new Paragraph({
              text: `${index + 1}. ${rec}`,
              spacing: { after: 100 }
            })
          );
        });

        // Create document
        const doc = new Document({
          sections: [{ children: sections }]
        });

        // Save file
        Packer.toBuffer(doc).then(buffer => {
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ Word report saved: ${outputPath}`);
          resolve();
        });
      } catch (error) {
        console.error('❌ Error converting to Word:', error);
        reject(error);
      }
    });
  }
}

export { ReportConverter };
