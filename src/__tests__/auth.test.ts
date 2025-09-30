import { execSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGitHubToken } from '../lib/auth.js';

vi.mock('node:child_process');

describe('getGitHubToken', () => {
  const originalEnv = process.env.GITHUB_TOKEN;

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return token from GITHUB_TOKEN env var', () => {
    process.env.GITHUB_TOKEN = 'test-token-from-env';
    const token = getGitHubToken();
    expect(token).toBe('test-token-from-env');
  });

  it('should fall back to gh CLI when GITHUB_TOKEN is not set', () => {
    delete process.env.GITHUB_TOKEN;
    // biome-ignore lint/suspicious/noExplicitAny: mocking requires any type
    vi.mocked(execSync).mockReturnValue('test-token-from-gh\n' as any);

    const token = getGitHubToken();
    expect(token).toBe('test-token-from-gh');
    expect(execSync).toHaveBeenCalledWith('gh auth token', { encoding: 'utf-8' });
  });

  it('should throw error when neither GITHUB_TOKEN nor gh CLI are available', () => {
    delete process.env.GITHUB_TOKEN;
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('gh not found');
    });

    expect(() => getGitHubToken()).toThrow(
      'GitHub token not found. Please set GITHUB_TOKEN environment variable or authenticate with `gh auth login`',
    );
  });
});
