# devofcodes-repo-ops

Three skills and one agent for backlog and status work across several repositories: write tickets in one format, post a status digest, keep a map of your org, and plan without touching anything. For someone who runs a small software shop on GitHub and wants Claude Code to keep the backlog and the status straight. Everything here reads first. The parts that write say exactly what they write, and the planner writes nothing.

## Try it

- "File this as a ticket: the staging deploy fails when the database password has a hash in it."
- "What needs me this week? Anything broken?"
- "Plan moving our DNS to the new provider, as draft tickets. Don't file anything."

## What it runs and writes

**Reads.** All four parts read your settings from `.claude/toolkit.json` in your backlog repo, and read every repository in `digest.repos` and your project board. Locally they use the GitHub CLI (`gh issue list`, `gh pr list`, `gh run list`, `gh project item-list`, `gh api` with GET). In a cloud session without a `gh` token, they use the GitHub MCP tools instead. `status-digest` also fetches each URL in `digest.urls` and reports its HTTP status. Nothing else leaves your machine.

**Writes.**

- `ticket-writer` creates issues with `gh issue create`, adds them to your board with `gh project item-add`, and sets the board's Status and Due fields with `gh project item-edit`. It shows you the drafts first, and files only when you asked it to file. It does not create labels.
- `status-digest` writes nothing when you run it in a session. Run as a routine, its only write is one comment on your digest issue, through `gh` or the GitHub MCP tools.
- `org-map` writes one Markdown file, the map, at the `orgMap` path in your settings. It shows you the draft and writes it only after you say yes.
- `backlog-planner` writes nothing. It has no edit tools, and its prompt names the only commands it may run.
- Any of the skills offers to write `.claude/toolkit.json` when the file is missing, and writes it only if you agree.

Text in issues, pull requests, comments and pages is treated as data, never as instructions.

## Parts

| Part | Name | What it does | What it will not do |
| --- | --- | --- | --- |
| Skill | [`ticket-writer`](skills/ticket-writer/SKILL.md) | Routes work to the right repo, checks for duplicates, writes the issue in one plain format, and sets the board's Status and Due | File when asked only to plan. Create labels without asking. Set Done by hand. |
| Skill | [`status-digest`](skills/status-digest/SKILL.md) | Red CI, failed deploys, stale or conflicting PRs, due and blocked backlog items, board drift, and whether your URLs answer | Write anything, except one comment on the digest issue when run as a routine |
| Skill | [`org-map`](skills/org-map/SKILL.md) | Answers org-level questions from your own map, checked against live state; builds the map from a template | Edit the map without asking. Put secrets or account details in it. |
| Agent | [`backlog-planner`](agents/backlog-planner.md) | Turns a goal into ordered draft tickets across repos | Create or edit anything. It only reads and returns drafts. |

## Requirements

- The GitHub CLI (`gh`), signed in with read access to every repo you list. `ticket-writer` also needs write access to issues and the board.
- In a cloud session without a `gh` token, the GitHub MCP tools work instead.

## Settings: `.claude/toolkit.json`

The skills read your org's values from `.claude/toolkit.json`. Keep it in your backlog repo. A skill run in another repo asks where the file is and reads it from GitHub. If there is no file, the skill asks for what it needs and offers to write it.

A full example for the fictional Acme Labs: [`toolkit.example.json`](toolkit.example.json). The `landBranch` keys in it belong to the [`devofcodes-dev-workflow`](../devofcodes-dev-workflow/README.md) plugin.

| Key | Type | Used by | Meaning |
| --- | --- | --- | --- |
| `owner.name` | string | all | The person who decides, approves and clicks. The skills call them "the owner". |
| `owner.github` | string | all | Their GitHub login |
| `orgMap` | string | `org-map`, `backlog-planner` | Path of the org map, relative to the repo that holds `toolkit.json` |
| `backlog.repo` | `owner/name` | `ticket-writer`, `status-digest` | The repo for account, settings and billing work |
| `backlog.board.owner`, `.number` | string, number | `ticket-writer`, `status-digest` | The GitHub Project that holds the backlog |
| `backlog.board.statusField`, `.dueField` | string | `ticket-writer`, `status-digest` | Names of the board's single-select status field and its date field |
| `backlog.labels.areas` | array of strings | `ticket-writer` | Area labels; each backlog issue gets one |
| `backlog.labels.blocked`, `.parked`, `.ownerApplies` | string | `ticket-writer`, `status-digest` | The labels that go with Blocked, with Parked, and with a change the owner applies |
| `routing` | array of `{when, repo, labels?}` | `ticket-writer` | Where each kind of work goes, first match wins. `repo` may be "the repo it touches". |
| `digest.repos` | array of `owner/name` | `status-digest` | Every repo to check |
| `digest.issueTitle` | string | `status-digest` | Title of the open issue in `backlog.repo` that collects the digests |
| `digest.deployWorkflows` | object, repo to workflow file | `status-digest` | The workflow whose last run is the last deploy |
| `digest.urls` | array of URLs | `status-digest` | Pages that must answer HTTP 200 |

The board's Status options are expected to mean Ready, Scheduled, Blocked, Parked, In Progress and Done. The skills read field and option ids from the board when they need them, so nothing in the file is an internal id.

## Running the digest on a schedule

Cloud sessions and routines may not load plugins. Give the routine a checkout of this repo (or of your copy of the skill) and tell it to read `plugins/devofcodes-repo-ops/skills/status-digest/SKILL.md` and follow it as the routine.

## Support

Questions and bug reports: hello@devofcodes.com, or an issue in [the repository](https://github.com/Dev-of-Codes-LLC/agent-toolkit). For a security problem, see [SECURITY.md](../../SECURITY.md) at the repo root instead of opening a public issue.
