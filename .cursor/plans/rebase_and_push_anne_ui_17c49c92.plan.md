---
name: Rebase and push anne/ui
overview: Commit the newly staged assets on `anne/ui` with the message you specified, rebase `anne/ui` onto the latest `origin/main`, then push the rebased branch to the remote.
todos:
  - id: commit-assets
    content: git commit -m "figure and chest.png added" (ensure all intended files are staged first)
    status: pending
  - id: fetch-rebase
    content: git fetch origin && git rebase origin/main; resolve conflicts if any
    status: pending
  - id: force-push
    content: git push --force-with-lease origin anne/ui
    status: pending
isProject: false
---

# Rebase `anne/ui` onto latest `origin/main` and push (new assets commit)

## Preconditions

- You are on branch **`anne/ui`**, or you will `git checkout anne/ui` first.
- **`git add .` is already done** for the new assets (e.g. [assets/chest.png](assets/chest.png) and any figure updates). If anything is still unstaged, run `git add` for those paths (or `git add .` again) before committing.

## Steps

1. **Commit** the staged work with your title:

   ```bash
   git commit -m "figure and chest.png added"
   ```

2. **Fetch and rebase** so `anne/ui` sits on top of the current remote `main`:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

   - If there are **conflicts**, fix files, `git add` them, then `git rebase --continue` until the rebase finishes, or `git rebase --abort` to go back.

3. **Push** the rebased branch. Because `anne/ui` was already on the remote and rebase rewrites history, a normal `git push` may be rejected. Use:

   ```bash
   git push --force-with-lease origin anne/ui
   ```

   You confirmed **no one else** updates `anne/ui` on the remote, so there is no risk of overwriting someone else’s work; `--force-with-lease` is still the right default (it also protects you if the remote were updated unexpectedly). If the push fails, run `git fetch origin` again and re-check `git status` / whether another client pushed the same branch.

## What this does (no local `main` change)

- `git fetch` updates `origin/main` to match the server; it does not merge into your current branch.
- `git rebase origin/main` moves your `anne/ui` commits (including the new *figure and chest.png* commit) on top of the latest remote `main` without changing your local `main` branch.
