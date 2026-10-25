# Privacy

What the plugins in this repository (`devofcodes-dev-workflow`, `devofcodes-repo-ops`, `devofcodes-own-it`) do with data. Checked against the code on 2026-10-25; the "What it runs and writes" section of each plugin's README is the detailed list.

## Nothing comes to us

The plugins run inside Claude Code on your machine. Dev of Codes LLC runs no service behind them and receives nothing from them: no telemetry, no analytics, no crash reports, no usage data. We cannot see what you ask them or what they produce.

## What they read

Only what you point them at: your repository and its git history, and, through your own GitHub CLI login or the GitHub MCP tools, the issues, pull requests, CI runs and project boards you already have access to. Git history, issues and pull requests carry author names and emails. The plugins read them to do their work and keep none of it.

They do not read your Claude conversation history, your other repositories, your environment variables, or files outside the repository and the GitHub resources you name.

## What they write

Only where the README says. `feature-doc` writes files in your repository. `land-branch` pushes branches and opens pull requests. `ticket-writer` creates issues and sets board fields. `status-digest` posts one comment when run as a routine. All of these go to GitHub under your own account, through your own login. `docker-cleanup` talks to your local Docker daemon and prints every command before it runs one. `after-action`, `org-map` and `backlog-planner` write nothing unless you ask.

## What they keep

Nothing between runs. There is no profile, no cache of your data, and no state outside your repository.

## What this page does not cover

How Anthropic handles what you type into Claude is governed by [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy), not by this page. How GitHub handles what the plugins write there is governed by GitHub's.

## Questions

hello@devofcodes.com. For a security problem, see [SECURITY.md](SECURITY.md).
