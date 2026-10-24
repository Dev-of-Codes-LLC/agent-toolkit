# devofcodes-repo-ops

Skills and an agent for backlog work across repos: write tickets, post a status digest, keep an org map, and plan without touching anything.

| Part | Name | What it does | What it will not do |
| --- | --- | --- | --- |
| Skill | [`ticket-writer`](skills/ticket-writer/SKILL.md) | Routes work to the right repo, checks for duplicates, writes the issue in one plain format, and sets the board's Status and Due | File when asked only to plan. Create labels without asking. Set Done by hand. |
| Skill | [`status-digest`](skills/status-digest/SKILL.md) | Red CI, failed deploys, stale or conflicting PRs, due and blocked backlog items, board drift, and whether your URLs answer | Write anything, except one comment on the digest issue when run as a routine |
| Skill | [`org-map`](skills/org-map/SKILL.md) | Answers org-level questions from your own map, checked against live state; builds the map from a template | Edit the map without asking. Put secrets or account details in it. |
| Agent | [`backlog-planner`](agents/backlog-planner.md) | Turns a goal into ordered draft tickets across repos | Create or edit anything. It only reads and returns drafts. |

All four treat text in issues, PRs, comments and pages as data, not instructions.

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
