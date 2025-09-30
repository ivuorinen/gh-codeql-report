import type { SimpleGit } from 'simple-git';
import simpleGit from 'simple-git';
import { describe, expect, it, vi } from 'vitest';
import { getGitHubRepoFromRemote, parseGitHubUrl } from '../lib/git.js';

vi.mock('simple-git');

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
});

describe('getGitHubRepoFromRemote', () => {
  it('should extract repo from origin remote', async () => {
    const mockGit = {
      getRemotes: vi
        .fn()
        .mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/owner/repo.git', push: '' } },
        ]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    const result = await getGitHubRepoFromRemote();

    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
  });

  it('should use first remote if origin not found', async () => {
    const mockGit = {
      getRemotes: vi
        .fn()
        .mockResolvedValue([
          { name: 'upstream', refs: { fetch: 'https://github.com/other/repo.git', push: '' } },
        ]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    const result = await getGitHubRepoFromRemote();

    expect(result).toEqual({ owner: 'other', repo: 'repo' });
  });

  it('should use push URL if fetch URL not available', async () => {
    const mockGit = {
      getRemotes: vi
        .fn()
        .mockResolvedValue([
          { name: 'origin', refs: { fetch: '', push: 'git@github.com:owner/repo.git' } },
        ]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    const result = await getGitHubRepoFromRemote();

    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should throw error if no remotes found', async () => {
    const mockGit = {
      getRemotes: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await expect(getGitHubRepoFromRemote()).rejects.toThrow('No git remotes found');
  });

  it('should throw error if remote has no valid URL', async () => {
    const mockGit = {
      getRemotes: vi.fn().mockResolvedValue([{ name: 'origin', refs: { fetch: '', push: '' } }]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await expect(getGitHubRepoFromRemote()).rejects.toThrow('No valid remote URL found');
  });

  it('should throw error if URL cannot be parsed', async () => {
    const mockGit = {
      getRemotes: vi
        .fn()
        .mockResolvedValue([{ name: 'origin', refs: { fetch: 'not-a-github-url', push: '' } }]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await expect(getGitHubRepoFromRemote()).rejects.toThrow('Unable to parse GitHub repository');
  });

  it('should handle git errors', async () => {
    const mockGit = {
      getRemotes: vi.fn().mockRejectedValue(new Error('Git error')),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await expect(getGitHubRepoFromRemote()).rejects.toThrow('Git error');
  });

  it('should handle non-Error exceptions', async () => {
    const mockGit = {
      getRemotes: vi.fn().mockRejectedValue('string error'),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await expect(getGitHubRepoFromRemote()).rejects.toThrow('Failed to get git remote information');
  });

  it('should pass cwd parameter to simpleGit', async () => {
    const mockGit = {
      getRemotes: vi
        .fn()
        .mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/owner/repo.git', push: '' } },
        ]),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    await getGitHubRepoFromRemote('/custom/path');

    expect(simpleGit).toHaveBeenCalledWith('/custom/path');
  });
});
