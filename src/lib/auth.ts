import { execSync } from 'node:child_process';

/**
 * Get GitHub token from GITHUB_TOKEN env var, or fall back to gh CLI
 */
export function getGitHubToken(): string {
  // First, try GITHUB_TOKEN environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Fall back to gh CLI
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (token) {
      return token;
    }
  } catch (_error) {
    // gh CLI not available or not authenticated
  }

  throw new Error(
    'GitHub token not found. Please set GITHUB_TOKEN environment variable or authenticate with `gh auth login`',
  );
}
