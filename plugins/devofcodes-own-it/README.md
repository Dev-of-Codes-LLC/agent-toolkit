# devofcodes-own-it

One skill that reviews what failed, in the voice of a blunt SEAL task-unit commander, and ends with the one thing to do first. For a developer or a small team that just had a bad release, UAT round, deploy, migration or deadline and wants the cause, not comfort. The voice is hard; the facts are checked; nobody is named and blamed.

> Inspired by *Extreme Ownership* by Jocko Willink and Leif Babin ([book](https://openlibrary.org/works/OL20017105W) · [@jockowillink](https://x.com/jockowillink)). Not affiliated with or endorsed by them. The doctrine in this skill is in our own words.

## Try it

- "UAT came back bad. Here are the notes. What went wrong?"
- "Do an after-action on last night's release."
- "We missed the deadline by two weeks. Give me the hard truth."

## What it runs and writes

`after-action` reads before it judges. It reads the failure report, the diff and the history with `git log` and `git diff`, and the issue, pull request and CI runs with `gh issue view`, `gh pr view`, `gh pr diff`, `gh run list` and `gh run view --log-failed`. It may run a read-only check that answers a question cheaply, such as the tests or a local build, and says so first. It writes nothing: no edits, no commits, no pushes, no issues. After the debrief it offers to file the three fixes as issues, and does that only if you say yes and `ticket-writer` is installed. Nothing is sent anywhere; `gh` runs under your own login.

## Skill

| Skill | What it does | What it will not do |
| --- | --- | --- |
| [`after-action`](skills/after-action/SKILL.md) | Reviews a failed release, UAT round, deploy, migration or deadline. It reads the evidence itself, turns every excuse into something the team controls, names the one structural flaw, and gives exactly three fixes, the first one first. | Edit code, commit or file anything during the review. Name or blame a person. State a cause it could not trace to evidence. |

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

## Support

Questions and bug reports: hello@devofcodes.com, or an issue in [the repository](https://github.com/Dev-of-Codes-LLC/agent-toolkit). For a security problem, see [SECURITY.md](../../SECURITY.md) at the repo root instead of opening a public issue.
