import type { CodeQLAlert } from '../lib/codeql.js';
import {
  type DetailLevel,
  type FullAlert,
  filterAlertByDetail,
  type MediumAlert,
  type MinimumAlert,
} from '../lib/types.js';

/**
 * Format alerts as plain text
 */
export function formatAsText(alerts: CodeQLAlert[], detailLevel: DetailLevel = 'medium'): string {
  const lines: string[] = [];

  lines.push(`CodeQL Security Scan Report`);
  lines.push(`Total Alerts: ${alerts.length}`);
  lines.push(`Detail Level: ${detailLevel}`);
  lines.push(`${'='.repeat(80)}\n`);

  for (const alert of alerts) {
    const filtered = filterAlertByDetail(alert, detailLevel);

    // Handle raw format - return original JSON-like structure
    if (detailLevel === 'raw') {
      lines.push(JSON.stringify(filtered, null, 2));
      lines.push(`${'-'.repeat(80)}\n`);
      continue;
    }

    // Type assertion: after raw check, we know filtered is a flattened alert type
    const flatAlert = filtered as MinimumAlert | MediumAlert | FullAlert;

    lines.push(`Alert #${flatAlert.number}`);
    lines.push(`Rule: ${flatAlert.rule_id}`);
    lines.push(`Name: ${flatAlert.rule_name}`);
    lines.push(`Severity: ${flatAlert.severity}`);

    // Description only in medium and full
    if ('rule_description' in flatAlert) {
      lines.push(`Description: ${flatAlert.rule_description}`);
    }

    lines.push('');
    lines.push('Location:');
    lines.push(`  File: ${flatAlert.file_path}`);
    lines.push(`  Lines: ${flatAlert.start_line}-${flatAlert.end_line}`);

    // Columns only in medium and full
    if ('start_column' in flatAlert) {
      lines.push(`  Columns: ${flatAlert.start_column}-${flatAlert.end_column}`);
    }

    lines.push('');
    lines.push('Message:');
    lines.push(`  ${flatAlert.message}`);

    // Commit is now in all levels
    lines.push('');
    lines.push(`Commit: ${flatAlert.commit_sha}`);

    // State only in medium and full
    if ('state' in flatAlert) {
      lines.push(`State: ${flatAlert.state}`);
    }

    lines.push(`${'-'.repeat(80)}\n`);
  }

  return lines.join('\n');
}
