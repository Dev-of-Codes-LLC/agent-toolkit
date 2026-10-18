# Config, not names

A skill written for one organization is full of its names: the repos, the board, the person who approves. To share the skill, move those names into one small file, and keep the skill's rules general.

## How

1. Keep the org's values in `.claude/toolkit.json`, in the repository where most of the work is tracked. Each plugin owns its own keys: see the [repo-ops settings](../plugins/repo-ops/README.md#settings-claudetoolkitjson) and the [dev-workflow settings](../plugins/dev-workflow/README.md#settings-claudetoolkitjson).
2. Start each skill with "Read the settings": where the file is, which keys this skill uses, and what to do when the file is missing.
3. **When the file is missing, ask, then offer to write it.** Never guess a repository, a board or a command.
4. **Say "the owner", not a name.** The rule "only the owner merges to production" travels. A first name does not.
5. **Read ids at run time.** Project-board field and option ids differ between boards. Look them up with `gh project field-list` instead of storing them.
6. **Use a fictional org in every example.** This toolkit uses Acme Labs: see [`examples/acme/`](../examples/acme/README.md).

## What stays in the skill

The rules stay: read-only limits, dry run first, dated facts, the injection guard, the writing style. They are the point of the skill, and they are the same for everyone.

## Why

- You fill in one file, instead of maintaining a fork.
- The skill's text can be public while the values stay private.
- A missing value becomes a question, not a wrong guess.
