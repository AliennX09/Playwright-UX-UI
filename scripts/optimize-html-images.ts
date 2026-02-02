import fs from 'fs';
import path from 'path';

// CLI: node scripts/optimize-html-images.ts --dir <html-dir> --out <out-dir>
const inputDir = process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : './examples';
const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : './examples/optimized';

// find all HTML files under inputDir
function findHtmlFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(findHtmlFiles(full));
    else if (/\.html$/.test(e.name)) files.push(full);
  }
  return files;
}

const htmlFiles = findHtmlFiles(inputDir);
if (htmlFiles.length === 0) {
  console.error('No HTML files found in', inputDir);
  process.exit(1);
}

// ensure output directory exists
fs.mkdirSync(outDir, { recursive: true });

function parseAttrs(attrString: string) {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrString))) {
    attrs[m[1]] = m[3] || m[4] || m[5] || '';
  }
  return attrs;
}

function buildAttrString(attrs: Record<string, string>) {
  return Object.keys(attrs)
    .map(k => (attrs[k] === '' ? `${k}` : `${k}="${attrs[k]}"`))
    .join(' ');
}

for (const inFile of htmlFiles) {
  try {
    let html = fs.readFileSync(inFile, 'utf8');
  const imgTagRegexLocal = /<img\s+([^>]+?)\s*\/?>/gi;
  let preloadLinksLocal: string[] = [];
  html = html.replace(imgTagRegexLocal, (match, attrText) => {
    const attrs = parseAttrs(attrText);
    const src = attrs['src'] || '';
    const isHero = attrs['data-hero'] === 'true' || /hero|banner/i.test(attrText);

    // Ensure alt exists
    if (!('alt' in attrs)) {
      attrs['alt'] = '';
    }

    // Add loading attribute: hero -> eager, others -> lazy
    if (isHero) {
      attrs['loading'] = attrs['loading'] || 'eager';
    } else {
      attrs['loading'] = attrs['loading'] || 'lazy';
    }

    // Add width/height placeholders if missing (prefer explicit attributes)
    if (!('width' in attrs) && !('height' in attrs)) {
      // heuristic: if src has "w=1920" use large sizes
      if (/w=1920/.test(src) || /1920/.test(src)) {
        attrs['width'] = '1920'; attrs['height'] = '1080';
      } else {
        attrs['width'] = attrs['width'] || '800'; attrs['height'] = attrs['height'] || '450';
      }
    }

    // Add srcset for Next.js _next/image style and other images
    if (!('srcset' in attrs)) {
      if (/\/_next\/image\?/.test(src)) {
        // create srcset by replacing w param
        const srcBase = src.replace(/(&|\?)w=\d+/, '');
        const widths = [640, 1080, 1920];
        const srcset = widths.map(w => `${srcBase}${src.includes('?') ? '&' : '?'}w=${w}&q=75 ${w}w`).join(', ');
        attrs['srcset'] = srcset;
        attrs['sizes'] = attrs['sizes'] || '100vw';
      } else if (/\.(png|jpe?g|gif)$/i.test(src)) {
        // add basic srcset heuristic
        const widths = [640, 1080, 1920];
        const srcset = widths.map(w => `${src}?w=${w} ${w}w`).join(', ');
        attrs['srcset'] = srcset;
        attrs['sizes'] = attrs['sizes'] || '100vw';
      }
    }

    // If hero image, add a preload link (avoid duplicates)
    if (isHero && src) {
      const preloadHref = src.includes('?') ? src : src;
      if (!preloadLinksLocal.includes(preloadHref)) preloadLinksLocal.push(preloadHref);
      // also add fetchpriority
      attrs['fetchpriority'] = 'high';
    }

    // ensure decoding attribute exists
    attrs['decoding'] = attrs['decoding'] || 'async';

    const newTag = `<img ${buildAttrString(attrs)} />`;
    if (newTag !== match) {
      console.log('Updated <img> in', inFile, ':', src);
    }
    return newTag;
  });

  // Inject preload links for hero images right after <head> in that file (case-insensitive)
  if (preloadLinksLocal.length > 0) {
    const preloadHtml = preloadLinksLocal.map(h => `<link rel="preload" as="image" href="${h}">`).join('\n  ');
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${preloadHtml}`);
  }

  // write output file
  const relOut = path.join(outDir, path.relative(inputDir, inFile));
  const outDirForFile = path.dirname(relOut);
  fs.mkdirSync(outDirForFile, { recursive: true });
  fs.writeFileSync(relOut, html);
  console.log('Optimized HTML written to', relOut);
  } catch (err) {
    console.error('Error processing file', inFile, err);
    continue;
  }
}

console.log(`Processed ${htmlFiles.length} HTML files from ${inputDir} -> ${outDir}`);
