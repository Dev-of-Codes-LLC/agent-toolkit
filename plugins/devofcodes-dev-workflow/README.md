# devofcodes-dev-workflow

Three skills for day-to-day development in one repository: write up a finished feature, land a branch on a `main` that moved ahead, and free Docker disk space without deleting anything you still need. For a developer who works with Claude Code in a git repository on GitHub, alone or in a small team. Each skill says what it will not do, and every step that changes something shows you first.

## Try it

- "Write up the payment matching feature as a page for the wiki."
- "Main moved while I worked. Rebase this branch, wait for the checks and merge it."
- "Docker is eating my disk. What can I safely remove?"

## What it runs and writes

**`feature-doc`** reads the diff, the pull request, decision records and the status file, and checks volatile facts with `git` and `gh` (for example whether the PR is merged and on `main`). It writes `docs/features/<slug>.md` and renders one HTML file next to it, `docs/features/<slug>.html`, with `scripts/render.mjs` (Node 18 or newer, no dependencies). If you ask for a reader edition, it also writes `docs/features/<slug>.reader.md` and renders that. It does not commit, push or fetch anything from the network.

**`land-branch`** changes your branch and your repository on GitHub, in a fixed order. It runs `git fetch`, lists the files both sides changed, and rebases the branch onto `origin/main`. It runs the fast checks from your settings, then force-pushes the branch with `git push --force-with-lease` (the branch only, never `main`). It opens or updates the pull request with `gh pr create`, waits for every check with `gh pr checks --watch`, and reads failed logs with `gh run view --log-failed`. It may re-run a failed job once with `gh run rerun`. It squash-merges with `gh pr merge --squash`, then runs the rebuild command from your settings. It never passes `--auto` or `--admin`, never merges with a check pending or red, and never guesses a rebuild command.

**`docker-cleanup`** runs two PowerShell scripts. `scripts/audit.ps1` is read-only: it groups every container, image, volume, network and build-cache record by compose project. `scripts/cleanup.ps1` re-runs the audit and prints the exact `docker` commands for the tiers you choose. It removes nothing unless you pass `-Execute`. Volumes are never in a default tier; it removes a volume only when you name it or its project. It never runs `docker system prune -a` or `docker volume prune`.

None of the three sends data anywhere. `land-branch` and `feature-doc` talk to GitHub only through your own `gh` login.

## Skills

| Skill | What it does | What it will not do |
| --- | --- | --- |
| [`feature-doc`](skills/feature-doc/SKILL.md) | Turns finished work into a feature page: Markdown in the repo, plus a standalone HTML reference sheet rendered by `scripts/render.mjs` (Node 18+, no dependencies). | Commit or push, unless you ask. Guess a fact it could check with a command. |
| [`land-branch`](skills/land-branch/SKILL.md) | Lands a branch on a `main` that moved ahead: assess, rebase, PR, wait for every check, squash-merge, then run your rebuild command. | Merge with a check pending or red. Use `--auto` or `--admin`. Force-push `main`. |
| [`docker-cleanup`](skills/docker-cleanup/SKILL.md) | Audits Docker by compose project and frees space tier by tier, dry run first. | Run `docker system prune -a` or `docker volume prune`. Remove a volume you did not name. |

## Requirements

- `feature-doc`: Node 18 or newer to render the HTML. Without Node, the skill writes the HTML from its template.
- `land-branch`: `git` and the GitHub CLI (`gh`).
- `docker-cleanup`: Docker, and Windows PowerShell 5.1 or PowerShell 7 (`pwsh`) on Windows, macOS or Linux. CI runs the audit and a dry run on Linux with `pwsh`.

## Settings: `.claude/toolkit.json`

`land-branch` reads one object from `.claude/toolkit.json` at the root of your repository. Everything is optional. If the file is missing, the skill asks and offers to write it.

```json
{
  "landBranch": {
    "fastChecks": ["npm run lint", "npm test"],
    "checkMinutes": 6,
    "rebuild": "./scripts/update.ps1 -Label pre-{label}"
  }
}
```

| Key | Type | Meaning |
| --- | --- | --- |
| `landBranch.fastChecks` | array of strings | Commands to run locally after a rebase, before the push |
| `landBranch.checkMinutes` | number | How long the slowest CI job usually takes; a job pending much longer counts as stuck. Default 10. |
| `landBranch.rebuild` | string | Your command to rebuild the local environment after a merge. `{label}` becomes a short name for what landed. Leave it out to skip the rebuild. |

## Support

Questions and bug reports: hello@devofcodes.com, or an issue in [the repository](https://github.com/Dev-of-Codes-LLC/agent-toolkit). For a security problem, see [SECURITY.md](../../SECURITY.md) at the repo root instead of opening a public issue.
