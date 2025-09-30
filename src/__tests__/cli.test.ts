import { writeFile } from 'node:fs/promises';
import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../cli.js';
import { formatAsJSON } from '../formatters/json.js';
import { formatAsMarkdown } from '../formatters/markdown.js';
import { formatAsSARIF } from '../formatters/sarif.js';
import { formatAsText } from '../formatters/text.js';
import { getGitHubToken } from '../lib/auth.js';
import type { CodeQLAlert } from '../lib/codeql.js';
import { fetchAllAlertsWithDetails } from '../lib/codeql.js';
import { getGitHubRepoFromRemote } from '../lib/git.js';

// Mock all dependencies
vi.mock('node:fs/promises');
vi.mock('octokit');
vi.mock('../lib/auth.js');
vi.mock('../lib/git.js');
vi.mock('../lib/codeql.js');
vi.mock('../formatters/json.js');
vi.mock('../formatters/text.js');
vi.mock('../formatters/markdown.js');
vi.mock('../formatters/sarif.js');

const mockAlert: CodeQLAlert = {
  number: 1,
  rule: {
    id: 'js/sql-injection',
    severity: 'error',
    description: 'SQL injection vulnerability',
    name: 'SQL Injection',
  },
  most_recent_instance: {
    ref: 'refs/heads/main',
    analysis_key: 'test-analysis',
    category: 'security',
    state: 'open',
    commit_sha: 'abc123',
    message: {
      text: 'Potential SQL injection detected',
    },
    location: {
      path: 'src/database.js',
      start_line: 10,
      end_line: 12,
      start_column: 5,
      end_column: 20,
    },
  },
  tool: {
    name: 'CodeQL',
    version: '2.0.0',
  },
};

describe('CLI', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Save original argv
    originalArgv = process.argv;

    // Setup default mocks
    vi.mocked(getGitHubToken).mockReturnValue('test-token');
    vi.mocked(getGitHubRepoFromRemote).mockResolvedValue({
      owner: 'test-owner',
      repo: 'test-repo',
    });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(formatAsJSON).mockReturnValue('{"mock":"json"}');
    vi.mocked(formatAsText).mockReturnValue('mock text');
    vi.mocked(formatAsMarkdown).mockReturnValue('# Mock Markdown');
    vi.mocked(formatAsSARIF).mockReturnValue('{"mock":"sarif"}');

    // Mock Octokit constructor
    vi.mocked(Octokit).mockImplementation(() => ({}) as any);
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe('successful alert generation', () => {
    it('should generate JSON report with default settings', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();

      expect(exitCode).toBe(0);
      expect(getGitHubToken).toHaveBeenCalled();
      expect(getGitHubRepoFromRemote).toHaveBeenCalled();
      expect(fetchAllAlertsWithDetails).toHaveBeenCalled();
      expect(formatAsJSON).toHaveBeenCalledWith([mockAlert], 'medium');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/code-scanning-report-.*\.json$/),
        '{"mock":"json"}',
        'utf-8',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Report saved to:'));
    });

    it('should generate SARIF report when format specified', async () => {
      process.argv = ['node', 'cli.js', '--format', 'sarif'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsSARIF).toHaveBeenCalledWith([mockAlert], 'test-owner/test-repo', 'medium');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/code-scanning-report-.*\.sarif$/),
        '{"mock":"sarif"}',
        'utf-8',
      );
    });

    it('should generate text report when format specified', async () => {
      process.argv = ['node', 'cli.js', '--format', 'txt'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsText).toHaveBeenCalledWith([mockAlert], 'medium');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/code-scanning-report-.*\.txt$/),
        'mock text',
        'utf-8',
      );
    });

    it('should generate markdown report when format specified', async () => {
      process.argv = ['node', 'cli.js', '--format', 'md'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsMarkdown).toHaveBeenCalledWith([mockAlert], 'test-owner/test-repo', 'medium');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/code-scanning-report-.*\.md$/),
        '# Mock Markdown',
        'utf-8',
      );
    });

    it('should use custom output path when specified', async () => {
      process.argv = ['node', 'cli.js', '--output', 'custom-report.json'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(writeFile).toHaveBeenCalledWith('custom-report.json', '{"mock":"json"}', 'utf-8');
    });

    it('should use minimum detail level when specified', async () => {
      process.argv = ['node', 'cli.js', '--detail', 'minimum'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsJSON).toHaveBeenCalledWith([mockAlert], 'minimum');
    });

    it('should use full detail level when specified', async () => {
      process.argv = ['node', 'cli.js', '--detail', 'full'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsJSON).toHaveBeenCalledWith([mockAlert], 'full');
    });

    it('should use raw detail level when specified', async () => {
      process.argv = ['node', 'cli.js', '--detail', 'raw'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(formatAsJSON).toHaveBeenCalledWith([mockAlert], 'raw');
    });
  });

  describe('no alerts found (celebration)', () => {
    it('should celebrate and exit with 0 when no alerts found', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([]);

      const exitCode = await main();

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🎉 No CodeQL alerts found! Your repository is clean!',
      );
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle git remote error and exit with 1', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(getGitHubRepoFromRemote).mockRejectedValue(
        new Error('No git remotes found. Make sure you are in a git repository.'),
      );

      const exitCode = await main();

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error: No git remotes found. Make sure you are in a git repository.',
      );
    });

    it('should handle authentication error', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(getGitHubToken).mockImplementation(() => {
        throw new Error('GitHub token not found');
      });

      const exitCode = await main();

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error: GitHub token not found');
    });

    it('should handle API error', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockRejectedValue(new Error('API request failed'));

      const exitCode = await main();

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error: API request failed');
    });

    it('should handle file write error', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);
      vi.mocked(writeFile).mockRejectedValue(new Error('Permission denied'));

      const exitCode = await main();

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error: Permission denied');
    });

    it('should handle non-Error exceptions', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockRejectedValue('string error');

      const exitCode = await main();

      expect(exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ An unexpected error occurred');
    });
  });

  describe('console output', () => {
    it('should log progress messages', async () => {
      process.argv = ['node', 'cli.js'];
      vi.mocked(fetchAllAlertsWithDetails).mockResolvedValue([mockAlert]);

      const exitCode = await main();
      expect(exitCode).toBe(0);

      expect(consoleLogSpy).toHaveBeenCalledWith('🔐 Authenticating with GitHub...');
      expect(consoleLogSpy).toHaveBeenCalledWith('📂 Detecting repository from git remote...');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Repository: test-owner/test-repo');
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Fetching CodeQL alerts...');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Found 1 open alert(s)');
      expect(consoleLogSpy).toHaveBeenCalledWith('📝 Generating JSON report (medium detail)...');
    });
  });
});
