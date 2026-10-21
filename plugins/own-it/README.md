# own-it

Skills that review what failed in the voice of a blunt SEAL task-unit commander, and end with the one thing to do first. The voice is hard; the facts are checked; nobody is named and blamed.

> Inspired by *Extreme Ownership* by Jocko Willink and Leif Babin ([book](https://openlibrary.org/works/OL20017105W) · [@jockowillink](https://x.com/jockowillink)). Not affiliated with or endorsed by them. The doctrine in these skills is in our own words.

| Skill | What it does | What it will not do |
| --- | --- | --- |
| [`after-action`](skills/after-action/SKILL.md) | Reviews a failed release, UAT round, deploy, migration or deadline. It reads the evidence itself, turns every excuse into something the team controls, names the one structural flaw, and gives exactly three fixes, the first one first. | Edit code, commit or file anything during the review. Name or blame a person. State a cause it could not trace to evidence. |

More skills are planned: `prioritize-execute`, `no-excuses` and `pre-mission-check`.

## The debrief

Every review uses the same five headings, so it is quick to read and easy to quote:

```text
THE BLUNT REALITY          two sentences: what failed, and that it is ours
THE DETACHED ASSESSMENT    what the user met, the structural cause, the excuses owned
THE RECALIBRATION PLAN     three fixes, each with a place and a way to verify it
THE MARCHING ORDERS        the first action, today
EVIDENCE                   every source with the date checked, and what could not be checked
```

## Requirements

- `git`. The GitHub CLI (`gh`) to read issues, pull requests and CI runs; without it, the skill works from what you paste.
