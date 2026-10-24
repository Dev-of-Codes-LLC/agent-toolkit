# Contributing

Issues and pull requests are welcome. A person reads every one.

## Before you start

- Open an issue first for anything bigger than a typo, so we agree on the change before you write it. To report a skill that misbehaved, use the [skill problem](.github/ISSUE_TEMPLATE/skill-problem.md) template.
- For a security problem, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Pull requests

- One skill per PR.
- Run `claude plugin validate` on the plugin you changed, and on the repo root.
- Bump `version` in that plugin's `.claude-plugin/plugin.json`, so installed copies update.
- CI must be green before review: secrets scan, manifest validation, link check, and the skill scripts on Linux.
- Keep the voice of the existing files: short sentences, plain words, no hype.

## Examples

Use no names, accounts, hostnames or ids from any real organization in examples, tests or docs. The fictional Acme Labs (`acme-labs`, `acme.example`) is the only example org here. See [`examples/acme/`](examples/acme/README.md).

## Conduct

This repository follows [GitHub's community guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines). Be direct and be kind.
