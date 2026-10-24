---
name: land-branch
description: "Land a feature branch on a main that moved ahead: assess the divergence, rebase, open or update the PR, wait for every check to pass, squash-merge, then run the project's own rebuild step if it has one. Covers failing checks, stuck checks, merge refusals and a failed rebuild. Use when asked to land, merge or ship a branch, especially after another session merged work first."
---

# Land a branch on main

Use this when a branch needs to land on a `main` that has moved ahead, often
because another session merged work first, and the local environment may need
a rebuild afterwards.

The order is fixed: **assess → rebase → PR and checks → merge → rebuild**.
Never start the rebuild while the merge is unresolved. Never merge while a
check is pending or failing.

## 0. Read the project's settings

Look for `.claude/toolkit.json` at the repository root. This skill reads its
`landBranch` object:

```json
{
  "landBranch": {
    "fastChecks": ["npm run lint", "npm test"],
    "checkMinutes": 6,
    "rebuild": "./scripts/update.ps1 -Label pre-{label}"
  }
}
```

| Key | Meaning | When missing |
| --- | --- | --- |
| `fastChecks` | Commands to run locally after a rebase, before you push | Ask the user, or say that no local check ran |
| `checkMinutes` | How long the slowest CI job usually takes | Use 10 |
| `rebuild` | The project's own command that rebuilds the local environment after a merge; `{label}` is replaced with a short name for what landed | Skip step 5 and say so |

If the file is missing, ask for these three values once, and offer to write
the file. Never guess a rebuild command.

**Why the checks matter.** On a repository without branch protection or
required checks (common on private repositories on free plans),
`gh pr merge --auto` merges at once. Then this session is the only gate.
Never pass `--auto` or `--admin`, and never merge locally to get past a check.

## 1. Assess the divergence first

Report what changed before you move anything.

```bash
git fetch origin
git log --oneline HEAD..origin/main    # what landed on main since branching
git log --oneline origin/main..HEAD    # my commits

base=$(git merge-base HEAD origin/main)
comm -12 <(git diff --name-only "$base" HEAD | sort) \
         <(git diff --name-only "$base" origin/main | sort)   # overlapping files
```

The same overlap in PowerShell:

```powershell
$base   = git merge-base HEAD origin/main
$mine   = git diff --name-only $base HEAD
$theirs = git diff --name-only $base origin/main
Compare-Object $mine $theirs -IncludeEqual -ExcludeDifferent |
  Select-Object -ExpandProperty InputObject
```

The overlap list is where conflicts will land. Read those files on both sides
before you rebase. Knowing *what* the other work did (a styling refactor, a
renamed component, a new migration) is what makes the conflict resolution
correct rather than mechanical.

Tell the user the overlap list, and anything that looks like a real semantic
collision, before you continue. Examples: the same function rewritten on both
sides, two migrations that claim the same parent revision, both sides adding a
section at the same place in a status file.

## 2. Rebase the branch onto main

```bash
git status --porcelain     # must be empty: commit or stash first
git worktree list          # confirm the branch is checked out only here
git rebase origin/main
```

On a conflict: resolve it, `git add <file>`, `git rebase --continue`. Use
`git rebase --abort` to back out cleanly. Never `git rebase --skip`: it
silently drops a commit.

When you resolve, keep the incoming structure from `main` and re-apply this
branch's intent on top of it. Overwriting a file wholesale with the branch's
version undoes the other session's merged work. That is the main failure mode
here. If two migrations revise the same head, renumber this branch's migration
to follow main's new head, and move any head assertions in the tests with it.

Check the result:

```bash
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

The commit count must match the count before the rebase. Run the `fastChecks`
before you push. A rebase can compile and still break a test.

Push the rebased branch. A rebase rewrites history, so this is the one place
where a force push is expected: of this branch only, never of `main`.

```bash
git push --force-with-lease origin <branch>
```

`--force-with-lease` refuses if someone else pushed to the branch meanwhile.
Then fetch, look, and rebase again. Do not force over it.

## 3. Open or update the pull request, and wait for the checks

Changes land through a pull request. If none exists, open one
(`gh pr create --base main --head <branch>` with a clear title and body). If
one exists, the push in step 2 updated it and restarted the checks.

Then wait until every job has finished:

```bash
gh pr checks <n> --watch --interval 30
```

Read the final table, not the exit code. Every row must say `pass`, or
`skipped` for a job the workflow skips by design. If your client shows the
PR's check state (a PR status bar, for example), that is an acceptable
substitute for the watch. Go to step 4 only when nothing is `pending` or
`fail`.

### When a check fails

Report the failing job by name and stop the merge. Then, unless the user says
otherwise:

1. Read the failure, not the summary:

   ```bash
   gh run view <run id> --log-failed | tail -n 80
   ```

   The run id is in the check's URL in the table.
2. Decide which of these it is, and say which:
   - **The branch is wrong** (a test or lint failure your change caused): fix
     it on the branch, run the same check locally, commit, push, and go back
     to the start of step 3.
   - **The rebase broke something main relied on** (a stale assertion, a
     renamed symbol): the same treatment. The fix belongs on the branch,
     never on `main`.
   - **The runner or a dependency failed** (network, a registry pull, a
     timeout in job setup, nothing in the diff near the failure): re-run that
     job once with `gh run rerun <run id> --failed`, then watch again. If it
     fails the same way twice, treat it as real and stop.
   - **A check that main itself fails** (the same job is red on main's latest
     run: `gh run list --branch main --limit 3`): report it. The fix is a
     separate change on its own branch, and this merge waits.
3. Never bypass: no `--admin`, no `--auto`, no local `git merge` plus push, no
   edit to the workflow to skip the job. Accepting a red check is the user's
   explicit call, recorded in the PR with a comment that says why.

### When a check never finishes

A job that stays `pending` much longer than `checkMinutes` is stuck, not slow.
Check `gh run view <run id>`. A run that shows `queued` with no runner has hit
the account's Actions limits or an outage. Run `gh run cancel <run id>`, then
`gh run rerun <run id>`. If it still does not start, report it and stop. Do
not merge on the assumption that it would have passed.

## 4. Merge

With every check green:

```bash
gh pr merge <n> --squash --delete-branch
```

Then confirm on GitHub. Do not trust the exit code:

```bash
gh pr view <n> --json state,mergeCommit --jq '"\(.state) \(.mergeCommit.oid)"'
```

### Merge refusals and quirks

- **`not mergeable: the merge commit cannot be cleanly created`**, or the PR
  shows `CONFLICTING`: `main` moved again while the checks ran. Run
  `git fetch origin`, go back to step 2, rebase, push, and wait for the checks
  again. Do not fall back to a merge commit.
- **`Pull request is in unstable status`** with all checks green: GitHub's
  cache lags behind the last job. Read `gh pr checks <n>` again. If all pass,
  retry the merge once.
- **From a worktree, the merge succeeds but the command exits 1 with
  `fatal: 'main' is already used by worktree`**, and it skips the remote
  branch delete: the merge happened. Confirm with the `gh pr view` line above,
  then `git push origin --delete <branch>`.
- **Merged the wrong thing, or too early:** do not force-push `main`. Use
  `gh pr revert <n>`, or `git revert -m 1 <merge sha>` on a branch and a new
  PR.

After the merge, bring the local `main` forward without a merge commit:

```bash
git fetch origin
git switch main                 # in a worktree that cannot check out main, skip
git merge --ff-only origin/main # these two and run the rebuild from the main checkout
```

If `--ff-only` refuses, the local `main` has commits that GitHub does not.
Stop, and show the user `git log origin/main..main` before you touch anything.

### Fallback without a pull request

Only when the user explicitly asks to land locally without a PR (a repository
with no CI, or an emergency they accept): `git switch main`, then
`git merge --ff-only <branch>`. If that refuses, rebase again. Say plainly
that no check ran.

## 5. Rebuild the local environment

Only if `landBranch.rebuild` is set. Replace `{label}` with a short name for
what landed (`pre-payment-matching`), using only letters, digits, `.`, `_`
and `-`.

- Run the command exactly as configured. Do not re-implement its steps by
  hand, and do not rewrite the script unless the user asks.
- Run it where it can work: the machine that hosts the repository, from the
  main checkout on `main`. A rebuild from a worktree with the wrong
  environment file can point services at the wrong database.
- If the shell in this session cannot reach the tools the command needs
  (Docker, for example), give the user the exact command. Do not improvise an
  equivalent.

### When the rebuild fails

Read the project's own documentation for its rebuild script first. These
rules hold for any of them:

- **A build step fails:** nothing is lost. Fix it and run the command again.
- **A data migration fails:** if the script left services stopped, that is on
  purpose. Do not start them against a half-migrated database. Fix the
  migration and run again, or restore the backup the script wrote, following
  the project's restore steps.
- **Services start but stay unhealthy:** read the service's recent logs
  (`docker compose logs <service> --tail 50`, for example). The error usually
  names the missing setting or the migration that did not finish.

A rebase that went wrong is recoverable too: `git reflog`, then
`git reset --hard <pre-rebase sha>`.

## Report back

End with:

- what landed on `main` since branching;
- which files overlapped, and how you resolved each conflict;
- the PR number and the final check table (every job and its result,
  including any re-run and why);
- the merge commit;
- what the rebuild did (the backup it wrote, the final service state), or that
  no rebuild is configured.

Flag anything you resolved by judgment, so the user can check it. If a check
failed and the merge did not happen, say so first, with the failing job and
what it needs.
