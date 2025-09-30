import simpleGit from 'simple-git';

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
 * Get GitHub owner and repo from current directory's git remote
 */
export async function getGitHubRepoFromRemote(cwd?: string): Promise<GitHubRepo> {
  const git = simpleGit(cwd);

  try {
    const remotes = await git.getRemotes(true);

    if (remotes.length === 0) {
      throw new Error('No git remotes found. Make sure you are in a git repository.');
    }

    // Try origin first, then fall back to the first remote
    const originRemote = remotes.find((r) => r.name === 'origin');
    const remote = originRemote || remotes[0];

    if (!remote.refs.fetch && !remote.refs.push) {
      throw new Error('No valid remote URL found.');
    }

    const remoteUrl = remote.refs.fetch || remote.refs.push;
    const repoInfo = parseGitHubUrl(remoteUrl);

    if (!repoInfo) {
      throw new Error(`Unable to parse GitHub repository from remote URL: ${remoteUrl}`);
    }

    return repoInfo;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get git remote information.');
  }
}
