import { describe, expect, it } from 'vitest';
import { formatAsJSON } from '../formatters/json.js';
import { formatAsMarkdown, generateMarkdownTable } from '../formatters/markdown.js';
import { formatAsSARIF } from '../formatters/sarif.js';
import { formatAsText } from '../formatters/text.js';
import type { CodeQLAlert } from '../lib/codeql.js';

// Partial fixture: only the fields the code reads, not the full API schema
const mockAlert = {
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
} as unknown as CodeQLAlert;

describe('Formatters', () => {
  describe('formatAsJSON', () => {
    it('should format alerts as JSON with default (medium) detail', () => {
      const result = formatAsJSON([mockAlert]);
      expect(result).toContain('"number": 1');
      expect(result).toContain('"js/sql-injection"');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should format alerts with minimum detail (flat structure)', () => {
      const result = formatAsJSON([mockAlert], 'minimum');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('number');
      expect(parsed[0]).toHaveProperty('rule_id');
      expect(parsed[0]).toHaveProperty('commit_sha'); // Now in all levels
      expect(parsed[0]).not.toHaveProperty('rule_description');
      expect(parsed[0]).not.toHaveProperty('rule.id'); // Nested structure removed
    });

    it('should format alerts with medium detail (flat structure)', () => {
      const result = formatAsJSON([mockAlert], 'medium');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('number');
      expect(parsed[0]).toHaveProperty('rule_description');
      expect(parsed[0]).toHaveProperty('commit_sha');
      expect(parsed[0]).toHaveProperty('state');
      expect(parsed[0]).not.toHaveProperty('ref');
      expect(parsed[0]).not.toHaveProperty('most_recent_instance'); // Nested structure removed
    });

    it('should format alerts with full detail (flat structure)', () => {
      const result = formatAsJSON([mockAlert], 'full');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('ref');
      expect(parsed[0]).toHaveProperty('tool_name');
      expect(parsed[0]).toHaveProperty('tool_version');
      expect(parsed[0]).not.toHaveProperty('tool'); // Nested structure removed
    });

    it('should include help_text from rule.help in full detail when available', () => {
      // The single-alert endpoint returns help on the rule, not the alert
      const alertWithHelp = {
        ...mockAlert,
        rule: { ...mockAlert.rule, help: 'This is a helpful guide on how to fix this issue.' },
      } as CodeQLAlert;
      const result = formatAsJSON([alertWithHelp], 'full');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('help_text');
      expect(parsed[0].help_text).toBe('This is a helpful guide on how to fix this issue.');
    });

    it('should default every nullable or missing API field instead of emitting null', () => {
      // Shape the API may legally return: nullable rule fields, no location, no message
      const sparse = {
        number: 9,
        rule: { id: null, severity: null },
        most_recent_instance: {},
        tool: { version: null },
      } as unknown as CodeQLAlert;
      const [full] = JSON.parse(formatAsJSON([sparse], 'full'));
      expect(full).toEqual({
        number: 9,
        rule_id: '',
        rule_name: '',
        severity: 'none',
        message: '',
        file_path: '',
        start_line: 0,
        end_line: 0,
        commit_sha: '',
        rule_description: '',
        start_column: 0,
        end_column: 0,
        state: '',
        ref: '',
        analysis_key: '',
        category: '',
        tool_name: '',
        tool_version: '',
      });
      expect(JSON.parse(formatAsSARIF([sparse], 'full')).runs[0].tool.driver.version).toBe('1.0.0');
    });

    it('should format alerts with raw detail (original structure)', () => {
      const result = formatAsJSON([mockAlert], 'raw');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('most_recent_instance');
      expect(parsed[0]).toHaveProperty('tool');
      expect(parsed[0]).toHaveProperty('rule');
    });

    it('should handle empty array', () => {
      const result = formatAsJSON([]);
      expect(result).toBe('[]');
    });
  });

  describe('formatAsText', () => {
    it('should format alerts as text with default (medium) detail', () => {
      const result = formatAsText([mockAlert]);
      expect(result).toContain('CodeQL Security Scan Report');
      expect(result).toContain('Total Alerts: 1');
      expect(result).toContain('Detail Level: medium');
      expect(result).toContain('Alert #1');
      expect(result).toContain('js/sql-injection');
      expect(result).toContain('SQL Injection');
      expect(result).toContain('src/database.js');
    });

    it('should format alerts with minimum detail (commit now included)', () => {
      const result = formatAsText([mockAlert], 'minimum');
      expect(result).toContain('Detail Level: minimum');
      expect(result).toContain('Alert #1');
      expect(result).toContain('Commit:'); // Now in all levels
      expect(result).not.toContain('Description:');
      expect(result).not.toContain('Columns:');
      expect(result).not.toContain('State:');
    });

    it('should format alerts with full detail', () => {
      const result = formatAsText([mockAlert], 'full');
      expect(result).toContain('Detail Level: full');
      expect(result).toContain('Description:');
      expect(result).toContain('Columns:');
      expect(result).toContain('Commit:');
    });

    it('should handle empty array', () => {
      const result = formatAsText([]);
      expect(result).toContain('Total Alerts: 0');
    });

    it('should format alerts with raw detail (original structure)', () => {
      const result = formatAsText([mockAlert], 'raw');
      expect(result).toContain('Detail Level: raw');
      expect(result).toContain('"most_recent_instance"');
      expect(result).toContain('"tool"');
      expect(result).toContain('"rule"');
      const parsed = JSON.parse(result.split('\n').slice(4, -2).join('\n'));
      expect(parsed).toHaveProperty('most_recent_instance');
      expect(parsed).toHaveProperty('tool');
    });
  });

  describe('generateMarkdownTable', () => {
    it('should generate a valid markdown table', () => {
      const data = [
        ['Name', 'Age', 'City'],
        ['Alice', '30', 'NYC'],
        ['Bob', '25', 'LA'],
      ];
      const result = generateMarkdownTable(data);
      expect(result).toContain('| Name  | Age | City |');
      expect(result).toContain('| ----- | --- | ---- |');
      expect(result).toContain('| Alice | 30  | NYC  |');
      expect(result).toContain('| Bob   | 25  | LA   |');
    });

    it('should handle empty array', () => {
      const result = generateMarkdownTable([]);
      expect(result).toBe('');
    });

    it('should handle jagged arrays (rows with missing columns)', () => {
      const data = [
        ['Name', 'Age', 'City'],
        ['Alice', '30'], // Missing city
        ['Bob', '25', 'LA'],
      ];
      const result = generateMarkdownTable(data);
      expect(result).toContain('| Name  | Age | City |');
      expect(result).toContain('| ----- | --- | ---- |');
      expect(result).toContain('| Alice | 30  |      |'); // Empty cell for missing column
      expect(result).toContain('| Bob   | 25  | LA   |');
    });

    it('should handle single row (headers only)', () => {
      const data = [['Header1', 'Header2']];
      const result = generateMarkdownTable(data);
      expect(result).toContain('| Header1 | Header2 |');
      expect(result).toContain('| ------- | ------- |');
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format alerts as markdown with default (medium) detail', () => {
      const result = formatAsMarkdown([mockAlert], 'owner/repo');
      expect(result).toContain('# CodeQL Security Scan Report');
      expect(result).toContain('**Repository:** owner/repo');
      expect(result).toContain('**Total Alerts:** 1');
      expect(result).toContain('**Detail Level:** medium');
      expect(result).toContain('## Summary by Severity');
      expect(result).toContain('### Alert #1: SQL Injection');
      expect(result).toContain('`js/sql-injection`');
    });

    it('should format with minimum detail (commit now included)', () => {
      const result = formatAsMarkdown([mockAlert], 'owner/repo', 'minimum');
      expect(result).toContain('**Detail Level:** minimum');
      expect(result).toContain('**Commit:**'); // Now in all levels
      expect(result).toContain('#### Details'); // Now always present (for commit)
      expect(result).not.toContain('**Description:**');
      expect(result).not.toContain('**Columns:**');
      expect(result).not.toContain('**State:**');
    });

    it('should format with full detail (includes ref)', () => {
      const result = formatAsMarkdown([mockAlert], 'owner/repo', 'full');
      expect(result).toContain('**Detail Level:** full');
      expect(result).toContain('**Reference:**');
    });

    it('should count a null severity as none instead of crashing', () => {
      const nullSeverity = {
        ...mockAlert,
        rule: { ...mockAlert.rule, severity: null },
      } as unknown as CodeQLAlert;
      const result = formatAsMarkdown([nullSeverity], 'owner/repo');
      expect(result).toContain('| none     | 1     |');
      expect(result).toContain('**Severity:** none');
    });

    it('should include severity summary table', () => {
      const result = formatAsMarkdown([mockAlert], 'owner/repo');
      expect(result).toContain('Severity');
      expect(result).toContain('Count');
      expect(result).toContain('error');
    });

    it('should format with raw detail (original structure as JSON)', () => {
      const result = formatAsMarkdown([mockAlert], 'owner/repo', 'raw');
      expect(result).toContain('**Detail Level:** raw');
      expect(result).toContain('```json');
      expect(result).toContain('"most_recent_instance"');
      expect(result).toContain('"tool"');
      expect(result).toContain('"rule"');
    });

    it('should handle multiple alerts with different severities', () => {
      const alerts: CodeQLAlert[] = [
        mockAlert,
        { ...mockAlert, number: 2, rule: { ...mockAlert.rule, severity: 'warning' } },
        { ...mockAlert, number: 3, rule: { ...mockAlert.rule, severity: 'warning' } },
        { ...mockAlert, number: 4, rule: { ...mockAlert.rule, severity: 'note' } },
      ];
      const result = formatAsMarkdown(alerts, 'owner/repo');
      expect(result).toContain('**Total Alerts:** 4');
      expect(result).toContain('error');
      expect(result).toContain('warning');
      expect(result).toContain('note');
      // Should have summary table with all three severities
      expect(result).toContain('## Summary by Severity');
    });
  });

  describe('formatAsSARIF', () => {
    it('should format alerts as valid SARIF with default (medium) detail', () => {
      const result = formatAsSARIF([mockAlert]);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('$schema');
      expect(parsed).toHaveProperty('version');
      expect(parsed.runs).toHaveLength(1);
    });

    it('should format with minimum detail', () => {
      const result = formatAsSARIF([mockAlert], 'minimum');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should format with full detail (includes tool version)', () => {
      const result = formatAsSARIF([mockAlert], 'full');
      const parsed = JSON.parse(result);
      expect(parsed.runs[0].tool.driver.version).toBe('2.0.0');
    });

    it('should refuse raw detail, which is not SARIF', () => {
      expect(() => formatAsSARIF([mockAlert], 'raw')).toThrow('raw detail is not valid SARIF');
    });

    it.each([
      ['error', 'error'],
      ['warning', 'warning'],
      ['note', 'note'],
      ['none', 'note'],
    ])('should map %s severity to %s level', (severity, level) => {
      const alert = { ...mockAlert, rule: { ...mockAlert.rule, severity } } as CodeQLAlert;
      const parsed = JSON.parse(formatAsSARIF([alert]));
      expect(parsed.runs[0].results[0].level).toBe(level);
    });

    it('should map a null severity to note level instead of crashing', () => {
      const alert = {
        ...mockAlert,
        rule: { ...mockAlert.rule, severity: null },
      } as unknown as CodeQLAlert;
      const parsed = JSON.parse(formatAsSARIF([alert]));
      expect(parsed.runs[0].results[0].level).toBe('note');
    });
  });
});
