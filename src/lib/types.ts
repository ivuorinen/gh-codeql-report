import type { CodeQLAlert } from './codeql.js';

export type DetailLevel = 'minimum' | 'medium' | 'full' | 'raw';

/**
 * Flattened alert structure with minimum essential fields
 * All levels include commit_sha for LLM context
 */
export interface MinimumAlert {
  number: number;
  rule_id: string;
  rule_name: string;
  severity: string;
  message: string;
  file_path: string;
  start_line: number;
  end_line: number;
  commit_sha: string;
}

/**
 * Medium detail level adds helpful context fields
 */
export interface MediumAlert extends MinimumAlert {
  rule_description: string;
  start_column: number;
  end_column: number;
  state: string;
}

/**
 * Full detail level includes all available metadata
 */
export interface FullAlert extends MediumAlert {
  ref: string;
  analysis_key: string;
  category: string;
  tool_name: string;
  tool_version: string;
  help_text?: string;
}

/**
 * Label/value pairs shown only at full detail. Shared by the text and markdown
 * formatters so the two cannot drift apart; each applies its own line syntax.
 */
export function fullDetailFields(alert: FullAlert): [label: string, value: string][] {
  return [
    ['Reference', alert.ref],
    ['Analysis Key', alert.analysis_key],
    ['Category', alert.category],
    ['Tool', `${alert.tool_name} ${alert.tool_version}`],
  ];
}

/**
 * Filter alert data based on detail level
 * Returns flattened structure to reduce tokens, or raw CodeQLAlert for 'raw' level.
 * Nullable API fields are defaulted here (severity to 'none') so formatters never
 * call string methods on null.
 */
export function filterAlertByDetail(
  alert: CodeQLAlert,
  level: DetailLevel,
): MinimumAlert | MediumAlert | FullAlert | CodeQLAlert {
  if (level === 'raw') {
    return alert;
  }

  const instance = alert.most_recent_instance;
  const location = instance.location;

  const minimumAlert: MinimumAlert = {
    number: alert.number,
    rule_id: alert.rule.id ?? '',
    rule_name: alert.rule.name ?? '',
    severity: alert.rule.severity ?? 'none',
    message: instance.message?.text ?? '',
    file_path: location?.path ?? '',
    start_line: location?.start_line ?? 0,
    end_line: location?.end_line ?? 0,
    commit_sha: instance.commit_sha ?? '',
  };
  if (level === 'minimum') {
    return minimumAlert;
  }

  const mediumAlert: MediumAlert = {
    ...minimumAlert,
    rule_description: alert.rule.description ?? '',
    start_column: location?.start_column ?? 0,
    end_column: location?.end_column ?? 0,
    state: instance.state ?? '',
  };
  if (level === 'medium') {
    return mediumAlert;
  }

  const fullAlert: FullAlert = {
    ...mediumAlert,
    ref: instance.ref ?? '',
    analysis_key: instance.analysis_key ?? '',
    category: instance.category ?? '',
    tool_name: alert.tool.name ?? '',
    tool_version: alert.tool.version ?? '',
  };

  // Help text lives on rule.help, and only the single-alert endpoint returns it
  const help = 'help' in alert.rule ? alert.rule.help : undefined;
  if (help) {
    fullAlert.help_text = help;
  }

  return fullAlert;
}
