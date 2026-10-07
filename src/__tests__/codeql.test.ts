import type { Octokit } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import type { CodeQLAlert } from '../lib/codeql.js';
import { fetchAlertDetails, fetchAllAlertsWithDetails, fetchCodeQLAlerts } from '../lib/codeql.js';
import type { GitHubRepo } from '../lib/git.js';

const mockAlert = {
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
} as unknown as CodeQLAlert;

const mockRepo: GitHubRepo = {
  owner: 'test-owner',
  repo: 'test-repo',
};

/** Octokit stub: paginate resolves to `list`, getAlert echoes the requested number. */
function mockOctokit(list: CodeQLAlert[]) {
  const listAlertsForRepo = vi.fn();
  return {
    paginate: vi.fn().mockResolvedValue(list),
    rest: {
      codeScanning: {
        listAlertsForRepo,
        getAlert: vi.fn(({ alert_number }: { alert_number: number }) =>
          Promise.resolve({ data: { ...mockAlert, number: alert_number } }),
        ),
      },
    },
  } as unknown as Octokit;
}

describe('CodeQL API', () => {
  describe('fetchCodeQLAlerts', () => {
    it('should paginate open CodeQL alerts only', async () => {
      const octokit = mockOctokit([mockAlert]);

      const alerts = await fetchCodeQLAlerts(octokit, mockRepo);

      expect(alerts).toHaveLength(1);
      expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.codeScanning.listAlertsForRepo, {
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        tool_name: 'CodeQL',
        per_page: 100,
      });
    });
  });

  describe('fetchAlertDetails', () => {
    it('should fetch details for a specific alert', async () => {
      const octokit = mockOctokit([]);

      const alert = await fetchAlertDetails(octokit, mockRepo, 7);

      expect(alert.number).toBe(7);
      expect(octokit.rest.codeScanning.getAlert).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        alert_number: 7,
      });
    });
  });

  describe('fetchAllAlertsWithDetails', () => {
    it.each(['full', 'raw'] as const)(
      'should fetch per-alert details at %s level',
      async (level) => {
        const octokit = mockOctokit([
          { ...mockAlert, number: 1 },
          { ...mockAlert, number: 2 },
        ]);

        const alerts = await fetchAllAlertsWithDetails(octokit, mockRepo, level);

        expect(alerts.map((a) => a.number)).toEqual([1, 2]);
        expect(octokit.rest.codeScanning.getAlert).toHaveBeenCalledTimes(2);
      },
    );

    it.each(['minimum', 'medium'] as const)(
      'should skip per-alert requests at %s level',
      async (level) => {
        const octokit = mockOctokit([mockAlert]);

        const alerts = await fetchAllAlertsWithDetails(octokit, mockRepo, level);

        expect(alerts).toEqual([mockAlert]);
        expect(octokit.rest.codeScanning.getAlert).not.toHaveBeenCalled();
      },
    );

    it('should handle empty results', async () => {
      const octokit = mockOctokit([]);

      const alerts = await fetchAllAlertsWithDetails(octokit, mockRepo);

      expect(alerts).toHaveLength(0);
      expect(octokit.rest.codeScanning.getAlert).not.toHaveBeenCalled();
    });
  });
});
