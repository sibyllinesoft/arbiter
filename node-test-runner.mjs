import { spawn } from 'node:child_process';

// Use Bun to run tests, but under node coverage via c8
const cmd = 'bun';
const args = ['test', '--serial', 'packages/cli/src'];
const child = spawn(cmd, args, {
  env: {
    ...process.env,
    ARBITER_RUN_E2E: '1',
    PATH: `/tmp/cue-bin:${process.env.PATH}`,
  },
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
