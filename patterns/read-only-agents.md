# Read-only agents that return drafts

A planning agent is most useful when it can read everything and change nothing. Then you can give it a vague goal without worrying about what it will do. It returns a draft. A person acts on the draft, or the main session does with the person's yes.

## How

1. **Limit the tools** in the agent's frontmatter. Leave out `Edit`, `Write`, and any MCP tool that writes:

   ```yaml
   tools: Read, Grep, Glob, Bash, WebFetch
   ```

2. **Name the allowed and the forbidden commands** in the prompt. `Bash` can run anything, so the tool list alone does not make an agent read-only. List the read commands it may run (`gh issue list`, `gh api` with GET, `git log`). List the write commands it must not run (`gh issue create`, `gh api -X POST`, `git push`).
3. **Back the prompt with permission rules** where it matters. A prompt is an instruction; a deny rule is enforced. In `.claude/settings.json`:

   ```json
   {
     "permissions": {
       "deny": [
         "Bash(gh issue create:*)",
         "Bash(gh issue edit:*)",
         "Bash(gh pr merge:*)",
         "Bash(git push:*)"
       ]
     }
   }
   ```

   Deny rules apply to the whole session, not only to the agent. So add them in a repository or profile where nobody needs those commands.
4. **Give the draft a fixed shape:**
   - one line on what the plan achieves;
   - a table: order, repo, title, status, blocked by;
   - each draft in full;
   - existing items to update instead of new ones;
   - what it could not check.

## Why

- A wrong draft costs nothing. A wrong action costs a cleanup.
- A fixed shape makes the draft quick to review and easy to file with another skill.
- "What I could not check" is part of the output, so gaps show instead of being filled with guesses.

## Example

[`backlog-planner`](../plugins/repo-ops/agents/backlog-planner.md) returns tickets in the format of [`ticket-writer`](../plugins/repo-ops/skills/ticket-writer/SKILL.md). It limits its tools and lists its commands. Add the deny rules above if you want writes blocked, not only forbidden.
