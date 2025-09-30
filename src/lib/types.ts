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
 * Filter alert data based on detail level
 * Returns flattened structure to reduce tokens, or raw CodeQLAlert for 'raw' level
 */
export function filterAlertByDetail(
  alert: CodeQLAlert,
  level: DetailLevel,
): MinimumAlert | MediumAlert | FullAlert | CodeQLAlert {
  if (level === 'raw') {
    return alert;
  }

  if (level === 'full') {
    const fullAlert: FullAlert = {
      number: alert.number,
      rule_id: alert.rule.id,
      rule_name: alert.rule.name,
      severity: alert.rule.severity,
      message: alert.most_recent_instance.message.text,
      file_path: alert.most_recent_instance.location.path,
      start_line: alert.most_recent_instance.location.start_line,
      end_line: alert.most_recent_instance.location.end_line,
      commit_sha: alert.most_recent_instance.commit_sha,
      rule_description: alert.rule.description,
      start_column: alert.most_recent_instance.location.start_column,
      end_column: alert.most_recent_instance.location.end_column,
      state: alert.most_recent_instance.state,
      ref: alert.most_recent_instance.ref,
      analysis_key: alert.most_recent_instance.analysis_key,
      category: alert.most_recent_instance.category,
      tool_name: alert.tool.name,
      tool_version: alert.tool.version,
    };

    // Add help_text if available
    if (alert.help) {
      fullAlert.help_text = alert.help;
    }

    return fullAlert;
  }

  if (level === 'medium') {
    const mediumAlert: MediumAlert = {
      number: alert.number,
      rule_id: alert.rule.id,
      rule_name: alert.rule.name,
      severity: alert.rule.severity,
      message: alert.most_recent_instance.message.text,
      file_path: alert.most_recent_instance.location.path,
      start_line: alert.most_recent_instance.location.start_line,
      end_line: alert.most_recent_instance.location.end_line,
      commit_sha: alert.most_recent_instance.commit_sha,
      rule_description: alert.rule.description,
      start_column: alert.most_recent_instance.location.start_column,
      end_column: alert.most_recent_instance.location.end_column,
      state: alert.most_recent_instance.state,
    };
    return mediumAlert;
  }

  // minimum level
  const minimumAlert: MinimumAlert = {
    number: alert.number,
    rule_id: alert.rule.id,
    rule_name: alert.rule.name,
    severity: alert.rule.severity,
    message: alert.most_recent_instance.message.text,
    file_path: alert.most_recent_instance.location.path,
    start_line: alert.most_recent_instance.location.start_line,
    end_line: alert.most_recent_instance.location.end_line,
    commit_sha: alert.most_recent_instance.commit_sha,
  };
  return minimumAlert;
}
