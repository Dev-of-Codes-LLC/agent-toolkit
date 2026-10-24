# Skills for sessions without plugins

Cloud sessions and scheduled routines may not load plugins, even when a repository's settings enable them. But a skill is only a Markdown file. So give the session a checkout that contains the file, and tell it to read the file.

## How

1. Make the repository that holds the skill a source of the cloud session or routine.
2. In the prompt, name the file and the mode:

   ```text
   Read plugins/devofcodes-repo-ops/skills/status-digest/SKILL.md in the checkout and
   follow it as the routine.
   ```

3. Write the skill so it works both ways:
   - Use paths relative to the skill's own folder for its scripts and templates.
   - Say what to do when a tool is missing. For example: "In a cloud session `gh` may have no token; use the GitHub MCP tools."
   - Give the routine mode its own short section that says what the routine writes, and nothing else.

## Why one source

If you copy the skill's text into a routine prompt, you have two versions. They drift apart within weeks, and then the routine follows rules the skill no longer has. A prompt that points at the file always runs the current version, and a pull request to the skill changes both.

## Example

The [status-digest routine recipe](../routines/status-digest.md) is one prompt that points at [`status-digest/SKILL.md`](../plugins/devofcodes-repo-ops/skills/status-digest/SKILL.md).
