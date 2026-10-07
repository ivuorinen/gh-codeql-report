import { execFileSync } from 'node:child_process';

export interface GitHubRepo {
  owner: string;
  repo: string;
}

const toRepo = (owner: string, repo: string): GitHubRepo => ({
  owner,
  repo: repo.replace(/\.git$/, ''),
});

/**
 * Extract GitHub owner and repository name from a git remote URL or `owner/name`.
 *
 * Parses by form rather than searching for a `github.com` substring, which
 * accepted `https://notgithub.com/o/r` and `https://evil.com/github.com/o/r`
 * as `o/r` and reported on an unrelated GitHub repository.
 */
export function parseGitHubUrl(url: string): GitHubRepo | null {
  // owner/name shorthand (the --repo form)
  const shorthand = url.match(/^([^/:@\s]+)\/([^/:@\s]+)$/);
  if (shorthand) return toRepo(shorthand[1], shorthand[2]);

  // scp-like SSH: git@github.com:owner/name.git
  const scp = url.match(/^[^@/\s]+@github\.com:([^/]+)\/([^/]+)$/);
  if (scp) return toRepo(scp[1], scp[2]);

  // https://, ssh://, git:// — the host must be exactly github.com
  try {
    const { hostname, pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    if (hostname === 'github.com' && parts.length === 2) return toRepo(parts[0], parts[1]);
  } catch {
    // not a URL
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
