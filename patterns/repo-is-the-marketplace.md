# The repo is the marketplace

A Claude Code plugin marketplace is a Git repository with `.claude-plugin/marketplace.json` at its root. So the repository that holds the work can also hold the plugin that serves it. You need no separate package and no publish step.

## How

1. Put the plugin in `plugins/<name>/`. Give it `.claude-plugin/plugin.json`, and `skills/` and `agents/` folders as needed.
2. List it in `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "my-marketplace",
     "owner": { "name": "<you>" },
     "plugins": [{ "name": "my-plugin", "source": "./plugins/my-plugin" }]
   }
   ```

3. To load it for anyone who opens the repo, enable it in `.claude/settings.json`:

   ```json
   {
     "extraKnownMarketplaces": {
       "my-marketplace": {
         "source": { "source": "github", "repo": "<owner>/<repo>" },
         "autoUpdate": true
       }
     },
     "enabledPlugins": { "my-plugin@my-marketplace": true }
   }
   ```

   Claude Code asks the user to trust the folder first.
4. To use it from other repos too, install it once at user scope:

   ```text
   /plugin marketplace add <owner>/<repo>
   /plugin install my-plugin@my-marketplace
   ```

## Rules that keep it working

- **Bump `version` in `plugin.json` whenever a skill or agent changes.** Installed copies update by version. Without a bump, users keep the old copy.
- **Validate before you push.** Run `claude plugin validate .` for the marketplace, and `claude plugin validate ./plugins/<name>` for each plugin. This repo's CI runs both.
- **Change the plugin through a pull request**, like code. A skill is behaviour, so review it.
- **A private repository works as a marketplace.** Claude Code clones it with your Git credentials, so `gh auth login` (or another credential helper) must run first.

This repository is built this way: see [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json).
