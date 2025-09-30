import type { CodeQLAlert } from '../lib/codeql.js';
import { type DetailLevel, filterAlertByDetail } from '../lib/types.js';

/**
 * Format alerts as JSON
 */
export function formatAsJSON(alerts: CodeQLAlert[], detailLevel: DetailLevel = 'medium'): string {
  const filteredAlerts = alerts.map((alert) => filterAlertByDetail(alert, detailLevel));
  return JSON.stringify(filteredAlerts, null, 2);
}
