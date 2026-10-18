# dev-workflow

Skills for day-to-day development.

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
