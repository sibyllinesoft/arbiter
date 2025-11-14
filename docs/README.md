# Arbiter Documentation System

MkDocs now owns the published Arbiter documentation experience. Authored and generated Markdown continues to live under `docs/content`, while theming, navigation, and build behavior are centralized in `mkdocs.yml`.

## Directory layout

- `content/` – hand-written and generated Markdown grouped by topic (`overview/`, `guides/`, `reference/`, `tutorials/`, `internal/`, etc.).
- `content/assets/` – shared images, favicons, and other static assets referenced by docs or the MkDocs theme.
- `content/reference/api/tsdoc/` – generated TypeDoc Markdown (ignored by git). Regenerated automatically before each MkDocs build.
- `requirements.txt` – Python dependencies for MkDocs + extensions (install into a virtualenv).
- `../mkdocs.yml` – top-level MkDocs configuration (nav, theme, plugins, Markdown extensions).

Legacy orchestration scripts (`scripts/docs-*`) remain available and are documented in `content/internal/doc-pipeline.md`, but MkDocs is now the single source of truth for anything published publicly.

## Local commands

```bash
# 1) Install the MkDocs toolchain (once per environment)
python -m venv .venv-docs
source .venv-docs/bin/activate
python -m pip install -r docs/requirements.txt

# 2) Generate TypeDoc sources that power API pages
bun run docs:tsdoc

# 3) Start the live-reload server (runs TypeDoc first)
bun run docs:site:dev

# 4) Build production assets (outputs to docs/public)
bun run docs:site:build

# 5) Serve an existing build (after running build)
bun run docs:site:serve
```

## Authoring workflow

1. Edit Markdown inside `docs/content`. Fold related docs into subfolders so the navigation in `mkdocs.yml` stays predictable.
2. For API surface changes, ensure TSDoc comments exist and rerun `bun run docs:tsdoc` to refresh `reference/api/tsdoc/`.
3. Preview the site with `bun run docs:site:dev`. MkDocs watches the content directory automatically.
4. Open a PR. GitHub Pages rebuilds from `.github/workflows/docs-site.yml` when changes land on `main`.

## Keeping things tidy

- Large/static assets should live under `docs/content/assets/`.
- Generated files (TypeDoc output and `docs/public/`) stay out of git via `.gitignore`.
- If you migrate documents out of the legacy pipeline, keep `content/internal/doc-pipeline.md` updated so contributors know what still depends on it.
