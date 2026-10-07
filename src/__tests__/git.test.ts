import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGitHubRepoFromRemote, parseGitHubUrl } from '../lib/git.js';

vi.mock('node:child_process');

/** Fake git: answers `git remote` with `remotes` and `git remote get-url <name>` from `urls`. */
function fakeGit(remotes: string, urls: Record<string, string>) {
  vi.mocked(execFileSync).mockImplementation(((_file: string, args: string[]) => {
    if (args.length === 1) return `${remotes}\n`;
    return `${urls[args[2]]}\n`;
  }) as never);
}

describe('parseGitHubUrl', () => {
  it('should parse HTTPS URL', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse HTTPS URL without .git', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse SSH URL', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse git:// URL', () => {
    const result = parseGitHubUrl('git://github.com/owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should return null for invalid URL', () => {
    const result = parseGitHubUrl('not-a-valid-url');
    expect(result).toBeNull();
  });

  it('should handle URLs with hyphens and underscores', () => {
    const result = parseGitHubUrl('https://github.com/my-org_name/my-repo_name.git');
    expect(result).toEqual({ owner: 'my-org_name', repo: 'my-repo_name' });
  });

  it('should parse the owner/name shorthand', () => {
    expect(parseGitHubUrl('owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse ssh:// URLs with a port and URLs with a trailing slash', () => {
    expect(parseGitHubUrl('ssh://git@github.com:22/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
    expect(parseGitHubUrl('https://github.com/owner/repo/')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it.each([
    'https://notgithub.com/owner/repo',
    'https://evil.com/github.com/owner/repo',
    'git@notgithub.com:owner/repo.git',
    'https://github.com/owner/repo/tree/main',
  ])('should reject %s instead of reporting on another repository', (url) => {
    expect(parseGitHubUrl(url)).toBeNull();
  });
});

describe('getGitHubRepoFromRemote', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReset();
  });

  it('should extract repo from origin remote', () => {
    fakeGit('upstream\norigin', {
      origin: 'https://github.com/owner/repo.git',
      upstream: 'https://github.com/other/repo.git',
    });

    expect(getGitHubRepoFromRemote()).toEqual({ owner: 'owner', repo: 'repo' });
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['remote', 'get-url', 'origin'],
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('should use first remote if origin not found', () => {
    fakeGit('upstream', { upstream: 'git@github.com:other/repo.git' });

    expect(getGitHubRepoFromRemote()).toEqual({ owner: 'other', repo: 'repo' });
  });

  it('should throw error if no remotes found', () => {
    fakeGit('', {});

    expect(() => getGitHubRepoFromRemote()).toThrow('No git remotes found');
  });

  it('should throw error if URL cannot be parsed', () => {
    fakeGit('origin', { origin: 'not-a-github-url' });

    expect(() => getGitHubRepoFromRemote()).toThrow('Unable to parse GitHub repository');
  });

  it('should propagate git errors', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    expect(() => getGitHubRepoFromRemote()).toThrow('fatal: not a git repository');
  });

  it('should pass cwd to git', () => {
    fakeGit('origin', { origin: 'https://github.com/owner/repo.git' });

    getGitHubRepoFromRemote('/custom/path');

    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['remote'],
      expect.objectContaining({ cwd: '/custom/path' }),
    );
  });
});
