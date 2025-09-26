export interface ParsedGitUrl {
  provider: 'github';
  owner: string;
  repo: string;
  ref?: string;
}

export function parseGitUrl(input: string): ParsedGitUrl | null {
  const normalized = input.startsWith('git+') ? input.slice(4) : input;

  if (normalized.startsWith('git@')) {
    const match = normalized.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
    if (!match) return null;
    const [, host, owner, repoRaw] = match;
    if (!isGithubHost(host)) return null;
    return {
      provider: 'github',
      owner,
      repo: repoRaw,
    };
  }

  try {
    const url = new URL(normalized);
    if (!isGithubHost(url.hostname)) {
      return null;
    }

    let pathname = url.pathname.replace(/\.git$/, '').replace(/^\//, '');
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    const [owner, repo] = segments;
    let ref: string | undefined;

    if (segments.length >= 4 && segments[2] === 'tree') {
      ref = segments.slice(3).join('/');
    }

    if (!ref && url.searchParams.has('ref')) {
      ref = url.searchParams.get('ref') ?? undefined;
    }

    if (!ref && url.hash) {
      const fragment = url.hash.replace(/^#/, '');
      if (fragment) ref = fragment;
    }

    return {
      provider: 'github',
      owner,
      repo,
      ref,
    };
  } catch {
    return null;
  }
}

function isGithubHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === 'github.com' || normalized === 'www.github.com';
}
