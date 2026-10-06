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
 * Throws for `raw`: the unprocessed API response is not SARIF, and writing it to a
 * .sarif file silently produced output SARIF consumers reject.
 */
export function formatAsSARIF(alerts: CodeQLAlert[], detailLevel: DetailLevel = 'medium'): string {
  if (detailLevel === 'raw') {
    throw new Error('raw detail is not valid SARIF; use the JSON formatter');
  }

  const sarifBuilder = new SarifBuilder();

  // Tool version only available in full mode
  let toolVersion = '1.0.0';
  if (detailLevel === 'full' && alerts.length > 0) {
    const fullAlert = filterAlertByDetail(alerts[0], 'full');
    /* v8 ignore next 3 -- `filterAlertByDetail(_, 'full')` always sets tool_version; the guard only narrows the return type */
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

/** Map the API's rule.severity (none | note | warning | error) to a SARIF level. */
function mapSeverityToLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'note';
  }
}
