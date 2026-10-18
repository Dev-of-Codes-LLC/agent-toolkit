---
name: ticket-writer
description: Turn a request, finding or idea into GitHub issues. Picks the right repo from a routing table, checks for duplicates, writes each issue in one plain format with labels and an optional Due line, puts it on the backlog board and sets its Status and Due there. Use when asked to plan, file, split, re-scope, re-status or ticket work.
---

# Write a ticket

## 0. Read the settings

The org's values live in `.claude/toolkit.json`. Look for it at the root of the
current repository. If it is not there, ask which repository holds it (usually
the backlog repo) and read it from GitHub:

```bash
gh api -H "Accept: application/vnd.github.raw+json" repos/<owner>/<repo>/contents/.claude/toolkit.json
```

This skill uses `owner`, `routing` and `backlog`. If there is no file, ask for
the backlog repo, the board, and where the main kinds of work go. Then offer
to write the file. A full example is `toolkit.example.json` in this plugin.

Below, **the owner** is `owner.name` in the settings: the person who decides,
approves and clicks.

## 1. Pick the repo

Go down `routing` and take the first row whose `when` fits the work. A row's
`labels` are added to the issue. A row whose `repo` is "the repo it touches"
means the issue goes in the code repository the change is in.

If a code change also needs the owner to click something outside the PR (an
admin console, a secret, a DNS record), file that click as a second issue in
the backlog repo, and link the two.

If no row fits, ask. Do not guess a repo.

## 2. Check for duplicates

```bash
gh issue list -R <owner/repo> --state all --search "<two or three keywords>"
```

If an issue already covers the work, update that issue or comment on it. Do not
file a second one.

## 3. Write the issue

- **Title:** the outcome, in the imperative, under 60 characters. Example:
  "Require 2FA for org members".
- **Body:** use the layout below. One outcome per issue. Split the work when it
  has two owners, two places or two dates.
- **Facts:** say how you know. Write "Checked 2026-10-10: ..." for anything you
  read live. Never present a guess as a fact.
- **Steps:** a task list. Each step names the exact menu path or command.
- **Order:** write "Do this after #N" when an issue depends on another.
- **Style:** short sentences, active voice, one idea per sentence.

```markdown
Due: YYYY-MM-DD

<One sentence: the outcome.>

<Why it matters, in one or two sentences. What you checked, with the date.>

- [ ] <Step, with the menu path or command>
- [ ] <Step>

Source: <link to the doc, PR, run or thread>
```

The `Due:` line is optional. Add it only when a date matters, such as a
renewal, a rollout gate or a review. Keep the exact format `Due: YYYY-MM-DD` on
its own line, because the `status-digest` skill reads it.

## 4. Label it (backlog repo only)

Use one label from `backlog.labels.areas`. Add these when they apply:

| Setting | Use for |
| --- | --- |
| `backlog.labels.ownerApplies` | Needs a change that the owner applies (an infrastructure apply, for example) |
| `backlog.labels.blocked` | Waits on an answer from the owner. Goes with the Blocked status. |
| `backlog.labels.parked` | Set aside on purpose. Goes with the Parked status. |

List the repo's labels with `gh label list -R <backlog repo>`. Do not create a
new label without asking the owner.

## 5. Pick the status (backlog repo only)

The board in `backlog.board` has a single-select Status field and a date Due
field (names in `statusField` and `dueField`). Status says what holds the item.
Labels say the area. Pick one status per issue:

| Status | Use when |
| --- | --- |
| Ready | Nothing blocks it. The default for a new item. |
| Scheduled | The issue has a `Due:` line and there is nothing to do before that date |
| Blocked | It waits on an answer or a decision from the owner. Add the blocked label too. |
| Parked | Set aside on purpose. Add the parked label too. |
| In Progress | Started, with some steps checked off |
| Done | The issue is closed. The board sets this itself. |

If the board uses other option names, map them to these meanings and say how
in your report.

Rules:

- Blocked goes with the blocked label, and Parked with the parked label. Set
  both. The label shows on the issue and is what a session without board
  access can read; the status drives the board.
- The Due field mirrors the `Due:` line. When you change one, change the other.
- A Scheduled item whose date comes within 7 days shows up in the status
  digest. Move it to Ready when you pick it up.
- Do not set Done by hand. Close the issue; the board moves it.

## 6. Confirm, then create

- If the owner asked you to *plan*, show the drafts first: title, repo,
  labels, status, due date. Create them only after the owner says yes.
- If the owner asked you to *file*, create them.

```bash
gh issue create -R <owner/repo> --title "<title>" --body-file <file> --label "<a>,<b>"
gh project item-add <board number> --owner <board owner> --url <issue url> --format json --jq .id
```

`item-add` puts the issue on the board and prints the item id. Issues in a
repository that keeps its own board go on that board, or on none; follow the
routing row.

To set Status and Due, read the board's ids once per session. Do not hard-code
them:

```bash
gh project view <board number> --owner <board owner> --format json --jq .id     # project id
gh project field-list <board number> --owner <board owner> --format json \
  --jq '.fields[] | {name, id, options: [.options[]? | {name, id}]}'           # field and option ids
```

Then:

```bash
gh project item-edit --project-id <project id> --id <item id> --field-id <status field id> --single-select-option-id <option id>
gh project item-edit --project-id <project id> --id <item id> --field-id <due field id> --date YYYY-MM-DD
```

To find the item id of an issue that is already on the board:

```bash
gh project item-list <board number> --owner <board owner> --limit 100 --format json \
  --jq '.items[] | select(.content.number == <n>) | .id'
```

## 7. Report

Give the owner one line per issue, with its link, its status and its due date.
Say why you set each date, and each status that is not Ready.
