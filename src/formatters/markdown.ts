import type { CodeQLAlert } from '../lib/codeql.js';
import {
  type DetailLevel,
  type FullAlert,
  filterAlertByDetail,
  type MediumAlert,
  type MinimumAlert,
} from '../lib/types.js';

/**
 * Generate a markdown table from 2D array data
 * Exported for testing edge cases
 */
export function generateMarkdownTable(data: string[][]): string {
  if (data.length === 0) return '';

  const [headers, ...rows] = data;

  // Calculate column widths
  const columnWidths = headers.map((header, i) => {
    const maxWidth = Math.max(header.length, ...rows.map((row) => row[i]?.length || 0));
    return maxWidth;
  });

  // Build table
  const lines: string[] = [];

  // Header row
  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ');
  lines.push(`| ${headerRow} |`);

  // Separator row
  const separator = columnWidths.map((width) => '-'.repeat(width)).join(' | ');
  lines.push(`| ${separator} |`);

  // Data rows
  for (const row of rows) {
    // Pad row with empty strings if it's shorter than headers
    const paddedRow = Array.from({ length: headers.length }, (_, i) => row[i] || '');
    const dataRow = paddedRow.map((cell, i) => cell.padEnd(columnWidths[i])).join(' | ');
    lines.push(`| ${dataRow} |`);
  }

  return lines.join('\n');
}

/**
 * Format alerts as Markdown
 */
export function formatAsMarkdown(
  alerts: CodeQLAlert[],
  repoName: string,
  detailLevel: DetailLevel = 'medium',
): string {
  const lines: string[] = [];

  lines.push(`# CodeQL Security Scan Report`);
  lines.push('');
  lines.push(`**Repository:** ${repoName}`);
  lines.push(`**Total Alerts:** ${alerts.length}`);
  lines.push(`**Detail Level:** ${detailLevel}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary table
  lines.push('## Summary by Severity');
  lines.push('');

  const severityCounts = alerts.reduce(
    (acc, alert) => {
      const severity = alert.rule.severity.toLowerCase();
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summaryTableData = [
    ['Severity', 'Count'],
    ...Object.entries(severityCounts).map(([severity, count]) => [severity, count.toString()]),
  ];

  lines.push(generateMarkdownTable(summaryTableData));
  lines.push('');

  // Detailed alerts
  lines.push('## Detailed Alerts');
  lines.push('');

  for (const alert of alerts) {
    const filtered = filterAlertByDetail(alert, detailLevel);

    // Handle raw format - return as code block
    if (detailLevel === 'raw') {
      lines.push('```json');
      lines.push(JSON.stringify(filtered, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      continue;
    }

    // Type assertion: after raw check, we know filtered is a flattened alert type
    const flatAlert = filtered as MinimumAlert | MediumAlert | FullAlert;

    lines.push(`### Alert #${flatAlert.number}: ${flatAlert.rule_name}`);
    lines.push('');
    lines.push(`**Rule ID:** \`${flatAlert.rule_id}\``);
    lines.push(`**Severity:** ${flatAlert.severity}`);

    // Description only in medium and full
    if ('rule_description' in flatAlert) {
      lines.push(`**Description:** ${flatAlert.rule_description}`);
    }

    lines.push('');
    lines.push('#### Location');
    lines.push('');
    lines.push(`- **File:** \`${flatAlert.file_path}\``);
    lines.push(`- **Lines:** ${flatAlert.start_line}-${flatAlert.end_line}`);

    // Columns only in medium and full
    if ('start_column' in flatAlert) {
      lines.push(`- **Columns:** ${flatAlert.start_column}-${flatAlert.end_column}`);
    }

    lines.push('');
    lines.push('#### Message');
    lines.push('');
    lines.push(flatAlert.message);

    // Details section - commit is now in all levels
    lines.push('');
    lines.push('#### Details');
    lines.push('');
    lines.push(`- **Commit:** \`${flatAlert.commit_sha}\``);

    // State only in medium and full
    if ('state' in flatAlert) {
      lines.push(`- **State:** ${flatAlert.state}`);
    }

    // Reference only in full
    if ('ref' in flatAlert) {
      lines.push(`- **Reference:** ${flatAlert.ref}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
