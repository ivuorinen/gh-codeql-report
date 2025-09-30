import type { Octokit } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import type { CodeQLAlert } from '../lib/codeql.js';
import { fetchAlertDetails, fetchAllAlertsWithDetails, fetchCodeQLAlerts } from '../lib/codeql.js';
import type { GitHubRepo } from '../lib/git.js';

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

const mockRepo: GitHubRepo = {
  owner: 'test-owner',
  repo: 'test-repo',
};

describe('CodeQL API', () => {
  describe('fetchCodeQLAlerts', () => {
    it('should stop pagination when empty page received', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi
              .fn()
              .mockResolvedValueOnce({
                data: [mockAlert, { ...mockAlert, number: 2 }],
              })
              .mockResolvedValueOnce({
                data: [],
              }),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchCodeQLAlerts(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(2);
      // Should stop on first call because result is less than perPage (100)
      expect(mockOctokit.rest.codeScanning.listAlertsForRepo).toHaveBeenCalledTimes(1);
    });

    it('should handle single page of alerts', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi.fn().mockResolvedValue({
              data: [mockAlert],
            }),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchCodeQLAlerts(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(1);
      expect(mockOctokit.rest.codeScanning.listAlertsForRepo).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi.fn().mockResolvedValue({
              data: [],
            }),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchCodeQLAlerts(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(0);
    });

    it('should continue pagination until fewer than perPage results', async () => {
      const mockAlerts = Array.from({ length: 100 }, (_, i) => ({ ...mockAlert, number: i + 1 }));
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi
              .fn()
              .mockResolvedValueOnce({
                data: mockAlerts,
              })
              .mockResolvedValueOnce({
                data: [{ ...mockAlert, number: 101 }],
              }),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchCodeQLAlerts(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(101);
      expect(mockOctokit.rest.codeScanning.listAlertsForRepo).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAlertDetails', () => {
    it('should fetch details for a specific alert', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            getAlert: vi.fn().mockResolvedValue({
              data: mockAlert,
            }),
          },
        },
      } as unknown as Octokit;

      const alert = await fetchAlertDetails(mockOctokit, mockRepo, 1);

      expect(alert).toEqual(mockAlert);
      expect(mockOctokit.rest.codeScanning.getAlert).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        alert_number: 1,
      });
    });
  });

  describe('fetchAllAlertsWithDetails', () => {
    it('should fetch all alerts and their details', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi.fn().mockResolvedValue({
              data: [
                { ...mockAlert, number: 1 },
                { ...mockAlert, number: 2 },
              ],
            }),
            getAlert: vi
              .fn()
              .mockResolvedValueOnce({
                data: { ...mockAlert, number: 1 },
              })
              .mockResolvedValueOnce({
                data: { ...mockAlert, number: 2 },
              }),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchAllAlertsWithDetails(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(2);
      expect(mockOctokit.rest.codeScanning.listAlertsForRepo).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.codeScanning.getAlert).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results', async () => {
      const mockOctokit = {
        rest: {
          codeScanning: {
            listAlertsForRepo: vi.fn().mockResolvedValue({
              data: [],
            }),
            getAlert: vi.fn(),
          },
        },
      } as unknown as Octokit;

      const alerts = await fetchAllAlertsWithDetails(mockOctokit, mockRepo);

      expect(alerts).toHaveLength(0);
      expect(mockOctokit.rest.codeScanning.getAlert).not.toHaveBeenCalled();
    });
  });
});
