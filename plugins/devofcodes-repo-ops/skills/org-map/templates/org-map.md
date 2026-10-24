# <Org name> org map

Checked: YYYY-MM-DD. This is a map, not a snapshot: read each row's live state before you state it as current.

<One or two sentences: what the organization is, how many people run it, and its stage. Be honest; no implied customers or traction.>

## Repos

| Repo | What it is | Live state |
| --- | --- | --- |
| `<org>/<repo>` (private) | <one line> | `gh pr list -R <org>/<repo>` |
| `<org>/<repo>` (public) | <one line. Say what a merge to main does, if it deploys.> | `gh run list -R <org>/<repo> --workflow <deploy>.yml` |

## Providers

| Job | Provider | Where to look |
| --- | --- | --- |
| Code, CI, backlog | <GitHub org, plan, seats> | <settings page or label> |
| Hosting | <provider, accounts or projects> | <infra repo, path> |
| DNS | <provider> | <infra repo, path> |
| Domain registration | <registrar, renewal date> | <backlog issue> |
| Mail | <provider, plan> | <backlog label> |

<Budget or spend limits, if any, and where they are enforced. Never claim a hard cap a provider does not have.>

## Rules that hold everywhere

- <Who applies infrastructure changes, and how. Agents write diffs and PRs; they never apply.>
- <What a merge to a production branch does, and who merges.>
- <Which admin-console clicks are the owner's. Agents prepare the exact steps and the menu path.>
- <Anything public text must not claim.>

## Where work is tracked

- Account and settings work: issues in `<org>/<backlog repo>`. Use the `ticket-writer` skill.
- Code work: issues and PRs in the repo it touches.
- The board: <link>, with Status <list the options> and a Due field. Live state: `gh project item-list <n> --owner <org> --format json`.
- Status: the issue titled "<digest title>". Use the `status-digest` skill for an on-demand check.
