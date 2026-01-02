# Cursor Rules Documentation

This directory contains Cursor IDE rules that help automate and standardize development workflows.

## GitHub Workflow Rules (`github.mdc`)

The GitHub workflow rules define an automated push workflow that ensures safe, structured code contributions through branch creation and pull request automation.

### Overview

When you say **"push"** or anything similar to Cursor, it will automatically:

1. **Create a new git branch** with a descriptive name
2. **Stage, commit, and push** all local changes
3. **Create a Pull Request** to the `dev` branch
4. **Report the PR link** back to you

### Branch Naming Convention

Branches are automatically generated using kebab-case with descriptive prefixes:

- `feature/<short-description>` - For new features
- `fix/<short-description>` - For bug fixes  
- `chore/<short-description>` - For maintenance tasks

Examples:
- `feature/add-user-authentication`
- `fix/payment-gateway-timeout`
- `chore/update-dependencies`

### Workflow Steps

#### 1. Branch Creation
- Automatically generates a clean, descriptive branch name based on context
- Uses kebab-case formatting (no spaces)
- Never reuses old branches - always creates a fresh one

#### 2. Commit & Push
- Stages all local changes
- Creates a clear, contextual commit message based on changes
- Pushes the branch to remote

#### 3. Pull Request Creation
Uses GitHub CLI to create a PR with:
- **Title**: Summary of what changed
- **Body**: Detailed description of modifications
- **Base branch**: `dev` (never `main`)
- **Head branch**: The auto-generated branch name

#### 4. PR Reporting
- Returns the new PR link for easy access

### Safety Rules

The workflow enforces several safety practices:

- ✅ Never commits directly to `dev` or `main`
- ✅ Never reuses old branches
- ✅ Always creates fresh branches based on task context
- ✅ Ensures branch names are descriptive and contextual
- ✅ Summarizes multiple logical changes concisely in PRs

### Example Usage

Simply tell Cursor:
- "push"
- "push these changes"
- "create a PR"
- "push to dev"

And it will handle the entire workflow automatically!

### Technical Implementation

The PR is created using GitHub CLI with the following command structure:

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

### Benefits

- **Consistency**: Ensures all PRs follow the same structure
- **Safety**: Prevents accidental commits to protected branches
- **Efficiency**: Automates repetitive git workflow tasks
- **Clarity**: Generates descriptive branch names and commit messages
- **Traceability**: Creates proper PR documentation for code reviews
