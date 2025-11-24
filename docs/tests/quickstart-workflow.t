Quickstart Workflow from Documentation
=======================================

This tests the quickstart examples from docs/content/index.md

Setup:

  $ ARBITER="node /home/nathan/Projects/arbiter/packages/cli/dist/cli.js"
  $ export TMPDIR=$(mktemp -d)
  $ cd $TMPDIR

Test preset initialization --list-presets:

  $ $ARBITER init --list-presets
  Available presets.*: (re)
  .* (re)

Test init command with --help shows presets:

  $ $ARBITER init --help
  .*preset.* (re)

Test add service command help:

  $ $ARBITER add service --help
  .*service.* (re)

Test add endpoint command help:

  $ $ARBITER add endpoint --help
  .*endpoint.* (re)

Test add database command help:

  $ $ARBITER add database --help
  .*database.* (re)

Test add route command help:

  $ $ARBITER add route --help
  .*route.* (re)

Cleanup:

  $ cd /tmp && rm -rf $TMPDIR
