import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const WORKDIR = process.env.CLAUDE_CODE_WORKDIR ?? '/srv/claude-code/workspaces';
const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Only POST supported' }));
    return;
  }

  try {
    const payload = await readBody(req);
    const body = JSON.parse(payload);

    const repository = body.repository ?? {};
    const envHints = body.environmentHints ?? {};
    const secrets = body.secrets ?? {};
    const containerCfg = body.adapter?.durableObject?.container ?? {};

    await mkdir(WORKDIR, { recursive: true });

    const webhookPath = path.join(tmpdir(), 'arbiter-webhook.json');
    await writeFile(webhookPath, JSON.stringify(body, null, 2), 'utf-8');

    const gitEnv = buildGitEnvironment(secrets);
    const repoInfo = resolveRepository(repository, envHints, containerCfg, secrets);

    if (repoInfo.httpUrl) {
      console.log(`[claude-code] syncing repo ${repoInfo.httpUrl} (branch=${repoInfo.branch ?? 'default'})`);
      await syncRepository(repoInfo, gitEnv);
    } else {
      console.warn('[claude-code] No repository URL provided; skipping checkout');
    }

    const bifrostUrl =
      process.env.BIFROST_GATEWAY_URL ??
      `http://${process.env.BIFROST_HOST ?? '127.0.0.1'}:${process.env.BIFROST_PORT ?? '8080'}`;
    const claudeServiceName = process.env.CLAUDE_CODE_OTEL_SERVICE_NAME ?? 'claude-code-runner';
    const claudeResourceAttrs =
      process.env.CLAUDE_CODE_OTEL_RESOURCE_ATTRIBUTES ??
      `service.name=${claudeServiceName},service.namespace=${process.env.OTEL_RESOURCE_NAMESPACE ?? 'arbiter'},service.instance.id=${process.env.HOSTNAME ?? 'claude-code-runner'}`;

    const anthropicBaseUrl = `${bifrostUrl.replace(/\/\/$/, '')}/anthropic`;

    const claudeEnv = {
      ...process.env,
      ...envHints,
      CLAUDE_CODE_WORKDIR: WORKDIR,
      ARBITER_WEBHOOK_PATH: webhookPath,
      BIFROST_GATEWAY_URL: bifrostUrl,
      ANTHROPIC_API_URL: anthropicBaseUrl,
      ANTHROPIC_BASE_URL: anthropicBaseUrl,
      CLAUDE_CODE_GATEWAY_URL: bifrostUrl,
      CLAUDE_USE_API_KEYS: process.env.CLAUDE_USE_API_KEYS ?? 'true',
      OTEL_SERVICE_NAME: claudeServiceName,
      OTEL_RESOURCE_ATTRIBUTES: claudeResourceAttrs,
      ...mapSecretsToEnv(secrets),
    };

    const prompt = buildPrompt(body, containerCfg, repoInfo);

    const claudeArgs = [
      '--print',
      '--output-format=json',
      '--model', process.env.CLAUDE_CODE_MODEL ?? 'openrouter/x-ai/grok-4-fast',
      '--debug', 'api,http',
      ...((body.claudeArgs && Array.isArray(body.claudeArgs)) ? body.claudeArgs : []),
      prompt,
    ];

    const claudeBinary =
      process.env.CLAUDE_CODE_BIN ||
      (await resolveClaudeBinary()) ||
      'claude';
    const claudeResult = await runCommand(claudeBinary, claudeArgs, {
      cwd: repoInfo.checkoutPath ?? WORKDIR,
      env: claudeEnv,
      stdio: 'inherit',
    });

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Claude CLI completed',
        data: {
          repository: repoInfo,
          exitCode: claudeResult.code,
        },
      })
    );
  } catch (error) {
    console.error('[claude-code] execution failed', error);
    if (error?.stderr) {
      console.error('[claude-code] stderr:', error.stderr.toString());
    }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`[claude-code] listening on port ${PORT}`);
});

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function buildGitEnvironment(secrets) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };

  const githubToken =
    secrets?.GITHUB_TOKEN ||
    secrets?.GIT_ACCESS_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GIT_ACCESS_TOKEN;

  if (typeof githubToken === 'string' && githubToken.length > 0) {
    env.GITHUB_TOKEN = githubToken;
  }

  return env;
}

function resolveRepository(repository, envHints, containerCfg, secrets) {
  const httpUrl =
    envHints.ARBITER_REPO_HTTP_URL ||
    repository.httpUrl ||
    containerCfg.repository ||
    null;

  const token =
    secrets?.GIT_ACCESS_TOKEN ||
    secrets?.GITHUB_TOKEN ||
    process.env.GIT_ACCESS_TOKEN ||
    process.env.GITHUB_TOKEN ||
    null;

  const enrichedUrl = embedToken(httpUrl, token);

  const branch =
    envHints.ARBITER_REPO_BRANCH ||
    repository.branch ||
    envHints.ARBITER_REPO_DEFAULT_BRANCH ||
    repository.defaultBranch ||
    null;

  const checkoutPath = httpUrl
    ? path.join(WORKDIR, sanitizeRepoName(repository.fullName ?? repository.name ?? 'repo'))
    : null;

  return {
    ...repository,
    httpUrl: enrichedUrl,
    branch,
    checkoutPath,
    originalUrl: httpUrl,
  };
}

function embedToken(httpUrl, token) {
  if (!httpUrl || !token) return httpUrl;
  try {
    const url = new URL(httpUrl);
    if (url.username || url.password) {
      return httpUrl;
    }
    url.username = 'token';
    url.password = token;
    return url.toString();
  } catch (error) {
    console.warn('[claude-code] unable to embed git token', error);
    return httpUrl;
  }
}

function sanitizeRepoName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function syncRepository(repoInfo, env) {
  const { httpUrl, branch, checkoutPath } = repoInfo;
  if (!checkoutPath || !httpUrl) return;

  await mkdir(WORKDIR, { recursive: true });

  const repoExists = await pathExists(path.join(checkoutPath, '.git'));

  if (!repoExists) {
    await runCommand('git', ['clone', httpUrl, checkoutPath], {
      cwd: WORKDIR,
      env,
      stdio: 'inherit',
    });
  } else {
    await runCommand('git', ['remote', 'set-url', 'origin', httpUrl], {
      cwd: checkoutPath,
      env,
      stdio: 'inherit',
      allowFailure: true,
    });
    await runCommand('git', ['fetch', '--all'], {
      cwd: checkoutPath,
      env,
      stdio: 'inherit',
    });
  }

  if (branch) {
    await runCommand('git', ['checkout', branch], {
      cwd: checkoutPath,
      env,
      stdio: 'inherit',
      allowFailure: true,
    });
    await runCommand('git', ['reset', '--hard', `origin/${branch}`], {
      cwd: checkoutPath,
      env,
      stdio: 'inherit',
      allowFailure: true,
    });
  }
}


function buildPrompt(body, containerCfg, repoInfo) {
  const promptFromBody =
    typeof body.prompt === 'string' && body.prompt.trim().length > 0
      ? body.prompt.trim()
      : null;
  const promptFromContainer =
    typeof containerCfg.prompt === 'string' && containerCfg.prompt.trim().length > 0
      ? containerCfg.prompt.trim()
      : null;

  if (promptFromBody) return promptFromBody;
  if (promptFromContainer) return promptFromContainer;

  const checkoutPath = repoInfo.checkoutPath ?? 'the repository workspace';
  return `Provide a brief summary of the repository at ${checkoutPath} and confirm the automation tunnel is healthy.`;
}

async function resolveClaudeBinary() {
  const candidates = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    '/usr/local/bin/claude-code',
    '/usr/bin/claude-code'
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

function mapSecretsToEnv(secrets) {
  const env = {};
  const merged = { ...secrets };
  if (!merged?.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY) {
    merged.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  }
  if (!merged?.GITHUB_TOKEN && process.env.GITHUB_TOKEN) {
    merged.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }
  if (!merged?.GIT_ACCESS_TOKEN && process.env.GIT_ACCESS_TOKEN) {
    merged.GIT_ACCESS_TOKEN = process.env.GIT_ACCESS_TOKEN;
  }
  if (!merged?.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY) {
    merged.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  }
  if (!merged?.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY) {
    merged.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  for (const [key, value] of Object.entries(merged ?? {})) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return env;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: options.stdio ?? 'pipe',
      cwd: options.cwd,
      env: options.env,
    });

    child.on('close', code => {
      const success = code === 0;
      if (!success && !options.allowFailure) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve({ success, code });
      }
    });

    child.on('error', err => {
      if (err instanceof Error) {
        err.stderr = err.stderr ?? ''
      }
      reject(err);
    });
  });
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
