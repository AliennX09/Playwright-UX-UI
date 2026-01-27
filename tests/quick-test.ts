import { UXUITester } from '../src/testers/ux-ui-tester';

/**
 * Quick Test Script - ทดสอบ Landing Page อย่างรวดเร็ว
 */

async function quickTest() {
  console.log('🚀 Starting Quick UX/UI Test...\n');

  const tester = new UXUITester();

  try {
    await tester.initialize();
    console.log('✅ Browser initialized\n');

    // Navigate to website
    await tester['page'].goto('https://jigsawaiteam.com/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ Page loaded\n');

    // Run core tests for quick assessment
    console.log('Running core landing page tests...');
    
    await tester.testPerformance();
    console.log('  ✓ Performance test done');
    
    await tester.testVisualHierarchy();
    console.log('  ✓ Visual hierarchy test done');
    
    await tester.testColorContrast();
    console.log('  ✓ Color contrast test done');
    
    await tester.testNavigation();
    console.log('  ✓ Navigation test done');
    
    await tester.testCTAButtons();
    console.log('  ✓ CTA buttons test done');
    
    await tester.testAccessibility();
    console.log('  ✓ Accessibility test done');
    
    await tester.testSEOBasics();
    console.log('  ✓ SEO basics test done');

    // Generate report BEFORE closing browser
    const report = await tester.generateReport();

    // Now cleanup
    await tester.cleanup();
    console.log('  ✓ Browser closed');

    console.log('\n' + '='.repeat(70));
    console.log('📊 LANDING PAGE QUICK TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`🎯 Overall Score: ${report.overallScore}/100`);
    console.log(`📝 Tests Run: ${report.results.length}`);
    console.log(`✅ Passed: ${report.results.filter(r => r.status === 'pass').length}`);
    console.log(`⚠️  Warnings: ${report.results.filter(r => r.status === 'warning').length}`);
    console.log(`❌ Failed: ${report.results.filter(r => r.status === 'fail').length}`);
    console.log('='.repeat(70));

    // Show critical issues
    const criticalIssues = report.results
      .filter(r => r.severity === 'high' && r.status === 'fail')
      .slice(0, 5);

    if (criticalIssues.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES (MUST FIX):');
      criticalIssues.forEach((issue, i) => {
        console.log(`${i + 1}. [${issue.category}] ${issue.test}`);
        console.log(`   └─ ${issue.details}\n`);
      });
    } else {
      console.log('\n✅ No critical issues found!');
    }

    // Show high priority warnings
    const warnings = report.results
      .filter(r => r.severity === 'high' && r.status === 'warning')
      .slice(0, 3);

    if (warnings.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY WARNINGS:');
      warnings.forEach((w, i) => {
        console.log(`${i + 1}. [${w.category}] ${w.test}`);
        console.log(`   └─ ${w.details}\n`);
      });
    }

    console.log('\n💡 View full detailed report in: ./outputs/ux-report/ux-report.html\n');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  }
}

// Run the quick test
quickTest().catch(console.error);
