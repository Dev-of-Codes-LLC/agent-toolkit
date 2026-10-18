---
name: feature-doc
description: Turn a finished feature, unit, epic, or pull request into one polished, wiki-ready product feature document, as Markdown in the repository (the source of record) plus a self-contained HTML reference sheet (lettered panels, a title block, optional whiteboard-style diagram) for sharing. Use this whenever the user wants a feature write-up, a wiki page, a "feature doc", a product page, a reference sheet, a release or unit summary that others can read, a presentable version of a final report, a page to share with a friend, customer, or stakeholder about something that was built, or asks to "document what we built" or "make this presentable", even if they only say "write it up" after finishing a piece of work.
---

# Feature document

Goal: someone opens the page months later and understands the feature in a
few minutes. What it is, why it exists, how to use it, what it promises,
what it does not do, and where the evidence lives. It is a product page
first; the engineering record already exists elsewhere and is linked, not
copied.

Two files, one content:

1. `docs/features/<slug>.md`: the source of record, committed with the code.
2. `docs/features/<slug>.html`: the same content rendered with
   `scripts/render.mjs` as a standalone reference sheet (section 7).

Pick the lightest content that works. Escalate only when it helps.

## 1. Format ladder

1. **Status entry only.** Housekeeping, a bug fix, a blocker fix with no
   user-facing change. No page: the project's status or changelog line is
   the record. Say so.
2. **Page, text panels.** The default for a shipped feature: the outline in
   section 4, prose, lists, and tables.
3. **Page with a diagram.** Add one diagram when "How it works" is a path
   across screens, services, or files with three or more hops, or when a
   relationship is easier to draw than to say. Style in section 6.
4. **Reader edition.** Only when the user asks for one or names a reader
   outside the project (section 2).

A small feature gets a short page, not a padded one. Do not add a diagram
to a list, and do not write a reader edition unasked.

## 2. Reader and edition

Read the request for who will open the page. It changes almost everything
about the text.

- **Owner edition (default).** The owner or team coming back later:
  technically literate, knows the product, has forgotten the details. They
  want the answer on the first screen and the evidence one click away.
  Every panel still opens with a plain sentence, so a non-technical
  colleague can follow the top half.
- **Reader edition.** Someone outside the project: a friend, a customer, a
  stakeholder, anyone described as not coding. Write it as a page for
  them, not as the owner edition with the hard parts left in:
  - no internal identifiers in the body (unit or ticket numbers, ADR
    numbers, requirement codes, migration names, endpoint paths, test
    names, job types, file paths);
  - name the people or say "we" instead of project roles ("the owner");
  - evidence becomes a plain phrase ("checked by automated tests on every
    change") instead of test names;
  - drop Key decisions, Verification detail, and the Technical appendix;
    keep "What it does not do", because honesty about limits is what makes
    the page trustworthy to an outsider too;
  - a warm, specific title and lead are welcome ("Paid invoices, without the
    spreadsheet"), as long as nothing is overstated.
  Write it as `docs/features/<slug>.reader.md` next to the owner edition
  (or create both if the owner edition is missing and the project wants
  one), and render it with `--strip-internal-links` so no link points into
  a private repository.

If the request is ambiguous, write the owner edition and say in one line
that a reader edition can be made.

## 3. Gather the facts

A polished page built on guesses is worse than a rough accurate one.
Sources, in order of preference:

- The work itself: the branch, the diff (`git diff <base>...HEAD --stat`),
  new files, the pull request.
- Decision records (ADRs), data contracts, API schemas, migrations.
- The project's status or changelog entry for the work (tests and results,
  limitations, follow-ups).
- The session's final report, when this runs at the end of the work.
- Images: see section 5.

Every number, version, date, and guarantee comes from one of these. Say
when something is unknown or unverified ("not checked by hand: screen
reader, real phone"). Never smooth it over.

**Check volatile facts with commands, not by inference.** Status and
delivery path go stale fastest and are the first thing a reader sees:

```bash
gh pr view <number> --json state,mergedAt,mergeCommit    # or the host's equivalent
git merge-base --is-ancestor <commit> origin/main && echo on-main
git log --first-parent --oneline origin/main | grep <short-sha-or-title>
```

Never derive a merge path from PR titles, dates, or nearby commits. Prefer
facts that do not go stale ("Merged 2026-09-27 in PR #88") over process
states ("PR open"); when a process state is the truth, date it ("In review
as of 2026-09-27"). Check again just before you finish.

**Owner** comes from the project's own docs, CODEOWNERS, or the commit
author as written (`git log -1 --format=%an`). Never expand a name from an
email address. Omit the row when unknown.

## 4. Shape, length, and the answer shape

Budget:

- Everything above "Key decisions" reads in about three minutes (roughly
  700 words). This is the part most readers will ever see.
- The whole owner edition stays under about 1,500 words unless the feature
  is genuinely large; a reader edition under about 900.
- Say each guarantee or limitation once. The metadata card, "At a glance",
  and the body must not restate the same facts three times.
- Link the project's status, changelog, and contract entries instead of
  copying their tables and commands; a second copy drifts.

**Answer shape.** Every panel (level-2 section) follows the same order:

1. One-line answer first: the conclusion of the panel in one sentence.
2. Then the mechanism: what the person does, what the product does, what
   calls what. In the owner edition name the screen, command, or endpoint;
   code locations go in the Technical appendix as `path:line`.
3. A concrete example (real input, real output, or an illustrative table)
   before any abstraction.
4. What to look at next, as a link, only if useful.

Outline (owner edition). Sections marked *if earned* appear only when they
have something true to add; never pad one to fill the shape.

```markdown
# <Feature name>

<One sentence: what it lets someone do, in the user's words.>

| | |
|---|---|
| Status | Merged 2026-09-27 (or: In review as of <date>, Beta, …) |
| Area | <product area or screen> |
| Owner | <from the project, or omit> |
| Delivered in | <PR / release, linked> |
| Decisions | <design records, linked> |
| Related | <other feature pages or contracts> |

## At a glance
3 to 5 bullets a busy reader can stop after.

## Why it exists
The problem and who has it, in plain language; one line citing the
requirement or ticket.

## How it works
The journey as numbered steps: the screen or command and what the person
sees. Add sub-sections that fit the feature's own shape (the catalogue of
themes, the file format, the per-platform table) instead of forcing its
content into generic headings. One illustrative example when it helps.
One diagram when the journey is a path (section 6).

## What it guarantees
Behavioural promises, each phrased as something a user can rely on and
each backed by a *check* (a test, a run, a measurement), named briefly.
A choice justified only by a design record is a decision, not a guarantee;
put it in Key decisions.

## What it does not do
Deliberate non-goals and current limitations, each with its reason or the
missing dependency. Never empty for real software.

## When something goes wrong  *(if earned)*
Situation · What you see · What to do, for failures a user or operator can
actually meet.

## Key decisions  *(if earned)*
The two to four choices that shaped the feature, a few sentences each,
linking the full record.

## Verification
At most five rows: Check · Outcome. An Outcome of `pass`, `fail`, or
`not checked` renders as a status mark (section 7); longer outcomes stay
text. Then the line naming what was not checked, and a link to the full
record.

## Glossary  *(if earned)*
Only terms not already explained where they first appear; at most eight;
always a bullet list of `**Term:** meaning`.

## Technical appendix
API, data model, jobs, configuration, where the code lives: short tables
and lists with links to the contracts.

## Changelog  *(if earned)*
Only when there is more than one dated entry; otherwise the Delivered in
row carries the delivery.
```

The reader edition keeps: title and lead, a short metadata card (Status,
What it works with), At a glance, Why it exists, How it works (with the
example and the diagram), What it promises (plain phrases), What it does
not do, and When something goes wrong if it matters to them.

## 5. Writing rules (ASD-STE100, relaxed)

Write in simplified technical English. Short sentences, one idea each,
the same word for the same thing every time.

Limits:

| Item | Limit |
| ---- | --- |
| Procedural sentence | 20 words |
| Descriptive sentence | 25 words |
| Paragraph | 6 sentences, one topic |
| Noun cluster | 3 words |
| Instructions per sentence | 1 (except simultaneous actions) |

Verbs:

| Form | Example | OK |
| ---- | ------- | -- |
| Command | Upload the file. | yes |
| Simple present / past / future | The import records the result. | yes |
| Infinitive | Open the import to see the dry run. | yes |
| Past participle as adjective | The paid invoice | yes |
| Progressive (-ing) | The import is recording. | no |
| Perfect | The import has recorded. | no |
| Passive in procedures | The file must be uploaded. | no |

Words:

- Same word for the same thing, every time. No synonyms for variety. Use
  the product's own terms; expand an abbreviation the first time.
- Keep "the", "a", "this". Do not drop articles.
- Short common words: use not utilize, start not commence, before not
  prior to, about not approximately, make sure not ensure, to not in order
  to.
- Active voice. Simple present tense. Vertical lists for complex text.
- Be concrete ("matches 1,200 payments in about 3 s", not "fast").
  No marketing adjectives ("powerful", "seamless", "robust").
- State limits plainly and without apology.

Rewrite check (same meaning, fewer words):

- Before: "It is imperative that the operator ensures the month has been
  closed prior to commencing the import."
- After: "Make sure the month is closed before you start the import."

Layout:

- Lead every panel with its conclusion; detail follows.
- Short paragraphs; tables for comparisons and lists of endpoints or
  platforms; numbered lists for sequences; bullets for sets.
- Two or three callouts at most, for what a reader must not miss:
  blockquotes starting with a bold label, which the sheet colours:
  `> **Note:**` and `> **Important:**` are blue (an annotation);
  `> **Limitation:**` and `> **Not verified:**` are red (not allowed, at
  risk).
- Portable Markdown only (CommonMark plus pipe tables): no raw HTML, no
  emoji headings, no front matter. Escape a pipe inside a table cell as
  `\|`.

Examples and images:

- **Illustrative example.** One small, invented example often explains a
  feature better than any paragraph: an invoice list with each row marked
  paid or open, a settings panel as a two-column table, a before and
  after. Build it as a Markdown table or list and caption it on the line
  below as `*Illustrative example, not real data.*` Use generic names, never
  real people or real accounts.
- **Screenshots.** Use one only if it can live next to the page: copy it
  into `docs/features/<slug>/` and caption what data it shows ("synthetic
  test data"). Never link a screenshot in an ignored, temporary, or
  local-only folder. If there is none, leave it out and do not write about
  its absence.

## 6. Diagrams (whiteboard look)

Minimal, hand-drawn, calm. A whiteboard sketch, not a corporate slide.

- **When:** a flow, a path, a sequence, or a relationship (section 1). A
  list or a catalogue stays a list.
- **Shapes:** rounded rectangles, plain arrows, a few ellipses. No shadows,
  gradients, icons, or 3D.
- **Lines:** hand-drawn feel. Slight wobble, 2 px stroke, round caps. The
  starter file carries an `feTurbulence` + `feDisplacementMap` filter
  (scale about 1.5) on the shapes; labels stay crisp.
- **Colours:** dark strokes on white (dark mode: light strokes on
  near-black), from the theme through `currentColor`. One accent at most
  (`d-accent`, blue) plus soft pastel fills for grouping (`d-group`,
  `d-group-2`, `d-group-3`). Red (`d-bad`) only for a path that is wrong
  or refused.
- **Text:** hand-style font (`Caveat`, `Kalam`, or the system's
  handwriting face), 2 to 4 words per label. Never a sentence in a box.
- **Layout:** left to right or top to bottom, generous spacing, one arrow
  per relationship, no crossing lines. At most 8 boxes; split the diagram
  if you need more.
- **Arrows:** label only when the verb is not obvious ("sends token",
  "401").

How to make one:

1. Copy `assets/diagram-starter.svg` to `docs/features/<slug>/<name>.svg`.
   Keep its `<defs>`, `<style>`, and class names; replace the shapes and
   labels. The `<style>` is what GitHub and an image viewer use; the
   renderer removes it and applies the page's own theme.
2. Place it in the Markdown as a lone image with the caption as alt text:
   `![What the diagram shows](<slug>/<name>.svg)`. The renderer inlines
   the SVG as a figure (scripts, styles, event handlers, and external
   references removed), so the HTML stays standalone and the diagram
   follows light and dark mode.
3. Open the rendered page in both themes and at phone width before you
   finish.

When an SVG is not possible, draw the path as plain text in a fenced code
block instead:

```
 [Upload file] --CSV--> [Parse rows] --> [Record results]
```

## 7. The reference sheet (what the renderer makes)

The HTML twin is one page of lettered panels, like an engineering drawing
sheet. Knowing what it does tells you what the Markdown controls.

- **Frame:** a thin outer border with grid references (columns 1 to 8,
  rows A to D). White page, dark text; dark mode inverts it; print is
  black on white.
- **Title panel:** the title, the lead sentence, the metadata card, and
  the panel index (letters and names, each a link).
- **Panels:** every level-2 heading becomes a bordered panel with a dark
  letter chip (A, B, C), the heading as its bold title, and a small mono
  caption on the right. Captions come from the heading: At a glance
  "summary", Why it exists "problem", How it works "procedure", What it
  guarantees "checked promises", What it does not do "limits", When
  something goes wrong "recovery", Key decisions "design records",
  Verification "evidence", Glossary "terms", Technical appendix
  "reference", Changelog "history". Any other heading gets "diagram",
  "steps", "table", or "notes" from its content. A panel with a table,
  figure, code block, or more than about 160 words spans the full width;
  the rest sit two abreast. Phones stack every panel in one column.
- **Colour, one meaning each:** blue = approved or an annotation (links,
  Note and Important callouts, a `pass` cell). Red = wrong or not allowed
  (Limitation and Not verified callouts, a `fail` cell). Grey = secondary
  (captions, labels, a `not checked` cell). Nothing else.
- **Type:** mono for captions, labels, code, and numbers (right-aligned
  columns, `|---:|`). Clean sans for titles and body.
- **Status cells:** a body cell that is exactly `yes`, `pass`, `ok`, or
  `✓` shows a blue check; `no`, `fail`, or `✗` a red cross; `not checked`,
  `not run`, `skipped`, or `n/a` a grey dash. Anything longer stays text.
- **Title block** (bottom right): Title, Source (the Markdown file, linked
  at the link base), Owner and Status (from the metadata card), Rev (the
  first eight characters of the Markdown's digest), Rendered date, Sheet
  "1 of 1".
- **Also:** a light and dark theme toggle, callouts, stacked tables on
  phones, print styles, reduced motion and forced colours respected.

## 8. Produce the files

1. Slug from the feature name (`payment-matching`), not the ticket
   number, so the page survives renumbering.
2. Write `docs/features/<slug>.md` (follow an existing docs layout such as
   `docs/wiki/` if the project has one). Links to project files are
   relative to that file (`../decisions/…`) so they work on the code host.
3. Render (Node 18 or newer, no dependencies):

   ```bash
   node <skill-dir>/scripts/render.mjs docs/features/<slug>.md docs/features/<slug>.html --link-base <url>
   ```

   The renderer stamps the HTML with a `source-sha256` meta tag holding the
   digest of the Markdown it rendered. A project can add a check (a CI docs
   job, for example) that recomputes it and fails on a missing or stale
   page. Re-render after every edit to the Markdown, and never edit the
   HTML by hand.

   `--link-base` makes the HTML's links to project files absolute, so they
   keep working once the page is shared. Compute it from the remote and the
   commit the page describes, for example
   `https://github.com/<owner>/<repo>/blob/<sha>/docs/features/`
   (`git remote get-url origin`, `git rev-parse HEAD`). Use
   `--strip-internal-links` instead for a reader edition or when the
   repository is private and the page goes outside the team. Links between
   feature pages stay relative. If Node is unavailable, write the HTML by
   hand from `assets/template.html`.
4. If the session can publish pages (for example an Artifact tool) and the
   user wants a shareable link, publish the HTML under that tool's own
   rules; otherwise the files are the deliverable.
5. If the project keeps an index of features (`docs/features/README.md`, a
   wiki home), add one line linking the page.
6. Read the page once more as its reader: does the first screen answer
   "what is this and is it done?", does every panel open with its answer,
   is every claim traceable, is the status still true, is anything
   repeated, would an outsider hit an internal id in a reader edition?
   Open the HTML in light and dark mode and at phone width. Then report the
   file paths.

Do not commit or push unless the user asks; the page usually rides along
with the feature's pull request.

## Examples

### Bad vs good

- Bad: "The import leverages the existing ledger pathway to facilitate the
  seamless reconciliation of received payments against previously issued
  invoices."
- Good: "The import marks each payment on the invoice it pays. A second
  import changes nothing."

Why: one idea per sentence, active voice, plain words, no stacked nouns.

### Pick the format

| Work | Format | Why |
| ---- | ------ | --- |
| A bug fix in the rounding rule | Status entry only | No new capability to describe |
| A new settings page | Page, text panels | A catalogue of options: tables and lists |
| An import that crosses upload, parse, and ledger | Page with a diagram | A path with three hops |
| "Something I can send my friend" | Reader edition | A reader outside the project |

### Panel shape

```
Answer:  The import marks every paid invoice of one statement in one step.
How:     Upload the statement on Imports → open the import's Results card
         (dry run) → Record payments → read Invoices → Paid.
Example: INV-1042 for 1,200.00 USD, a payment of 1,200.00 on 2026-03-04
         → paid.  *Illustrative example, not real data.*
Next:    [Invoice reports](invoice-reports.md)
```
