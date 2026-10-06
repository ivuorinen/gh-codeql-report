import { execFileSync } from 'node:child_process';

export interface GitHubRepo {
  owner: string;
  repo: string;
}

/**
 * Extract GitHub owner and repository name from git remote URL
 */
export function parseGitHubUrl(url: string): GitHubRepo | null {
  // Match various GitHub URL formats:
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  // - https://github.com/owner/repo
  // - git://github.com/owner/repo.git
  const patterns = [/github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/, /^([^/]+)\/([^/]+)(\.git)?$/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  return null;
}

/**
 * Run git with an argument array (no shell) and return trimmed stdout.
 * stderr is captured, so git's own message ends up in the thrown error.
 */
function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Get GitHub owner and repo from current directory's git remote.
 *
 * Shells out to git directly: simple-git was a dependency for this one read and
 * carried command-execution advisories (GHSA-x6jw-m9v5-85vh and others).
 */
export function getGitHubRepoFromRemote(cwd?: string): GitHubRepo {
  const remotes = git(['remote'], cwd).split('\n').filter(Boolean);

  if (remotes.length === 0) {
    throw new Error('No git remotes found. Make sure you are in a git repository.');
  }

  // Try origin first, then fall back to the first remote
  const remote = remotes.includes('origin') ? 'origin' : remotes[0];
  const remoteUrl = git(['remote', 'get-url', remote], cwd);
  const repoInfo = parseGitHubUrl(remoteUrl);

  if (!repoInfo) {
    throw new Error(`Unable to parse GitHub repository from remote URL: ${remoteUrl}`);
  }

  return repoInfo;
}
