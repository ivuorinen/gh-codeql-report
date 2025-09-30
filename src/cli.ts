#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
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
import { getGitHubRepoFromRemote } from './lib/git.js';
import type { DetailLevel } from './lib/types.js';

interface Arguments {
  format: string;
  output?: string;
  detail: DetailLevel;
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
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .parse()) as Arguments;

  try {
    // Get GitHub token
    console.log('🔐 Authenticating with GitHub...');
    const token = getGitHubToken();
    const octokit = new Octokit({ auth: token });

    // Get repository info from git remote
    console.log('📂 Detecting repository from git remote...');
    const repo = await getGitHubRepoFromRemote();
    console.log(`   Repository: ${repo.owner}/${repo.repo}`);

    // Fetch CodeQL alerts
    console.log('🔍 Fetching CodeQL alerts...');
    const alerts = await fetchAllAlertsWithDetails(octokit, repo);

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
        content = formatAsSARIF(alerts, repoName, argv.detail);
        break;
      case 'txt':
        content = formatAsText(alerts, argv.detail);
        break;
      case 'md':
        content = formatAsMarkdown(alerts, repoName, argv.detail);
        break;
      default:
        throw new Error(`Unsupported format: ${argv.format}`);
    }

    // Generate output filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace(/T/, '-')
      .split('.')[0];
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

// Only run if this is the main module (not imported for testing)
const modulePath = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1] &&
  (modulePath === process.argv[1] || modulePath === fileURLToPath(`file://${process.argv[1]}`));

if (isMainModule) {
  main().then((exitCode) => {
    process.exit(exitCode);
  });
}
