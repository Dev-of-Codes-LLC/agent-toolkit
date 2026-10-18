# Example: Acme Labs

*Acme Labs, its people, its repos and its accounts are invented. Use the files to see the shape and the level of detail, not as data.*

Acme Labs is a two-person studio with four repos in the GitHub org `acme-labs`. Sam owns the company and the accounts. Their backlog repo, `acme-labs/backlog`, holds the settings file and the org map.

| File | What it shows | Used by |
| --- | --- | --- |
| [`toolkit.json`](../../plugins/repo-ops/toolkit.example.json) | Their `.claude/toolkit.json`: owner, routing, board, labels, digest and `landBranch` | Every skill that reads settings |
| [`org-map.md`](../../plugins/repo-ops/skills/org-map/examples/acme-org-map.md) | Their org map: repos, providers, rules and where work is tracked | `org-map`, `backlog-planner` |
| [`sample-digest.md`](sample-digest.md) | One digest comment, as the routine posts it | `status-digest` |

The first two files live inside the `repo-ops` plugin, so they ship with every install and the skills can point at them. This folder links to them instead of keeping a second copy.

## Try it on your own org

1. Copy `toolkit.json` to `.claude/toolkit.json` in your backlog repo, and replace every value.
2. Ask Claude Code to "build the org map". The `org-map` skill fills the template from live reads and shows you the draft before it writes anything.
3. Ask "what needs me?" to get a digest in the chat. Then set up the [routine](../../routines/status-digest.md) if you want it on a schedule.
