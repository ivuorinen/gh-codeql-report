import type { Octokit } from 'octokit';
import type { GitHubRepo } from './git.js';

export interface CodeQLAlert {
  number: number;
  rule: {
    id: string;
    severity: string;
    description: string;
    name: string;
  };
  most_recent_instance: {
    ref: string;
    analysis_key: string;
    category: string;
    state: string;
    commit_sha: string;
    message: {
      text: string;
    };
    location: {
      path: string;
      start_line: number;
      end_line: number;
      start_column: number;
      end_column: number;
    };
  };
  help?: string;
  tool: {
    name: string;
    version: string;
  };
}

/**
 * Fetch all open CodeQL alerts for a repository with pagination
 */
export async function fetchCodeQLAlerts(
  octokit: Octokit,
  repo: GitHubRepo,
): Promise<CodeQLAlert[]> {
  const alerts: CodeQLAlert[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.codeScanning.listAlertsForRepo({
      owner: repo.owner,
      repo: repo.repo,
      state: 'open',
      per_page: perPage,
      page,
    });

    if (response.data.length === 0) {
      break;
    }

    // Collect alert numbers for detailed fetch
    for (const alert of response.data) {
      alerts.push(alert as CodeQLAlert);
    }

    // If we got fewer than perPage results, we're done
    if (response.data.length < perPage) {
      break;
    }

    page++;
  }

  return alerts;
}

/**
 * Fetch detailed information for a specific alert
 */
export async function fetchAlertDetails(
  octokit: Octokit,
  repo: GitHubRepo,
  alertNumber: number,
): Promise<CodeQLAlert> {
  const response = await octokit.rest.codeScanning.getAlert({
    owner: repo.owner,
    repo: repo.repo,
    alert_number: alertNumber,
  });

  return response.data as CodeQLAlert;
}

/**
 * Fetch all alerts with full details
 */
export async function fetchAllAlertsWithDetails(
  octokit: Octokit,
  repo: GitHubRepo,
): Promise<CodeQLAlert[]> {
  const alerts = await fetchCodeQLAlerts(octokit, repo);

  // Fetch details for each alert
  const detailedAlerts = await Promise.all(
    alerts.map((alert) => fetchAlertDetails(octokit, repo, alert.number)),
  );

  return detailedAlerts;
}
