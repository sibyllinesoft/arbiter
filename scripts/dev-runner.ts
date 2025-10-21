import { type ChildProcess, spawn } from "node:child_process";
import readline from "node:readline";

type Task = {
  name: string;
  color: (value: string) => string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
};

const COLORS = {
  reset: "\u001B[0m",
  cyan: (text: string) => `\u001B[36m${text}${COLORS.reset}`,
  magenta: (text: string) => `\u001B[35m${text}${COLORS.reset}`,
  red: (text: string) => `\u001B[31m${text}${COLORS.reset}`,
} as const;

function createPrefixedWriter(prefix: string, writer: (chunk: string) => void) {
  return (line: string) => {
    writer(`${prefix} ${line}\n`);
  };
}

function pipeStream(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on("line", onLine);
  rl.on("close", () => rl.removeAllListeners());
}

function startTask(task: Task, onExit: (child: ChildProcess, code: number | null) => void) {
  const child = spawn(task.command, task.args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
      ...task.env,
    },
  });

  const stdoutPrefix = task.color(`[${task.name}]`);
  const stderrPrefix = COLORS.red(`[${task.name}]`);

  pipeStream(
    child.stdout,
    createPrefixedWriter(stdoutPrefix, (chunk) => process.stdout.write(chunk)),
  );
  pipeStream(
    child.stderr,
    createPrefixedWriter(stderrPrefix, (chunk) => process.stderr.write(chunk)),
  );

  child.on("exit", (code) => onExit(child, code));
  child.on("error", (error) => {
    process.stderr.write(`${stderrPrefix} ${error.message}\n`);
    onExit(child, 1);
  });

  return child;
}

function runTasks(tasks: Task[]) {
  const children = new Set<ChildProcess>();
  let exiting = false;

  const stopAll = (signal: NodeJS.Signals | "exit", exitCode = 0) => {
    if (exiting) return;
    exiting = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal === "exit" ? undefined : signal);
      }
    }
    children.clear();
    process.exit(exitCode);
  };

  const handleExit = (child: ChildProcess, code: number | null) => {
    children.delete(child);
    if (exiting) {
      return;
    }
    if (code && code !== 0) {
      stopAll("SIGTERM", code);
    }
  };

  for (const task of tasks) {
    const child = startTask(task, handleExit);
    children.add(child);
  }

  const handleSignal = (signal: NodeJS.Signals) => {
    stopAll(signal, 0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);
  process.on("exit", () => stopAll("exit", 0));
}

runTasks([
  {
    name: "typecheck",
    color: COLORS.cyan,
    command: "bun",
    args: ["run", "typecheck:watch"],
  },
  {
    name: "api",
    color: COLORS.magenta,
    command: "bun",
    args: ["run", "--cwd", "apps/api", "dev"],
    env: {
      NODE_ENV: "development",
      AUTH_REQUIRED: "false",
    },
  },
]);
