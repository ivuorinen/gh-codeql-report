import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { isMainModule } from '../cli.js';

// npm installs the CLI as a symlink in node_modules/.bin; these tests reproduce that.
const dir = mkdtempSync(join(tmpdir(), 'gh-codeql-report-bin-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('isMainModule', () => {
  const target = join(dir, 'cli.js');
  const link = join(dir, 'gh-codeql-report');
  writeFileSync(target, '');
  symlinkSync(target, link);
  const targetUrl = pathToFileURL(target).href;

  it('should match when argv[1] is the module itself', () => {
    expect(isMainModule(target, targetUrl)).toBe(true);
  });

  it('should match when argv[1] is a symlink to the module', () => {
    expect(isMainModule(link, targetUrl)).toBe(true);
  });

  it('should not match another file, a missing path, or no argv[1]', () => {
    expect(isMainModule(join(dir, 'other.js'), targetUrl)).toBe(false);
    expect(isMainModule(undefined, targetUrl)).toBe(false);
  });
});

describe('CLI entrypoint through a bin symlink', () => {
  it('should run main() and print this package version', () => {
    const cliSource = resolve(import.meta.dirname, '../cli.ts');
    const link = join(dir, 'gh-codeql-report-ts');
    symlinkSync(cliSource, link);
    const { version } = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf-8'),
    );

    // Absolute loader URL: the child runs from the temp dir (outside this package on
    // purpose, so `--version` cannot pick up this repo's package.json by accident).
    const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

    const output = execFileSync(process.execPath, ['--import', tsxLoader, link, '--version'], {
      cwd: dir,
      encoding: 'utf-8',
    });

    expect(output.trim()).toBe(version);
  });
});
