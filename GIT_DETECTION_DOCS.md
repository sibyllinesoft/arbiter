# 🔍 GitHub Repository Auto-Detection

This document describes the intelligent Git repository auto-detection functionality for the GitHub sync feature in the Arbiter CLI.

## 🎯 Overview

The GitHub sync functionality now automatically detects repository information from your Git remote configuration, eliminating the need for manual configuration in most cases. This makes the system "just work" for typical GitHub projects.

## ✨ Key Features

### 1. **Automatic Repository Detection**
- Reads Git remote origin URL automatically
- Supports both HTTPS and SSH Git remote formats
- Parses URLs like:
  - `https://github.com/owner/repo.git`
  - `git@github.com:owner/repo.git`
- Extracts owner and repo name from remote URL

### 2. **Smart Configuration Merging**
- **No config**: Uses auto-detected values from Git remote
- **Config matches Git**: Uses config values (validated)
- **Config differs from Git**: Intelligent conflict resolution
- **Fallback behavior**: Graceful handling when Git remote doesn't exist

### 3. **Conflict Resolution**
- Automatic detection of conflicts between config and Git remote
- Clear comparison display showing both options
- Command-line flags for non-interactive resolution:
  - `--use-config`: Use configuration file values
  - `--use-git-remote`: Use Git remote values
- Interactive prompts with helpful guidance

### 4. **Comprehensive Validation**
- Repository configuration validation with error messages
- Helpful suggestions for common configuration mistakes
- Input sanitization and format validation

## 🚀 Usage Examples

### Happy Path - Zero Configuration
For a typical GitHub project with `GITHUB_TOKEN` set:

```bash
# Just works! No configuration needed
git remote add origin https://github.com/myorg/myproject.git
export GITHUB_TOKEN=your_token_here
arbiter generate --sync-github
```

### Configuration Override
Use explicit configuration when you want to override Git remote:

```json
// .arbiter/config.json
{
  "github": {
    "repository": {
      "owner": "my-org",
      "repo": "my-repo"
    }
  }
}
```

```bash
arbiter generate --sync-github
```

### Conflict Resolution
When config differs from Git remote:

```bash
# Use Git remote (ignores config)
arbiter generate --sync-github --use-git-remote

# Use config (ignores Git remote) 
arbiter generate --sync-github --use-config

# Interactive (shows both options and asks)
arbiter generate --sync-github --verbose
```

## 🔧 Configuration Schema Updates

The repository configuration is now optional in the schema:

```typescript
interface GitHubRepo {
  owner?: string;  // Auto-detected if not specified
  repo?: string;   // Auto-detected if not specified  
  baseUrl?: string;
  tokenEnv?: string;
}
```

## 📋 Command-Line Options

New options added to `arbiter generate`:

- `--use-config`: Use configuration file repository info (for conflict resolution)
- `--use-git-remote`: Use Git remote repository info (for conflict resolution)

Existing options remain unchanged:
- `--sync-github`: Sync epics and tasks to GitHub after generation
- `--github-dry-run`: Preview GitHub sync changes without applying them

## 🛡️ Error Handling

### Graceful Fallbacks
1. **No Git remote**: Falls back to config or provides setup instructions
2. **Non-GitHub remote**: Informs user and requests GitHub configuration
3. **No token**: Clear instructions for setting up `GITHUB_TOKEN`
4. **Invalid config**: Validation errors with helpful suggestions

### Informative Messages
- Clear error messages explaining what went wrong
- Actionable suggestions for fixing issues
- Step-by-step setup instructions for new users

## 💡 Examples by Scenario

### Scenario 1: New GitHub Project
```bash
# 1. Initialize Git and add GitHub remote
git init
git remote add origin https://github.com/mycompany/awesome-project.git

# 2. Set GitHub token
export GITHUB_TOKEN=your_personal_access_token

# 3. Generate and sync (zero configuration!)
arbiter generate --sync-github
# Output: 📁 Repository: mycompany/awesome-project (auto-detected from Git remote)
```

### Scenario 2: Existing Project with Config
```bash
# Config already exists - uses config values
arbiter generate --sync-github
# Output: 📁 Repository: mycompany/awesome-project (from configuration)
```

### Scenario 3: Config Conflicts with Git
```bash
# Config says owner: "old-org", Git says "new-org"
arbiter generate --sync-github --verbose
# Output: 
# ⚠️  Repository Configuration Conflict
# ┌─────────────────┬─────────────────────────────┐
# │ Source          │ Repository                  │
# ├─────────────────┼─────────────────────────────┤
# │ Config file     │ old-org/project             │
# │ Git remote      │ new-org/project             │
# └─────────────────┴─────────────────────────────┘
```

### Scenario 4: Non-Interactive CI/CD
```bash
# Use Git remote in automated environments
arbiter generate --sync-github --use-git-remote

# Or use config in environments with custom configurations
arbiter generate --sync-github --use-config
```

## 🔍 Implementation Details

### Git URL Parsing
Supports both HTTPS and SSH formats:
- `https://github.com/owner/repo.git` → `owner/repo`
- `git@github.com:owner/repo.git` → `owner/repo`
- `https://github.com/owner/repo` → `owner/repo`
- `git@github.com:owner/repo` → `owner/repo`

### Smart Configuration Logic
1. **Git Detection**: Try to read `git remote get-url origin`
2. **Parse URL**: Extract owner/repo from GitHub URLs
3. **Config Merge**: Compare with existing configuration
4. **Conflict Resolution**: Handle differences intelligently
5. **Validation**: Ensure final configuration is valid

### Validation Rules
- Owner and repo are required (from config or detection)
- Repository names shouldn't contain forward slashes
- Repository names shouldn't end with `.git`
- Base URLs must start with `https://`
- Helpful suggestions for common mistakes

## 🧪 Testing

The functionality includes comprehensive test coverage:
- URL parsing for various GitHub URL formats
- Conflict detection between config and Git remote
- Validation logic with error suggestions
- Smart configuration merging logic

Run tests:
```bash
cd packages/cli
bun test src/utils/__tests__/git-detection.test.ts
```

## 🎉 Benefits

1. **Zero Configuration**: Works immediately for typical GitHub projects
2. **Intelligent Conflict Resolution**: Handles edge cases gracefully
3. **Agent and CI/CD Friendly**: Non-interactive options for automation
4. **Backwards Compatible**: Existing configurations continue to work
5. **Developer Experience**: Follows principle of least surprise

## 🔮 Future Enhancements

Potential future improvements:
- Support for GitLab and other Git hosting services
- Multiple remote detection and selection
- Automatic token discovery from git credential helpers
- Integration with GitHub CLI (`gh`) for authentication

---

This implementation provides a robust, user-friendly solution that eliminates configuration friction while maintaining full flexibility for advanced use cases.