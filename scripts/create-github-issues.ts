import fs from 'fs';
import path from 'path';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(2);
  }

  // Support running in dry-run mode either via env DRY_RUN='true' (used by workflow_dispatch)
  // or via CLI flag `--dry-run` for local testing.
  const dryRunEnv = process.env.DRY_RUN;
  const dryRunFlag = process.argv.includes('--dry-run');
  const dryRun = !!(dryRunFlag || dryRunEnv === 'true');
  console.log('Dry run mode:', dryRun);

  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) {
    console.error('GITHUB_REPOSITORY not set');
    process.exit(2);
  }

  const [owner, repoName] = repo.split('/');
  const todoPath = path.join(__dirname, '..', 'ISSUE-TRACKING', 'UX-A11Y-TODO.md');
  if (!fs.existsSync(todoPath)) {
    console.error('TODO file not found:', todoPath);
    process.exit(1);
  }

  const body = fs.readFileSync(todoPath, 'utf8');

  // Parse high-priority items starting with '- **'
  const lines = body.split('\n');
  const items: { title: string; desc: string }[] = [];
  for (const line of lines) {
    const m = line.match(/- \*\*(.+?)\*\*\s*\((selector:\s*([^)]*)\))?\s*—?\s*(.+)?/i);
    if (m) {
      const title = m[1].trim();
      const desc = m[4] ? m[4].trim() : '';
      items.push({ title, desc });
    }
  }

  // Initialize GitHub client (prefer @octokit/rest; fallback to a small fetch-based client)
  let octokit: any = null;
  if (!dryRun) {
    try {
      const mod = await import('@octokit/rest');
      const Octokit = (mod && (mod.Octokit || mod.default));
      if (!Octokit) throw new Error('Octokit export not found');
      octokit = new Octokit({ auth: token });
    } catch (err) {
      console.warn('[warn] Could not import @octokit/rest, falling back to fetch-based client:', err && (err as Error).message ? (err as Error).message : err);
      if (typeof fetch === 'undefined') {
        throw new Error('No global fetch available; either run on Node 18+ or ensure @octokit/rest is installed');
      }
      // Minimal fetch-based client (simple implementations of the methods we need)
      octokit = {
        issues: {
          listForRepo: async ({ owner, repo: repoName, state }: any) => {
            const qs = `state=${state}&per_page=100`;
            const url = `https://api.github.com/repos/${owner}/${repo}/issues?${qs}`;
            const res = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'create-github-issues-script' } });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(`GitHub API listForRepo failed: ${res.status} ${txt}`);
            }
            const data = await res.json();
            return { data };
          },
          create: async ({ owner, repo: repoName, title, body, labels }: any) => {
            const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
            const res = await fetch(url, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json', 'User-Agent': 'create-github-issues-script' }, body: JSON.stringify({ title, body, labels }) });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(`GitHub API create issue failed: ${res.status} ${txt}`);
            }
            const data = await res.json();
            return { data };
          }
        }
      };
    }
  } else {
    console.log('[dry-run] Skipping GitHub queries; running entirely locally.');
  }

  for (const it of items) {
    if (dryRun) {
      console.log('[dry-run] Would create issue:', it.title);
      continue;
    }

    try {
      // Check existing issues with same title
      const { data: issues } = await octokit.issues.listForRepo({ owner, repo: repoName, state: 'open' });
      const exists = issues.find((i: any) => i.title === it.title);
      if (exists) {
        console.log('Issue exists, skipping:', it.title);
        continue;
      }

      const issueBody = `Auto-imported from UX A11Y TODO\n\n${it.desc}\n\nSee: outputs/ux-report/ux-report.json`;
      const res = await octokit.issues.create({ owner, repo: repoName, title: it.title, body: issueBody, labels: ['a11y', 'automation'] });
      console.log('Created issue:', res.data.html_url);
    } catch (err) {
      console.error('Failed to create or check issue for', it.title, err && (err as Error).message ? (err as Error).message : err);
      // continue with other items
      continue;
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
