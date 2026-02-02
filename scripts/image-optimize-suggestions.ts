import fs from 'fs';

const lcpAuditPath = './outputs/ux-report/lcp-audit.json';
const lcpObservePath = './outputs/ux-report/lcp-audit-observe.json';
const outPath = './outputs/ux-report/image-optimization-suggestions.md';

function humanSize(bytes: number) {
  if (!bytes) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const audit = fs.existsSync(lcpAuditPath) ? JSON.parse(fs.readFileSync(lcpAuditPath, 'utf8')) : null;
const observe = fs.existsSync(lcpObservePath) ? JSON.parse(fs.readFileSync(lcpObservePath, 'utf8')) : null;

const topResources = audit?.topResources || [];

const images = topResources.filter((r: any) => /\.(png|jpe?g|gif|svg|webp|avif)|_next\/image/.test(r.name));

const suggestions: string[] = [];

suggestions.push('# Image Optimization Suggestions\n');
if (!audit) {
  suggestions.push('*No LCP audit data found.*\n');
} else {
  suggestions.push(`**URL audited:** ${audit.url}\n`);
  suggestions.push('## Top large resources (by transfer size)\n');
  suggestions.push('| Resource | Type | Size | Initiator |');
  suggestions.push('|---|---:|---:|---|');
  topResources.slice(0, 20).forEach((r: any) => {
    suggestions.push(`| ${r.name} | ${r.initiatorType} | ${humanSize(r.transferSize)} | ${r.initiatorType} |`);
  });

  if (images.length > 0) {
    suggestions.push('\n## Image-specific recommendations\n');
    suggestions.push('These images are among the largest resources and are likely affecting LCP and total page size. Suggestions:');
    images.forEach((img: any) => {
      const name = img.name;
      const size = img.transferSize;
      const recs: string[] = [];
      // Determine recommendations
      if (/\.png$/i.test(name)) {
        recs.push('- Convert to WebP or AVIF for significantly smaller size.');
        recs.push('- Serve responsive sizes (srcset) or use Next.js Image optimization.');
      } else if (/\.jpe?g$/i.test(name)) {
        recs.push('- Convert to WebP/AVIF and compress (mozjpeg, guetzli).');
        recs.push('- Resize to required display size and use responsive images.');
      } else if (/\/_next\/image\?/i.test(name)) {
        recs.push('- Ensure images are served with optimal width and quality parameters in the URL.');
        recs.push('- Consider using modern formats (AVIF/WebP) and proper caching.');
      } else if (/\.svg$/i.test(name)) {
        recs.push('- Optimize SVG (svgo) and consider inlining small icons.');
      } else {
        recs.push('- Review formatting and compress if possible.');
      }

      // Hero detection heuristic
      const isHero = /chat|agent|demo|hero|banner|04afddb6/.test(name);
      if (isHero) {
        recs.push('- This looks like a hero/above-the-fold image: consider `preload` or inline critical image (very small placeholder + LQIP) and prioritize rendering.');
      } else {
        recs.push('- Lazy-load this image (loading="lazy") if it is not above-the-fold.');
      }

      suggestions.push(`### ${name}\n- Size: ${humanSize(size)}\n${recs.join('\n')}\n`);
    });

    suggestions.push('\n## Quick action items\n');
    suggestions.push('1. Identify top 3 largest images and convert to AVIF or WebP and resize to display size.');
    suggestions.push('2. Use `preload` for hero image OR use an inline critical placeholder to avoid image being LCP.');
    suggestions.push('3. Add `width` and `height` attributes or CSS aspect-ratio to avoid layout shifts.');
    suggestions.push('4. Serve images via optimized CDN with caching and compression.');
    suggestions.push('5. Re-run the tests and confirm LCP reduction.');
  } else {
    suggestions.push('\nNo large images found in top resources.');
  }
}

fs.writeFileSync(outPath, suggestions.join('\n'));
console.log('Image optimization suggestions saved to', outPath);
