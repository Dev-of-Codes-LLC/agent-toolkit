# Acme Labs org map

Checked: 2026-03-02. This is a map, not a snapshot: read each row's live state before you state it as current.

*Fictional example. Acme Labs, its people and its accounts are invented.*

Acme Labs is a two-person studio. Sam owns the company and the accounts; Lee writes most of the code. It has one paying pilot customer and no other users.

## Repos

| Repo | What it is | Live state |
| --- | --- | --- |
| `acme-labs/backlog` (private) | Backlog for account, settings and billing work. Holds `.claude/toolkit.json` and this map. | `gh issue list -R acme-labs/backlog` |
| `acme-labs/web` (public) | The marketing site, acme.example. A merge to `main` deploys production. | `gh run list -R acme-labs/web --workflow deploy.yml` |
| `acme-labs/api` (private) | The product's API, Node 22 and Postgres | `gh pr list -R acme-labs/api` |
| `acme-labs/infra` (private) | Terraform for the cloud accounts. Its README has the "Who applies what" table. | `README.md`, `docs/decisions/` |

## Providers

| Job | Provider | Where to look |
| --- | --- | --- |
| Code, CI, backlog | GitHub org `acme-labs`, Team plan, 2 seats | Org settings; backlog issues labelled `github-org` |
| Hosting | One cloud account each for production and staging | `acme-labs/infra` |
| DNS | The cloud provider's DNS, production account | `infra/dns.tf` |
| Domain registration | A registrar, renews 2027-01-20 | backlog issue "Renew acme.example" |
| Mail | A hosted mail plan, two mailboxes | backlog issues labelled `dns` |

The cloud budget is 150 USD a month, with an alert at 80 %. The provider has no hard cap, so an alert is not a limit.

## Rules that hold everywhere

- Sam runs every Terraform apply, from a local machine. Agents write diffs and PRs. Agents never apply.
- A merge to `main` in `acme-labs/web` is a production release. Sam merges.
- Clicks in the GitHub org settings, the registrar and the mail admin console are Sam's. Agents prepare the exact steps and the menu path.
- Site copy names one pilot customer only with their written consent, and no usage numbers.

## Where work is tracked

- Account, settings and billing work: issues in `acme-labs/backlog`. Use the `ticket-writer` skill.
- Code work: issues and PRs in the repo it touches.
- The board: project 3 in `acme-labs`, with Status Ready, Scheduled, Blocked, Parked, In Progress and Done, and a Due field. Live state: `gh project item-list 3 --owner acme-labs --format json`.
- Status: the backlog issue titled "Status digest". The routine posts there every Monday. Use the `status-digest` skill for an on-demand check.
