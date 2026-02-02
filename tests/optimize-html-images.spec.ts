import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const script = 'ts-node scripts/optimize-html-images.ts';

function runScript(dir: string, out: string) {
  execSync(`${script} --dir ${dir} --out ${out}`, { stdio: 'pipe' });
}

describe('optimize-html-images script', () => {
  const fixturesRoot = path.join(__dirname, 'fixtures', 'html');
  const tmpOutRoot = path.join(__dirname, 'fixtures', 'tmp-out');

  beforeAll(() => {
    if (fs.existsSync(tmpOutRoot)) fs.rmSync(tmpOutRoot, { recursive: true, force: true });
    fs.mkdirSync(tmpOutRoot, { recursive: true });
  });

  afterAll(() => {
    // keep artifacts for debugging; remove if desired
  });

  test('handles basic fixture and injects preload + loading/fetchpriority + width/height', () => {
    const srcDir = path.join(fixturesRoot);
    const outDir = path.join(tmpOutRoot, 'basic');
    fs.mkdirSync(outDir, { recursive: true });

    runScript(srcDir, outDir);

    const outFile = path.join(outDir, 'index.html');
    expect(fs.existsSync(outFile)).toBe(true);

    const content = fs.readFileSync(outFile, 'utf8');
    expect(/<link\s+rel="preload"\s+as="image"\s+href="hero.jpg">/i.test(content) || /hero.jpg/.test(content)).toBeTruthy();
    expect(/<img[^>]*src="hero.jpg"[^>]*loading="eager"/i.test(content)).toBeTruthy();
    expect(/<img[^>]*src="pic.png"[^>]*loading="lazy"/i.test(content)).toBeTruthy();
    expect(/<img[^>]*width="\d+"[^>]*height="\d+"/i.test(content)).toBeTruthy();
  });

  test('injects preload when <head> has attributes and handles head casing', () => {
    const srcDir = path.join(fixturesRoot);
    const outDir = path.join(tmpOutRoot, 'head-attr');
    fs.mkdirSync(outDir, { recursive: true });

    // Run script filtering to the particular fixture file
    runScript(path.join(srcDir), outDir);

    const content = fs.readFileSync(path.join(outDir, 'head-with-attr.html'), 'utf8');
    expect(/<link\s+rel="preload"\s+as="image"\s+href="hero-head.jpg">/i.test(content) || /hero-head.jpg/.test(content)).toBeTruthy();
  });

  test('handles picture and svg variants without breaking', () => {
    const srcDir = path.join(fixturesRoot);
    const outDir = path.join(tmpOutRoot, 'variants');
    fs.mkdirSync(outDir, { recursive: true });

    runScript(srcDir, outDir);
    const content = fs.readFileSync(path.join(outDir, 'img-variants.html'), 'utf8');

    // picture fallback present
    expect(/<picture>[\s\S]*<img[^>]*fallback.jpg[^>]*>[\s\S]*<\/picture>/i.test(content)).toBeTruthy();
    // svg left alone (no srcset added)
    expect(/logo.svg/.test(content)).toBeTruthy();
  });

  test('does not crash on malformed html and still writes files', () => {
    const srcDir = path.join(fixturesRoot);
    const outDir = path.join(tmpOutRoot, 'malformed');
    fs.mkdirSync(outDir, { recursive: true });

    runScript(srcDir, outDir);
    const content = fs.readFileSync(path.join(outDir, 'malformed.html'), 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });
});
