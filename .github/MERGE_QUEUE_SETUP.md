# Merge Queue Setup

This repository uses GitHub Actions workflows that implement a GitLab-style merged results pipeline with merge queue functionality.

## How It Works

### PR Quality Checks (Automatic)

When you push changes to a pull request, the `pr-checks.yml` workflow automatically runs quality checks on the **merged result** of your PR + the target branch (master). This ensures your changes work correctly when combined with the latest code.

**Workflow: `.github/workflows/pr-checks.yml`**

- **Trigger**: Automatically on PR creation, updates, and reopens
- **Tests**: Merged result (PR + master)
- **Checks**:
  - Linting
  - Library build
  - Demo app build
  - Unit tests
  - E2E tests

### Merge Queue (Manual Trigger)

When you're ready to merge, you can use GitHub's merge queue feature. This runs a **final verification** with the absolute latest version of the target branch before merging.

**Workflow: `.github/workflows/merge-queue.yml`**

- **Trigger**: When PR is added to merge queue
- **Tests**: Latest merged result (PR + current master)
- **Checks**: Same as PR checks (lint, builds, tests)

## Enabling Merge Queue

Merge queue must be enabled in your repository settings:

1. Go to **Settings** > **Code and automation** > **Branches**
2. Find your branch protection rule for `master` (or create one)
3. Enable **"Require merge queue"**
4. Configure merge queue settings:
   - **Merge method**: Choose your preferred method (squash, merge commit, or rebase)
   - **Build concurrency**: Number of PRs to build in parallel (default: 1)
   - **Minimum PRs to merge**: Number of PRs to batch together (default: 1)
   - **Maximum time to merge**: Maximum wait time before merging (default: 5 minutes)
   - **Status check timeout**: How long to wait for checks (default: 60 minutes)
5. Under **"Require status checks to pass before merging"**, add:
   - `quality-checks` (from merge-queue.yml)

## Using Merge Queue

### With Merge Queue Enabled

1. Create a PR and wait for `pr-checks.yml` to pass
2. Get required approvals
3. Click **"Merge when ready"** instead of **"Merge pull request"**
4. Your PR is added to the merge queue
5. `merge-queue.yml` runs with the latest master code
6. If checks pass, PR is automatically merged
7. If checks fail, PR is removed from queue and you can fix issues

### Without Merge Queue (Traditional)

If you prefer not to use merge queue:

1. Create a PR and wait for `pr-checks.yml` to pass
2. Get required approvals
3. Click **"Merge pull request"**
4. PR is merged immediately (without final re-verification)

## Workflow Comparison

| Feature                     | PR Checks          | Merge Queue        |
| --------------------------- | ------------------ | ------------------ |
| Trigger                     | Every PR push      | Manual merge       |
| Tests merged result         | ✅ Yes             | ✅ Yes             |
| Tests latest target branch  | ❌ At push time    | ✅ At merge time   |
| Prevents stale merges       | ❌ No              | ✅ Yes             |
| Automatic                   | ✅ Yes             | Manual opt-in      |
| Batches multiple PRs        | ❌ No              | ✅ Optional        |

## Benefits

- **No stale merges**: Merge queue ensures tests run against the absolute latest target branch code
- **Prevents race conditions**: Multiple PRs won't conflict when merging simultaneously
- **Batching**: Optionally test multiple PRs together to reduce CI time
- **GitLab-style workflow**: Similar to GitLab's merged results pipelines and merge trains

## Troubleshooting

### Merge queue not available

- Ensure you have admin access to enable branch protection rules
- Merge queue requires branch protection to be enabled

### Checks not running

- Verify the workflow file exists in `.github/workflows/`
- Check that the branch name matches (`master` in this case)
- Ensure the status check name matches what you added in branch protection

### Checks taking too long

- Adjust **"Status check timeout"** in merge queue settings
- Consider using job matrices to run tests in parallel
- Use `cancel-in-progress: true` to cancel outdated checks (already configured)
