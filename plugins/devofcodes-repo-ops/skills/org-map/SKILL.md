---
name: org-map
description: Answer organization-level questions from the org's own map - every repo, account and provider, the rules that hold across them, and the command that shows each one's live state - and build that map when it does not exist yet. Use for "what runs where", "who applies the infrastructure", "where is this tracked", "what is open across the org", and before you plan work that spans repos or accounts.
---

# Org map

The map is one Markdown file that the organization writes and keeps: its
repos, its providers, the rules that hold everywhere, and where work is
tracked. Each row names the command that shows its live state. This skill
reads the map, checks it against live state, and helps write it.

The map is a map, not a snapshot. Before you state a fact as current, read it
live with the command in the row's "Live state" column. Say the date you
checked it.

## 0. Find the map

Read `.claude/toolkit.json` at the root of the current repository. If it is
not there, ask which repository holds it and read it from GitHub:

```bash
gh api -H "Accept: application/vnd.github.raw+json" repos/<owner>/<repo>/contents/.claude/toolkit.json
```

`orgMap` is the map's path, relative to the repository that holds
`toolkit.json` (for example `docs/org-map.md` in the backlog repo). Read it the
same way when it is in another repository.

If there is no map, go to "Build the map" below.

## How to answer an org question

1. Find the rows of the map that the question touches.
2. Read their live state: `gh` for GitHub. For a cloud provider, use a
   connected MCP server if there is one; otherwise give the owner the exact
   read-only command to run. Say plainly what nothing here can read (a
   registrar, a bank, an admin console without an API).
3. Answer with the source and the date of each fact. List what you could not
   check.

Keep every answer honest about the organization's size and stage. Do not imply
users, customers, a team or traction that the map does not state.

When the live state disagrees with the map, say so, and offer the one-line
change to the map. Do not edit the map without asking.

## Build the map

Use `templates/org-map.md` next to this file. Fill it from live reads, never
from memory:

```bash
gh repo list <org> --limit 200 --json name,visibility,description,isArchived
gh api repos/<org>/<repo>/contents/README.md -H "Accept: application/vnd.github.raw+json"
gh project list --owner <org>
gh workflow list -R <org>/<repo>
```

- One row per repository, with its visibility, what it is in one line, and its
  live-state command.
- Providers (hosting, DNS, the domain registrar, mail, CI) only where a repo,
  a README or the owner names them. Leave a cell as "ask the owner" rather than
  guess.
- The rules section holds what only the owner does (applies, production
  merges, admin-console clicks). Ask the owner for these; they are rarely
  written anywhere a command can read.
- Write the date you checked at the top.

Show the draft to the owner. Write it to the `orgMap` path only after they say
yes, and add `orgMap` to `toolkit.json` if it is missing.

`examples/acme-org-map.md` is a filled-in map for a fictional company, Acme
Labs. Use it to see the level of detail, not as data.

## Rules for the map itself

- Every row that can go stale has a "Live state" command or link.
- Every fact that came from a live read carries the date it was checked.
- No secrets, tokens, passwords or account recovery details. A map may name an
  account; it never holds its credentials.
- If the map lives in a public repository, keep account IDs, internal hostnames
  and personal contact details out of it.
