import { Hono } from 'hono';

type Dependencies = Record<string, unknown>;

export function createGithubRouter(deps: Dependencies) {
  const router = new Hono();

  // GitHub API endpoints
  router.get('/user/repos', async c => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          400
        );
      }

      const repositories = await response.json();

      return c.json({
        success: true,
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            type: repo.owner.type,
            avatar_url: repo.owner.avatar_url,
          },
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub user repos:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch repositories',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  router.get('/user/orgs', async c => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          400
        );
      }

      const organizations = await response.json();

      return c.json({
        success: true,
        organizations: organizations.map((org: any) => ({
          login: org.login,
          id: org.id,
          description: org.description,
          avatar_url: org.avatar_url,
          public_repos: org.public_repos,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub user orgs:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch organizations',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  router.get('/orgs/:org/repos', async c => {
    const org = c.req.param('org');
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch(
        `https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          400
        );
      }

      const repositories = await response.json();

      return c.json({
        success: true,
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            type: repo.owner.type,
            avatar_url: repo.owner.avatar_url,
          },
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub org repos:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch organization repositories',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  return router;
}
