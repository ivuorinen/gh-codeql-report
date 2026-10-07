#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Octokit } from 'octokit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { formatAsJSON } from './formatters/json.js';
import { formatAsMarkdown } from './formatters/markdown.js';
import { formatAsSARIF } from './formatters/sarif.js';
import { formatAsText } from './formatters/text.js';
import { getGitHubToken } from './lib/auth.js';
import { fetchAllAlertsWithDetails } from './lib/codeql.js';
import type { GitHubRepo } from './lib/git.js';
import { getGitHubRepoFromRemote, parseGitHubUrl } from './lib/git.js';
import type { DetailLevel } from './lib/types.js';

// Read our own package.json explicitly: yargs' `.version()` auto-detection finds the
// caller's project package.json instead, so `--version` reported the wrong version.
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

interface Arguments {
  format: string;
  output?: string;
  detail: DetailLevel;
  repo?: string;
}

export async function main(): Promise<number> {
  const argv = (await yargs(hideBin(process.argv))
    .option('format', {
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['json', 'sarif', 'txt', 'md'],
      default: 'json',
    })
    .option('detail', {
      alias: 'd',
      type: 'string',
      description:
        'Detail level: minimum (essentials only), medium (balanced), full (everything), raw (original API response)',
      choices: ['minimum', 'medium', 'full', 'raw'],
      default: 'medium',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output file path (optional, defaults to code-scanning-report-[timestamp])',
    })
    .option('repo', {
      alias: 'r',
      type: 'string',
      description: 'Repository as owner/name or GitHub URL (defaults to the git remote here)',
    })
    .help()
    .alias('help', 'h')
    .version(version)
    .alias('version', 'v')
    .parse()) as Arguments;

  try {
    if (argv.format === 'sarif' && argv.detail === 'raw') {
      throw new Error(
        '--detail raw is not valid SARIF; use --format json for the raw API response',
      );
    }

    // Get GitHub token
    console.log('🔐 Authenticating with GitHub...');
    const token = getGitHubToken();
    const octokit = new Octokit({ auth: token });

    // Get repository info from --repo, else from the git remote
    let repo: GitHubRepo;
    if (argv.repo) {
      const parsed = parseGitHubUrl(argv.repo);
      if (!parsed) {
        throw new Error(`Unable to parse --repo "${argv.repo}"; expected owner/name`);
      }
      repo = parsed;
    } else {
      console.log('📂 Detecting repository from git remote...');
      repo = getGitHubRepoFromRemote();
    }
    console.log(`   Repository: ${repo.owner}/${repo.repo}`);

    // Fetch CodeQL alerts
    console.log('🔍 Fetching CodeQL alerts...');
    const alerts = await fetchAllAlertsWithDetails(octokit, repo, argv.detail);

    if (alerts.length === 0) {
      console.log('🎉 No CodeQL alerts found! Your repository is clean!');
      return 0;
    }

    console.log(`   Found ${alerts.length} open alert(s)`);

    // Format the report
    console.log(`📝 Generating ${argv.format.toUpperCase()} report (${argv.detail} detail)...`);
    const repoName = `${repo.owner}/${repo.repo}`;
    let content: string;

    switch (argv.format) {
      case 'json':
        content = formatAsJSON(alerts, argv.detail);
        break;
      case 'sarif':
        content = formatAsSARIF(alerts, argv.detail);
        break;
      case 'txt':
        content = formatAsText(alerts, argv.detail);
        break;
      case 'md':
        content = formatAsMarkdown(alerts, repoName, argv.detail);
        break;
      /* v8 ignore start -- defensive: yargs `choices` restricts format to the cases above */
      default:
        throw new Error(`Unsupported format: ${argv.format}`);
      /* v8 ignore stop */
    }

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '-');
    const outputPath = argv.output || `code-scanning-report-${timestamp}.${argv.format}`;

    // Write to file
    await writeFile(outputPath, content, 'utf-8');
    console.log(`✅ Report saved to: ${outputPath}`);
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error('❌ An unexpected error occurred');
    }
    return 1;
  }
}

/**
 * True when the script node was started with (`argv1`) is the module at `moduleUrl`.
 *
 * Both sides go through realpath because npm runs bins via `node_modules/.bin`
 * symlinks: `import.meta.url` is symlink-resolved while `process.argv[1]` is not,
 * so a plain string comparison made the installed CLI exit 0 without running.
 */
export function isMainModule(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolves this process's own script path; no file is read or written
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

/* v8 ignore start -- module bootstrap, only runs when executed as the CLI entrypoint (covered by bin.test.ts in a child process) */
if (isMainModule(process.argv[1], import.meta.url)) {
  // main() reports its own errors; the rejection handler covers anything thrown
  // outside its try block (argument parsing) so it still exits non-zero.
  main().then(
    (exitCode) => process.exit(exitCode),
    (error: unknown) => {
      console.error('❌ An unexpected error occurred', error);
      process.exit(1);
    },
  );
}
/* v8 ignore stop */
