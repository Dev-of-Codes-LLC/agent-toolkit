# Every fact has a date

Live state goes stale. A check that passed, a PR that was open, a renewal date: each was true when someone read it. So every fact that an agent read live carries the date it read it. Anything it did not read is marked as unverified.

## How

- Write live facts like this: **"Checked 2026-10-10: the deploy workflow last passed on 2026-10-09."**
- Prefer facts that do not go stale ("Merged 2026-09-27 in PR #88") to process states ("PR open"). When a process state is the truth, date it ("In review as of 2026-09-27").
- Name the command for each fact that can change, so the next reader can check it again. A map row has a "Live state" column for this.
- End a report with **"Could not check"**: what was unreachable, and why.
- Never hide a gap. "Not checked by hand: screen reader, real phone" is a useful sentence.

## Why

- A reader can see at once how old a fact is, and whether to trust it.
- Stale facts in a plan or a feature page are the most common way an agent misleads without lying.
- With the command next to the fact, "is this still true?" takes ten seconds to answer.

## Examples in this toolkit

- [`org-map`](../plugins/repo-ops/skills/org-map/SKILL.md) is "a map, not a snapshot", with a live-state command per row.
- [`ticket-writer`](../plugins/repo-ops/skills/ticket-writer/SKILL.md) issue bodies say "Checked YYYY-MM-DD: ..." for what was read live.
- [`feature-doc`](../plugins/dev-workflow/skills/feature-doc/SKILL.md) checks status and delivery path with commands, and checks them again before the page is finished.
