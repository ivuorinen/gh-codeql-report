# gh-codeql-report

[![CI](https://github.com/ivuorinen/gh-codeql-report/actions/workflows/ci.yml/badge.svg)](https://github.com/ivuorinen/gh-codeql-report/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ivuorinen/gh-codeql-report.svg)](https://www.npmjs.com/package/@ivuorinen/gh-codeql-report)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Collect repository CodeQL findings as a LLM-friendly report for easier fixing.

A TypeScript CLI tool that fetches CodeQL security scanning results from GitHub repositories and formats them into LLM-friendly reports. Perfect for feeding security alerts to AI assistants for analysis and remediation suggestions.

## Features

- 🔍 **Automatic Repository Detection** - Detects GitHub repository from local git remotes
- 🔐 **Multiple Authentication Methods** - Uses `GITHUB_TOKEN` environment variable or GitHub CLI (`gh`)
- 📊 **Multiple Output Formats** - JSON, SARIF, Markdown, and Plain Text
- 🎚️ **Configurable Detail Levels** - Choose from minimum, medium, full, or raw detail
- 🎉 **Clean Exit for No Alerts** - Celebrates when no security issues are found
- 📝 **Comprehensive Reports** - Includes rule details, locations, messages, and metadata
- 🚀 **Easy Integration** - Use with `npx` or install globally

## Installation

### Using npx (Recommended)

No installation required:

```bash
npx @ivuorinen/gh-codeql-report
```

### Global Installation

```bash
npm install -g @ivuorinen/gh-codeql-report
gh-codeql-report
```

### Local Development

```bash
git clone https://github.com/ivuorinen/gh-codeql-report.git
cd gh-codeql-report
npm install
npm run build
```

## Prerequisites

- **Node.js** 22+
- **GitHub repository** with CodeQL scanning enabled
- **Authentication**: Either:
  - `GITHUB_TOKEN` environment variable with the `security_events` scope (classic token) or
    "Code scanning alerts: read" permission (fine-grained token), or
  - GitHub CLI (`gh`) authenticated

## Authentication

### Option 1: Environment Variable

```bash
export GITHUB_TOKEN="ghp_your_token_here"
npx @ivuorinen/gh-codeql-report
```

### Option 2: GitHub CLI

```bash
gh auth login
npx @ivuorinen/gh-codeql-report
```

The tool will automatically use `gh` CLI if `GITHUB_TOKEN` is not set.

## Usage

### Basic Usage

Run in your repository directory:

```bash
npx @ivuorinen/gh-codeql-report
```

This will:
1. Detect the repository from your git remote
2. Fetch all open CodeQL alerts
3. Generate a `code-scanning-report-[timestamp].json` file with medium detail

### CLI Options

```bash
gh-codeql-report [options]
```

| Option      | Alias | Description                                      | Default                                     |
|-------------|-------|--------------------------------------------------|---------------------------------------------|
| `--format`  | `-f`  | Output format: `json`, `sarif`, `txt`, `md`      | `json`                                      |
| `--detail`  | `-d`  | Detail level: `minimum`, `medium`, `full`, `raw` | `medium`                                    |
| `--output`  | `-o`  | Output file path                                 | `code-scanning-report-[timestamp].[format]` |
| `--repo`    | `-r`  | Repository as `owner/name` or GitHub URL         | git remote of the current directory         |
| `--help`    | `-h`  | Show help                                        |                                             |
| `--version` | `-v`  | Show version                                     |                                             |

### Examples

#### Generate JSON Report with Full Detail

```bash
npx @ivuorinen/gh-codeql-report --format json --detail full
```

#### Generate Markdown Report for LLM

```bash
npx @ivuorinen/gh-codeql-report --format md --output security-report.md
```

#### Generate SARIF Report

```bash
npx @ivuorinen/gh-codeql-report --format sarif --output results.sarif
```

#### Get Raw API Response

```bash
npx @ivuorinen/gh-codeql-report --detail raw --output raw-alerts.json
```

## Output Formats

### JSON
Structured JSON output with flattened alert data. Ideal for programmatic processing and LLM consumption.

### SARIF
Standard SARIF v2.1.0 format. Compatible with many security tools and CI/CD platforms.

### Markdown
Human-readable markdown with tables and sections. Great for documentation and LLM context.

### Text
Plain text format for quick reading and terminal output.

## Detail Levels

### Minimum
Essential information only:
- Alert number and rule ID/name
- Severity and message
- File path and line numbers
- Commit SHA

### Medium (Default)
Balanced detail for most use cases:
- Everything from minimum level
- Rule description
- Column numbers
- Alert state (always `open`: only open alerts are fetched)

### Full
Complete information:
- Everything from medium level
- Git reference (branch/tag)
- Analysis key and category
- Tool name and version
- Help text (if available)

Full and raw detail make one extra API request per alert to fetch the rule help text.

### Raw
Original API response without processing. Useful for debugging or custom processing.
Not available with `--format sarif`, since the raw response is not SARIF.

## Exit Codes

- `0` - Success (report generated or no alerts found)
- `1` - Error (authentication failed, repository not found, API error, etc.)

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

Compiles TypeScript to `dist/` directory.

### Run Locally

```bash
# From source, against this repository
npm run dev

# From source, against another repository (args after --)
npm run dev -- --repo owner/name --format md --detail full

# Using compiled version
node dist/cli.js
```

### Code Quality

```bash
# Lint with Biome
npm run lint

# Lint with auto-fix
npm run lint:fix

# Format code
npm run format
```

### Testing

```bash
# Run all tests with coverage
npm test
```

The test suite includes:
- Unit tests for all formatters
- Integration tests for CLI
- Error handling scenarios
- GitHub API mocking

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── formatters/         # Output format generators
│   ├── json.ts
│   ├── sarif.ts
│   ├── markdown.ts
│   └── text.ts
├── lib/                # Core functionality
│   ├── auth.ts         # GitHub authentication
│   ├── codeql.ts       # CodeQL API client
│   ├── git.ts          # Git remote parsing
│   └── types.ts        # TypeScript types
└── __tests__/          # Test suites
```

## CI/CD

The project uses GitHub Actions for:
- **CI**: Linting, testing, and building on every push/PR
- **Release**: Automated npm publishing on version tags

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linting (`npm run lint:fix`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- ES Modules (type: module)
- TypeScript with strict mode
- Biome for linting and formatting
- 2-space indentation
- LF line endings

## Use Cases

### For LLMs
Feed the generated reports to AI assistants for:
- Security vulnerability analysis
- Remediation suggestions
- Code review assistance
- Documentation generation

### For CI/CD
Integrate into pipelines for:
- Security gate checks
- Automated reporting
- Trend analysis
- Alert notifications

### For Security Teams
- Centralized alert collection
- Custom report formatting
- Historical data export
- Integration with ticketing systems

## Troubleshooting

### No git remotes found
Ensure you're in a git repository with a GitHub remote:
```bash
git remote -v
```

### Authentication failed
Check your token or GitHub CLI:
```bash
echo $GITHUB_TOKEN
# or
gh auth status
```

### No CodeQL alerts found
This is good news! It means your repository has no open security issues.

## License

[MIT](LICENSE) © 2025 Ismo Vuorinen

## Links

- [GitHub Repository](https://github.com/ivuorinen/gh-codeql-report)
- [npm Package](https://www.npmjs.com/package/@ivuorinen/gh-codeql-report)
- [Issue Tracker](https://github.com/ivuorinen/gh-codeql-report/issues)
- [CodeQL Documentation](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
