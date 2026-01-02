# GitHub Workflow Rules Implementation Guide

## Overview

The `.cursor/rules/github.mdc` file defines automated workflow rules for Cursor IDE that streamline the git push and pull request creation process. This document provides a comprehensive explanation of the implementation, its purpose, and how it works.

## File Location

**Path**: `.cursor/rules/github.mdc`

**Type**: Cursor Rules File (Markdown with frontmatter)

**Status**: Active (alwaysApply: false - applied on-demand)

## File Structure

```yaml
---
alwaysApply: false
---
```

The file uses YAML frontmatter to configure when the rules are applied:
- `alwaysApply: false` - Rules are applied only when explicitly triggered (e.g., when user says "push")

## Core Functionality

### 1. Automated Branch Creation

**Trigger**: When user says "push" or similar commands

**Behavior**:
- Automatically generates a descriptive branch name based on context
- Uses semantic prefixes: `feature/`, `fix/`, `chore/`
- Enforces kebab-case formatting (no spaces, hyphens for word separation)
- Never reuses existing branches - always creates fresh ones

**Examples**:
- `feature/add-user-authentication`
- `fix/payment-gateway-timeout`
- `chore/update-dependencies`

### 2. Automated Commit & Push

**Process**:
1. Stages all local changes automatically
2. Generates contextual commit message based on changes
3. Pushes branch to remote repository

**Commit Message Generation**:
- Analyzes changes in working directory
- Creates clear, descriptive commit message
- Follows conventional commit format when possible

### 3. Automated Pull Request Creation

**Method**: Uses GitHub CLI (`gh`) API

**Command Structure**:
```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/:owner/:repo/pulls \
  -f title="$PR_TITLE" \
  -f head="$BRANCH_NAME" \
  -f base="dev" \
  -f body="$PR_BODY"
```

**Parameters**:
- `title`: Summary of changes (auto-generated from context)
- `head`: The newly created branch name
- `base`: Always `dev` (never `main`)
- `body`: Detailed description of modifications

### 4. PR Link Reporting

After PR creation, the workflow returns the PR URL to the user for easy access.

## Safety Mechanisms

The workflow enforces several safety rules:

### Protected Branch Rules
- ✅ **Never commits directly to `dev`** - Always creates a branch first
- ✅ **Never commits directly to `main`** - Always creates a branch first
- ✅ **Always targets `dev` as base** - Ensures proper code review flow

### Branch Management Rules
- ✅ **Never reuses old branches** - Always creates fresh branches
- ✅ **Context-based naming** - Branch names reflect the actual work
- ✅ **Consistent formatting** - Enforces kebab-case for all branches

### PR Quality Rules
- ✅ **Descriptive titles** - Auto-generated from change context
- ✅ **Detailed descriptions** - Includes modification details
- ✅ **Concise summaries** - Multiple changes are summarized clearly

## Workflow Execution Flow

```
User Command: "push"
    ↓
1. Analyze current changes
    ↓
2. Generate branch name (feature/fix/chore + description)
    ↓
3. Create and checkout new branch
    ↓
4. Stage all changes
    ↓
5. Generate commit message
    ↓
6. Commit changes
    ↓
7. Push branch to remote
    ↓
8. Generate PR title and body
    ↓
9. Create PR via GitHub CLI
    ↓
10. Return PR link to user
```

## Integration with Cursor IDE

### How Cursor Uses These Rules

1. **Rule Detection**: Cursor reads `.cursor/rules/*.mdc` files
2. **Context Analysis**: Analyzes current working directory changes
3. **Rule Application**: Applies rules when user triggers "push" command
4. **Automation**: Executes git and GitHub CLI commands automatically

### Benefits

- **Consistency**: All PRs follow the same structure
- **Safety**: Prevents accidental commits to protected branches
- **Efficiency**: Reduces manual git workflow steps
- **Clarity**: Generates descriptive branch names and commit messages
- **Traceability**: Creates proper PR documentation for code reviews

## Technical Requirements

### Prerequisites

1. **Git**: Must be installed and configured
2. **GitHub CLI**: Must be installed (`gh` command)
3. **GitHub Authentication**: `gh auth login` must be completed
4. **Repository Access**: User must have push access to the repository

### GitHub CLI Setup

```bash
# Install GitHub CLI (macOS)
brew install gh

# Authenticate
gh auth login

# Verify installation
gh --version
```

## Use Cases

### Feature Development
```
User: "push"
→ Creates: feature/add-shopping-cart
→ PR: "feat: Add shopping cart functionality"
```

### Bug Fixes
```
User: "push"
→ Creates: fix/payment-timeout-error
→ PR: "fix: Resolve payment gateway timeout issue"
```

### Maintenance Tasks
```
User: "push"
→ Creates: chore/update-dependencies
→ PR: "chore: Update npm dependencies to latest versions"
```

## Comparison with Manual Workflow

### Manual Workflow (Before)
1. Create branch manually: `git checkout -b feature/my-feature`
2. Stage changes: `git add .`
3. Commit: `git commit -m "Add feature"`
4. Push: `git push origin feature/my-feature`
5. Open browser, navigate to GitHub
6. Click "New Pull Request"
7. Fill in title and description
8. Select base branch
9. Submit PR

**Time**: ~5-10 minutes

### Automated Workflow (After)
1. Say: "push"
2. Wait for automation

**Time**: ~30 seconds

## Error Handling

The workflow should handle:
- **No changes**: Skip commit if working directory is clean
- **Authentication errors**: Prompt user to authenticate GitHub CLI
- **Branch conflicts**: Handle naming conflicts gracefully
- **Network issues**: Retry push/PR creation on failure
- **Invalid repository**: Verify repository access before proceeding

## Future Enhancements

Potential improvements:
- Support for draft PRs
- Automatic label assignment
- Reviewer assignment
- Milestone linking
- Issue linking from commit messages
- Custom PR templates
- Multi-branch support
- Merge strategy configuration

## Related Files

- `.cursor/rules/README.md` - General Cursor rules documentation
- `.cursor/rules/turborepo.mdc` - Turborepo-specific rules
- `ROADMAP.md` - Project roadmap (references GitHub issues)

## History

**Created**: November 26, 2025 (Commit: 85d4452)
**Author**: Sarwagya Singh
**Context**: Part of development roadmap implementation

## References

- [Cursor Rules Documentation](https://cursor.sh/docs)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)
