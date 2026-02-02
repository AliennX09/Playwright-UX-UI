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

  // Only import Octokit when not in dry-run mode (avoids requiring the package for local dry-runs)
  let octokit: any = null;
  if (!dryRun) {
    const mod = await import('@octokit/rest');
    const Octokit = mod.Octokit;
    octokit = new Octokit({ auth: token });
  } else {
    console.log('[dry-run] Skipping GitHub queries; running entirely locally.');
  }

  for (const it of items) {
    if (dryRun) {
      console.log('[dry-run] Would create issue:', it.title);
      continue;
    }

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
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
