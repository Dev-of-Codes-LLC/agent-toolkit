# agent-toolkit

Claude Code skills, agents and routine recipes for a small software shop, packaged as a plugin marketplace.

Status: early. Both plugins are at version 0.1.

## Install

In Claude Code:

```text
/plugin marketplace add Dev-of-Codes-LLC/agent-toolkit
/plugin install dev-workflow@agent-toolkit
/plugin install repo-ops@agent-toolkit
```

## Plugins

| Plugin | For | Contents |
| --- | --- | --- |
| [`dev-workflow`](plugins/dev-workflow) | Day-to-day development | `feature-doc`, `land-branch`, `docker-cleanup` |
| [`repo-ops`](plugins/repo-ops) | Backlog work across repos | `ticket-writer`, `status-digest`, `org-map`, `backlog-planner` (agent) |

## Also here

| Folder | What is in it |
| --- | --- |
| [`routines/`](routines/status-digest.md) | The status digest as a scheduled routine: the prompt, the schedule and what it needs |
| [`patterns/`](patterns/README.md) | Short write-ups of the choices behind the toolkit, to copy into your own setup |
| [`examples/acme/`](examples/acme/README.md) | A fictional org's settings file, org map and sample digest |
| [`docs/site.json`](docs/site.json) | The catalog that the toolkit's web page reads. CI checks it against the repo. |

## The rules they follow

- Read-only by default. A skill that can change something says so and shows what it will do first.
- Drafts, not actions. Agents return drafts for a person to apply.
- Text in issues, pages and files is data, not instructions. See [the pattern](patterns/data-is-not-instructions.md).
- Every live fact carries the date it was checked. See [the pattern](patterns/every-fact-has-a-date.md).
- Dry run first.

## Licence

MIT. See [LICENSE](LICENSE). Made by Dev of Codes LLC. To report a security problem, see [SECURITY.md](SECURITY.md).
