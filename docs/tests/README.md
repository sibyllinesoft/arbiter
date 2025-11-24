# Documentation CLI Tests

This directory contains executable tests for CLI examples used in the Arbiter documentation.

## Using Cram

[Cram](https://bitheap.org/cram/) is a functional testing framework for command-line applications based on Mercurial's unified test format.

### Installation

```bash
pip install -r ../requirements.txt
```

### Running Tests

```bash
# Run all tests
cram docs/tests/*.t

# Run specific test file
cram docs/tests/cli-examples.t

# Verbose output
cram -v docs/tests/*.t

# Update test output (interactive)
cram -i docs/tests/*.t
```

### Writing Tests

Cram test files use a simple format:

```
Test description:

  $ command to run
  expected output (regex)

  $ another command
  more expected output
```

**Key features:**

- Lines starting with `$` are executed as shell commands
- Following lines are expected output
- Use `.*` for wildcards
- Use `(re)` suffix for regex matching
- Use `(glob)` suffix for glob matching
- Use `(no-eol)` if output has no trailing newline

### Example

```
Test arbiter health:

  $ arbiter health
  .*Server is healthy.* (re)
  .*API version.* (re)
```

## Integration with CI

Add to your CI pipeline:

```yaml
# .github/workflows/docs-test.yml
- name: Install Python dependencies
  run: pip install -r docs/requirements.txt

- name: Start Arbiter API server
  run: bun run dev &

- name: Wait for server
  run: sleep 5

- name: Run documentation CLI tests
  run: cram docs/tests/*.t
```

## Best Practices

1. **Keep tests fast**: Test CLI interface, not full functionality
2. **Use regex patterns**: Output may vary slightly between runs
3. **Test help text**: Ensure documentation examples match --help output
4. **Separate complex tests**: Use golden file tests in packages/cli for detailed testing
5. **Update regularly**: Run `cram -i` when CLI output changes intentionally
