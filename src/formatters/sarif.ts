import { SarifBuilder, SarifResultBuilder, SarifRunBuilder } from 'node-sarif-builder';
import type { CodeQLAlert } from '../lib/codeql.js';
import {
  type DetailLevel,
  type FullAlert,
  filterAlertByDetail,
  type MediumAlert,
  type MinimumAlert,
} from '../lib/types.js';

/**
 * Format alerts as SARIF (Static Analysis Results Interchange Format)
 */
export function formatAsSARIF(
  alerts: CodeQLAlert[],
  _repoName: string,
  detailLevel: DetailLevel = 'medium',
): string {
  // For raw format, return alerts as JSON (SARIF doesn't make sense for raw)
  if (detailLevel === 'raw') {
    return JSON.stringify(alerts, null, 2);
  }

  const sarifBuilder = new SarifBuilder();

  // Tool version only available in full mode
  let toolVersion = '1.0.0';
  if (detailLevel === 'full' && alerts.length > 0) {
    const fullAlert = filterAlertByDetail(alerts[0], 'full');
    if ('tool_version' in fullAlert) {
      toolVersion = fullAlert.tool_version;
    }
  }

  const runBuilder = new SarifRunBuilder().initSimple({
    toolDriverName: 'CodeQL',
    toolDriverVersion: toolVersion,
  });

  for (const alert of alerts) {
    const filtered = filterAlertByDetail(alert, detailLevel);
    // Type assertion: we know filtered is a flattened alert type (not raw, checked above)
    const flatAlert = filtered as MinimumAlert | MediumAlert | FullAlert;
    const result = new SarifResultBuilder();

    // SARIF requires certain minimum fields
    // For minimum level, we use line numbers but set column to 1 if not available
    const startColumn = 'start_column' in flatAlert ? flatAlert.start_column : 1;

    result.initSimple({
      ruleId: flatAlert.rule_id,
      level: mapSeverityToLevel(flatAlert.severity),
      messageText: flatAlert.message,
      fileUri: flatAlert.file_path,
      startLine: flatAlert.start_line,
      startColumn,
    });

    runBuilder.addResult(result);
  }

  sarifBuilder.addRun(runBuilder);
  // buildSarifJsonString returns a JSON string
  return sarifBuilder.buildSarifJsonString();
}

function mapSeverityToLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity.toLowerCase()) {
    case 'error':
    case 'critical':
      return 'error';
    case 'warning':
    case 'medium':
      return 'warning';
    default:
      return 'note';
  }
}
