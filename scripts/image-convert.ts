import fs from 'fs';
import path from 'path';
import https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'util';
import sharp from 'sharp';

const pipe = promisify(pipeline);

function usage() {
  console.log('Usage: ts-node scripts/image-convert.ts --dir <html-dir> --out <output-dir> [--apply] [--commit]');
  console.log('  --apply   Produce patched preview files (.patched) that show suggested replacements');
  console.log('  --commit  Overwrite original HTML files with patches (BACKUP created as .bak)');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const opts: any = {};
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--dir') opts.dir = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--apply') opts.apply = true;
  else if (a === '--commit') opts.commit = true;
}
if (!opts.dir || !opts.out) usage();

const htmlFiles = findHtmlFiles(opts.dir);
if (htmlFiles.length === 0) {
  console.log('No HTML files found in', opts.dir);
  process.exit(0);
}

const images = collectImageSrcsFromHtml(htmlFiles);
console.log(`Found ${images.length} unique images across ${htmlFiles.length} files`);

fs.mkdirSync(opts.out, { recursive: true });
const mapping: any = {};

(async () => {
  for (const img of images) {
    try {
      const local = await ensureLocalCopy(img, opts.out);
      if (!local) continue;
      const ext = path.extname(local).toLowerCase();
      if (ext === '.svg') {
        // skip conversion for svg - just copy
        const dest = path.join(opts.out, path.basename(local));
        fs.copyFileSync(local, dest);
        mapping[img] = mapping[img] || { originals: local, outputs: [] };
        mapping[img].outputs.push({ format: 'svg', path: dest });
        continue;
      }

      const widths = [640, 1080, 1920];
      mapping[img] = mapping[img] || { originals: local, outputs: [] };

      for (const w of widths) {
        const webp = path.join(opts.out, `${path.basename(local)}-w${w}.webp`);
        const avif = path.join(opts.out, `${path.basename(local)}-w${w}.avif`);
        await sharp(local)
          .resize({ width: w })
          .toFormat('webp', { quality: 80 })
          .toFile(webp);
        await sharp(local)
          .resize({ width: w })
          .toFormat('avif', { quality: 50 })
          .toFile(avif);
        mapping[img].outputs.push({ format: 'webp', path: webp, width: w });
        mapping[img].outputs.push({ format: 'avif', path: avif, width: w });
      }

      // Also create a compressed large jpg/png fallback
      const fallback = path.join(opts.out, `${path.basename(local)}-fallback.jpg`);
      await sharp(local).jpeg({ quality: 75 }).toFile(fallback);
      mapping[img].outputs.push({ format: 'jpeg', path: fallback });

      console.log('Converted', img, '->', mapping[img].outputs.length, 'files');
    } catch (err) {
      console.error('Error processing', img, err);
    }
  }

  const mapPath = path.join(opts.out, 'image-convert-mapping.json');
  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  console.log('Mapping written to', mapPath);

  // Optionally apply suggested srcset replacements (preview or commit)
  if (opts.apply || opts.commit) {
    applyHtmlPatches(htmlFiles, mapping, !!opts.commit);
    console.log(opts.commit ? 'Committed HTML patches to original files (backups created as .bak)' : 'Applied HTML patches to use optimized sources (inlined backups included)');
  } else {
    console.log('Run with --apply to have HTML files patched automatically (creates .patched previews). Use --commit to overwrite originals (backups saved as .bak).');
  }
})();

// ================= helper functions ================

function findHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...findHtmlFiles(full));
    else if (/\.html$/.test(e.name)) files.push(full);
  }
  return files;
}

function collectImageSrcsFromHtml(files: string[]): string[] {
  const set = new Set<string>();
  const imgTagRegex = /<img\s+([^>]+?)\s*\/?>/gi;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = imgTagRegex.exec(content))) {
      const attrs = parseAttrs(m[1]);
      const src = attrs['src'] || '';
      if (src && !src.startsWith('data:')) set.add(src);
    }
  }
  return Array.from(set);
}

function parseAttrs(attrString: string) {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrString))) {
    attrs[m[1]] = m[3] || m[4] || m[5] || '';
  }
  return attrs;
}

async function ensureLocalCopy(src: string, outDir: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const url = new URL(src);
      const basename = path.basename(url.pathname);
      const dest = path.join(outDir, basename);
      if (fs.existsSync(dest)) return dest;
      await downloadFile(src, dest);
      return dest;
    }
    // local path
    if (!path.isAbsolute(src)) {
      // assume relative to project root
      src = path.join(process.cwd(), src.replace(/^\//, ''));
    }
    if (fs.existsSync(src)) return src;
    console.warn('Local image not found, skipping:', src);
    return null;
  } catch (err) {
    console.error('Failed to fetch', src, err);
    return null;
  }
}

function downloadFile(urlStr: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      const fileStream = fs.createWriteStream(dest);
      pipe(res, fileStream).then(resolve).catch(reject);
    });
    req.on('error', reject);
  });
}

function applyHtmlPatches(htmlFiles: string[], mapping: any, commit = false) {
  for (const f of htmlFiles) {
    let content = fs.readFileSync(f, 'utf8');
    for (const [orig, info] of Object.entries(mapping)) {
      const outputs: any[] = (info as any).outputs || [];
      const webps = outputs.filter(o => o.format === 'webp');
      const avifs = outputs.filter(o => o.format === 'avif');
      const jpg = outputs.find(o => o.format === 'jpeg');
      if (webps.length === 0 && avifs.length === 0) continue;
      // Create srcset strings
      const srcsetAvif = avifs.map(a => `${path.relative(path.dirname(f), a.path).replace(/\\/g,'/')} ${a.width}w`).join(', ');
      const srcsetWebp = webps.map(a => `${path.relative(path.dirname(f), a.path).replace(/\\/g,'/')} ${a.width}w`).join(', ');
      const fallback = jpg ? path.relative(path.dirname(f), jpg.path).replace(/\\/g,'/') : orig;
      // Build picture element (keeping fallback as img)
      const pic = `<picture>\n  ${srcsetAvif ? `<source type="image/avif" srcset="${srcsetAvif}">\n  ` : ''}${srcsetWebp ? `<source type="image/webp" srcset="${srcsetWebp}">\n  ` : ''}<img src="${fallback}" alt="" loading="lazy">\n</picture>`;

      // Replace occurrences of the original src with fallback and also keep a preview of patch
      content = content.split(orig).join(fallback);
      // Additionally add a comment with the picture suggestion after the first occurrence
      const firstOccurrence = content.indexOf(fallback);
      if (firstOccurrence !== -1) {
        const insertPos = content.indexOf('>', firstOccurrence);
        if (insertPos !== -1) {
          content = content.slice(0, insertPos + 1) + `\n<!-- SUGGESTED_PICTURE_REPLACEMENT_START -->\n${pic}\n<!-- SUGGESTED_PICTURE_REPLACEMENT_END -->` + content.slice(insertPos + 1);
        }
      }
    }

    if (commit) {
      // backup original
      const backupPath = `${f}.bak`;
      if (!fs.existsSync(backupPath)) fs.copyFileSync(f, backupPath);
      fs.writeFileSync(f, content);
      console.log('Committed patch to', f, '(backup:', backupPath, ')');
    } else {
      fs.writeFileSync(f + '.patched', content);
      console.log('Patched preview written to', f + '.patched');
    }
  }
}