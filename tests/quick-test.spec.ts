import { UXUITester } from '../src/testers/ux-ui-tester';

jest.setTimeout(120_000); // allow up to 2 minutes for the end-to-end run

describe('End-to-end UX/UI run (quick)', () => {
  test('runAllTests completes and returns a valid report', async () => {
    const tester = new UXUITester();

    const report = await tester.runAllTests();

    expect(report).toBeDefined();
    expect(typeof report.overallScore).toBe('number');
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.performance).toBeDefined();
    expect(report.performance.largestContentfulPaint).toBeGreaterThanOrEqual(0);

    // Basic smoke assertions for accessibility results structure
    expect(Array.isArray(report.accessibility)).toBe(true);
  });
});
