Arbiter CLI Documentation Tests
================================

This file contains executable tests for CLI examples used in documentation.
Run with: cram docs/tests/cli-examples.t

Test arbiter health command:

  $ arbiter health --api-url http://localhost:5050
  .*Server is healthy.* (re)

Test arbiter version:

  $ arbiter version
  .* (re)

Test arbiter init --help:

  $ arbiter init --help
  .*Initialize a new project.* (re)

Test arbiter plan command exists:

  $ arbiter plan 2>&1 | head -5
  .*Feature Planning Assistant Prompt.* (re)

Test arbiter design command exists:

  $ arbiter design 2>&1 | head -5
  .*Technical Design Assistant Prompt.* (re)

Test arbiter check with no arguments shows help:

  $ arbiter check --help
  .*Validate CUE files.* (re)
