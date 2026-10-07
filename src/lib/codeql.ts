import type { Octokit } from 'octokit';
import type { GitHubRepo } from './git.js';
import type { DetailLevel } from './types.js';

type CodeScanning = Octokit['rest']['codeScanning'];

/**
 * Alert as returned by the list endpoint: rule summary only, no `rule.help`.
 * Derived from octokit's own typings so nullable API fields stay nullable.
 */
export type CodeQLAlertItem = Awaited<
  ReturnType<CodeScanning['listAlertsForRepo']>
>['data'][number];

/** Alert as returned by the single-alert endpoint: full rule, including `rule.help`. */
export type CodeQLAlertDetail = Awaited<ReturnType<CodeScanning['getAlert']>>['data'];

export type CodeQLAlert = CodeQLAlertItem | CodeQLAlertDetail;

/**
 * Fetch all open CodeQL alerts for a repository.
 * `tool_name` keeps other code-scanning tools' SARIF uploads out of a CodeQL report.
 */
export function fetchCodeQLAlerts(octokit: Octokit, repo: GitHubRepo): Promise<CodeQLAlertItem[]> {
  return octokit.paginate(octokit.rest.codeScanning.listAlertsForRepo, {
    owner: repo.owner,
    repo: repo.repo,
    state: 'open',
    tool_name: 'CodeQL',
    per_page: 100,
  });
}

/**
 * Fetch detailed information for a specific alert
 */
export async function fetchAlertDetails(
  octokit: Octokit,
  repo: GitHubRepo,
  alertNumber: number,
): Promise<CodeQLAlertDetail> {
  const response = await octokit.rest.codeScanning.getAlert({
    owner: repo.owner,
    repo: repo.repo,
    alert_number: alertNumber,
  });

  return response.data;
}

/**
 * Fetch all alerts, with per-alert details only when the detail level uses them.
 * Only `full` and `raw` output read fields the list endpoint omits (`rule.help`),
 * so other levels skip the one-request-per-alert round trips.
 */
export async function fetchAllAlertsWithDetails(
  octokit: Octokit,
  repo: GitHubRepo,
  detail: DetailLevel = 'full',
): Promise<CodeQLAlert[]> {
  const alerts = await fetchCodeQLAlerts(octokit, repo);

  if (detail !== 'full' && detail !== 'raw') {
    return alerts;
  }

  return Promise.all(alerts.map((alert) => fetchAlertDetails(octokit, repo, alert.number)));
}
