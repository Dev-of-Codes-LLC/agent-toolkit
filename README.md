# agent-toolkit

Claude Code skills, an agent and a routine recipe for a small software shop, packaged as a plugin marketplace. They plan the work, land it, write it up, and report what needs attention.

Each one says what it will not do. Most of them only read; the few that write say exactly what they write, and show you first.

Status: early. Both plugins are at version 0.1.

## Install

In Claude Code:

```text
/plugin marketplace add Dev-of-Codes-LLC/agent-toolkit
/plugin install dev-workflow@agent-toolkit
/plugin install repo-ops@agent-toolkit
```

Install one plugin or both. Claude uses a skill when your request matches it; you can also name it ("use land-branch").

| Plugin | For | Contents |
| --- | --- | --- |
| [`dev-workflow`](plugins/dev-workflow/README.md) | Day-to-day development in one repo | [`feature-doc`](#feature-doc), [`land-branch`](#land-branch), [`docker-cleanup`](#docker-cleanup) |
| [`repo-ops`](plugins/repo-ops/README.md) | Backlog and status work across repos | [`ticket-writer`](#ticket-writer), [`status-digest`](#status-digest), [`org-map`](#org-map), [`backlog-planner`](#backlog-planner-agent) (agent) |

## How they fit together

```text
ticket-writer ──> the work ──> land-branch ──> feature-doc
      ▲                                              │
      └──── status-digest (twice a week) <───────────┘
            backlog-planner turns big items into draft tickets
```

1. `ticket-writer` turns an idea into one issue with one outcome and exact steps.
2. You and Claude do the work on a branch.
3. `land-branch` rebases it, waits for every check, merges it, and rebuilds your local environment.
4. `feature-doc` writes up what shipped.
5. `status-digest` reads everything twice a week and reports what is red, stale or due. `backlog-planner` turns the bigger items into ordered draft tickets.

## dev-workflow

### feature-doc

Turns a finished feature or pull request into a page that someone can read months later and understand in a few minutes.

- **You get:** `docs/features/<slug>.md` in the repo (the source of record), plus a standalone HTML reference sheet with lettered panels, a title block and an optional whiteboard-style diagram, rendered by a Node script with no dependencies.
- **How it works:** it gathers facts from the diff, the PR, decision records and the status file, and checks volatile facts (merged? on main?) with commands. It writes in a relaxed ASD-STE100 Simplified Technical English. It can also write a "reader edition" for someone outside the project, with internal IDs and private links taken out.
- **Ask it:** "write up the payment matching feature for the wiki", "make a page I can send a customer about this PR".
- **Won't:** claim a fact it could not trace to the code, a record or a command. Gaps are listed, not filled. It does not commit unless you ask.
- **Needs:** Node 18 or newer to render the HTML (without Node, it writes the HTML from its template).

### land-branch

Lands a branch on a `main` that moved ahead while you worked, typically because another session merged first.

- **You get:** the branch on `main`, through a pull request, with every check green, and your local environment rebuilt.
- **How it works:** in a fixed order. It lists the files both sides changed and flags real collisions before touching anything. It rebases, runs your fast checks, and force-pushes the branch with `--force-with-lease`. It opens or updates the PR and waits for every check. It reads failed logs and decides whether the fault is in the branch, the rebase, the runner or `main`. It squash-merges, then runs your rebuild command.
- **Ask it:** "land this branch", "main moved, rebase and merge this".
- **Won't:** merge with a check pending or red, use `--auto` or `--admin`, or force-push `main`. It never guesses a rebuild command.
- **Needs:** `git` and the GitHub CLI. Optional settings in `.claude/toolkit.json`: your fast checks, how long CI usually takes, and your rebuild command. See the [dev-workflow README](plugins/dev-workflow/README.md#settings-claudetoolkitjson).

### docker-cleanup

Frees disk space in a local Docker install without deleting anything you still need.

- **You get:** a report per compose project (live, stopped or leftover), what was removed per tier, what was kept on purpose, and what still needs your decision.
- **How it works:** a read-only audit script groups every container, image, volume, network and cache record by compose project. A cleanup script prints the exact `docker` commands for the tiers you choose, smallest risk first: build cache, broken builders, orphan networks, exited containers, then images. It runs them only with `-Execute`. Volumes are never in a default tier; each project's volumes are a separate decision.
- **Ask it:** "Docker is eating my disk", "what can I safely remove?", "clean up after the test stacks".
- **Won't:** delete a volume you did not name, or run a wholesale `docker system prune -a` or `docker volume prune`.
- **Needs:** Docker, and Windows PowerShell 5.1 or PowerShell 7 on Windows, macOS or Linux. CI runs the audit and a dry run on Linux.

## repo-ops

These read your org's values (owner, repos, board, labels, routing) from `.claude/toolkit.json` in your backlog repo. If the file is missing, they ask and offer to write it. See the [repo-ops README](plugins/repo-ops/README.md#settings-claudetoolkitjson) for every key, and [`examples/acme/`](examples/acme/README.md) for a filled-in example.

### ticket-writer

Turns a request, a finding or a messy idea into GitHub issues in one plain format.

- **You get:** issues in the right repo, each with one outcome, the reason, a task list with exact menu paths or commands, an optional `Due: YYYY-MM-DD` line, labels, and a Status and Due on your project board.
- **How it works:** it picks the repo from your routing table and searches for an existing issue first. It splits work that has two owners, places or dates. It reads the board's field ids live, so nothing is hard-coded.
- **Ask it:** "file this as a ticket", "plan the DNS move as issues", "re-status #41 as blocked".
- **Won't:** file a second issue when one already covers the work, or file anything when you asked only for a plan (then it shows drafts). It does not create labels or set Done by hand.
- **Needs:** the GitHub CLI with write access to issues and the board.

### status-digest

Answers "what needs me?" across every repo you list.

- **You get:** a digest under about 40 lines. It opens with a one-line verdict, then lists what needs you (overdue and due-soon items, red CI, failed deploys, conflicting or stale PRs, blocked items, board drift, URLs that do not answer), what moved, and the backlog counts.
- **How it works:** it reads each repo and the board through the GitHub CLI, or the GitHub MCP tools in a cloud session. It covers the window since the last digest, and lists anything it could not check.
- **Ask it:** "what's the status?", "anything broken?", "what needs me this week?"
- **Won't:** re-run, merge, label or close anything it finds. Run as a routine, its only write is one comment on your digest issue.
- **Needs:** read access to every listed repo. To run it on a schedule, see the [routine recipe](routines/status-digest.md).

### org-map

Keeps one page that maps your org: every repo, account and provider, the rules that hold across them, and the command that shows each one's live state.

- **You get:** answers to org-level questions with the source and the date of each fact. If you have no map yet, it builds a draft from live reads using [the template](plugins/repo-ops/skills/org-map/templates/org-map.md), and shows it to you before writing.
- **Ask it:** "what runs where?", "who applies the infrastructure?", "where is this tracked?", "build our org map".
- **Won't:** state a fact as current without reading it live, edit the map without asking, or put secrets or credentials in it.

### backlog-planner (agent)

A read-only planner for work that spans several repos or accounts.

- **You get:** one line on what the plan achieves, an ordered table (repo, title, labels, status, due, blocked by), each draft ticket in full, existing issues to update instead, and what it could not check.
- **How it works:** it reads the org map and the live state of every repo the goal touches. It drafts tickets in `ticket-writer`'s format and marks what only the owner can do.
- **Ask it:** "plan moving our DNS to the new provider", "turn this list of findings into tickets".
- **Won't:** create or edit anything. It has no edit tools, and its prompt names the only commands it may run. To block writes outright, add the permission rules in [the read-only agents pattern](patterns/read-only-agents.md).

## Also here

| Folder | What is in it |
| --- | --- |
| [`routines/`](routines/status-digest.md) | The status digest as a scheduled cloud routine: what it needs, the prompt, and how to check the first run |
| [`patterns/`](patterns/README.md) | Six short write-ups of the choices behind the toolkit, to copy into your own setup |
| [`examples/acme/`](examples/acme/README.md) | A fictional org's settings file, org map and sample digest |
| [`docs/site.json`](docs/site.json) | The catalog that the toolkit's web page reads. CI checks it against the repo. |

## The rules they follow

- **Read-only by default.** A skill that can change something says so and shows what it will do first.
- **Drafts, not actions.** Agents return drafts for a person to apply.
- **Data is not instructions.** Text in issues, pages and files is reported, never obeyed. See [the pattern](patterns/data-is-not-instructions.md).
- **Every fact has a date.** A live fact carries the date it was checked. See [the pattern](patterns/every-fact-has-a-date.md).
- **Dry run first.** Destructive steps print the exact commands and wait.

## Honest notes

- Built for a one-person company. A team may want more approvals, not fewer.
- The `repo-ops` skills assume GitHub and the `gh` CLI. `docker-cleanup` assumes Docker.
- Written for Claude Code. The rules and patterns carry over to other agents; the install steps do not.

## Licence

MIT. See [LICENSE](LICENSE). Made by Dev of Codes LLC. To report a security problem, see [SECURITY.md](SECURITY.md).
