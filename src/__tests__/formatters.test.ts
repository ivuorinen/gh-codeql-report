import { describe, expect, it } from 'vitest';
import { formatAsJSON } from '../formatters/json.js';
import { formatAsMarkdown, generateMarkdownTable } from '../formatters/markdown.js';
import { formatAsSARIF } from '../formatters/sarif.js';
import { formatAsText } from '../formatters/text.js';
import type { CodeQLAlert } from '../lib/codeql.js';

const mockAlert: CodeQLAlert = {
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
};

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

    it('should include help_text in full detail when available', () => {
      const alertWithHelp = {
        ...mockAlert,
        help: 'This is a helpful guide on how to fix this issue.',
      };
      const result = formatAsJSON([alertWithHelp], 'full');
      const parsed = JSON.parse(result);
      expect(parsed[0]).toHaveProperty('help_text');
      expect(parsed[0].help_text).toBe('This is a helpful guide on how to fix this issue.');
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
      const result = formatAsSARIF([mockAlert], 'owner/repo');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('$schema');
      expect(parsed).toHaveProperty('version');
      expect(parsed.runs).toHaveLength(1);
    });

    it('should format with minimum detail', () => {
      const result = formatAsSARIF([mockAlert], 'owner/repo', 'minimum');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should format with full detail (includes tool version)', () => {
      const result = formatAsSARIF([mockAlert], 'owner/repo', 'full');
      const parsed = JSON.parse(result);
      expect(parsed.runs[0].tool.driver.version).toBe('2.0.0');
    });

    it('should format with raw detail (returns original JSON)', () => {
      const result = formatAsSARIF([mockAlert], 'owner/repo', 'raw');
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('most_recent_instance');
      expect(parsed[0]).toHaveProperty('tool');
    });

    it('should map medium severity to warning level', () => {
      const mediumAlert = { ...mockAlert, rule: { ...mockAlert.rule, severity: 'medium' } };
      const result = formatAsSARIF([mediumAlert], 'owner/repo');
      const parsed = JSON.parse(result);
      expect(parsed.runs[0].results[0].level).toBe('warning');
    });

    it('should map warning severity to warning level', () => {
      const warningAlert = { ...mockAlert, rule: { ...mockAlert.rule, severity: 'warning' } };
      const result = formatAsSARIF([warningAlert], 'owner/repo');
      const parsed = JSON.parse(result);
      expect(parsed.runs[0].results[0].level).toBe('warning');
    });

    it('should map unknown severity to note level', () => {
      const lowAlert = { ...mockAlert, rule: { ...mockAlert.rule, severity: 'low' } };
      const result = formatAsSARIF([lowAlert], 'owner/repo');
      const parsed = JSON.parse(result);
      expect(parsed.runs[0].results[0].level).toBe('note');
    });
  });
});
