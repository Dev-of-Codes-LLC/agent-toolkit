---
name: docker-cleanup
description: Audit and reclaim a local Docker Desktop environment safely, tier by tier (build cache, broken builders, orphan networks, exited containers, leftover images, and finally volumes only by explicit name). Use this whenever the user mentions Docker disk usage, "docker is eating my disk", prune, dangling or leftover images, old compose projects, stale volumes, build cache size, or asks what Docker resources exist and which are safe to remove, even if they only say "clean up docker" or "why is my C drive full". Also use it after a burst of throwaway compose projects (isolated test or smoke stacks) to clear what they left behind.
---

# docker-cleanup

Docker environments grow in a predictable way: every `docker compose -p <name>`
run leaves images, and unless it ended with `down -v --rmi local` it also
leaves volumes and networks. Rebuilds pile up build cache. Old projects leave
database volumes that look like junk but may be the only copy of someone's
data. The job is to reclaim space without ever deleting data the user did not
name, and to leave a report that says what went and what stayed.

Two scripts live next to this file. They need no modules. Run them with
Windows PowerShell 5.1 (`powershell -NoProfile -ExecutionPolicy Bypass -File`)
or with PowerShell 7 on Windows, macOS or Linux (`pwsh -NoProfile -File`).
The examples below use the Windows form.

- `scripts/audit.ps1` is read-only. It groups every resource by compose
  project, classifies it, and lists cleanup candidates per tier.
- `scripts/cleanup.ps1` re-runs the audit, prints a plan with the exact
  `docker` commands, and applies it only with `-Execute`.

## Workflow

1. **Audit first, always.**
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<skill dir>\scripts\audit.ps1"
   ```
   Add `-Protected <project,...>` for stacks that must survive even when
   stopped. Any project with a running container is protected automatically.
   Add `-StaleDays N` to change what counts as stale (default 30).

2. **Read the compose-project table before anything else.** For each project
   decide which of these it is, and say so in the report:
   - `live`: running now. Nothing of it is touched.
   - `stopped`: containers exist but are exited. Usually a stack the user
     shut down deliberately; ask before removing its containers, and never
     touch its volumes in the same pass.
   - `residue`: no containers, only volumes, networks, or images. This is
     the normal aftermath of `compose down` without `-v`. Images and
     networks here are safe. Volumes are data until the user says otherwise.
   The `WorkingDir` column tells you where the stack came from. A missing
   directory means the repo or worktree is gone, which makes the images and
   networks clear candidates and makes the volumes the only trace of that
   project's data, so call that out explicitly.

3. **Propose a plan by tier, smallest blast radius first.** Run the dry run
   and paste the relevant part of its output into the conversation:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<skill dir>\scripts\cleanup.ps1" -Tier cache,builders,networks,containers,images
   ```
   When several unrelated projects share the machine, narrow the images,
   networks, and containers tiers with `-Project <pattern,...>` (for
   example `-Project acme-*`) so the user decides one project family at a
   time; other projects' builds are rebuildable but cost minutes each.
   The build cache is nearly always the biggest win and the safest: pruning
   it only costs rebuild time. `-KeepCacheDays` (default 7) keeps the layers
   the user is actively rebuilding so their next build stays fast. Image
   removal frees only the unique layers of each image; the plan shows that
   number, not the headline size, so expectations are right.

4. **Get consent per tier. Volumes are always their own decision.** The
   default tiers never include volumes. When the audit lists
   `project-residue` volumes, present them grouped by project with size and
   the missing or present working directory, and ask which projects the
   user is done with. Point out that a 48 MB Postgres volume is an empty
   database, while anything larger may hold real work. Then remove them one
   project at a time:
   ```powershell
   ... cleanup.ps1 -Tier volumes -VolumeProject <project> -Execute
   ```
   The script refuses attached volumes and protected projects. If the user
   wants to keep the data but free the space, suggest `docker run --rm -v
   <vol>:/from -v <hostdir>:/to alpine tar czf /to/<vol>.tgz -C /from .`
   before removal, and do not run it for them without asking.

5. **Execute, then re-audit.** Re-run the same `cleanup.ps1` command with
   `-Execute`. It prints `docker system df` before and after. Finish with
   the report below. If a removal failed (an image still referenced by a
   tag you did not see, a network with an attached container), report the
   failure as the script printed it rather than forcing it.

## Rules and the reasons behind them

- **Never `docker system prune -a` or `docker volume prune` wholesale.** On a
  machine with several projects those commands delete other projects'
  images and every unattached volume, including databases of stacks that
  are merely stopped. The tiers exist so each class is decided on its own.
- **Prefer the project's own teardown when it still exists.** If a residue
  project's working directory is present and has a compose file, the clean
  way is `docker compose -p <project> down -v --rmi local` from that
  directory, because it removes exactly what that project created. Use the
  script's per-resource removal when the directory or its env file is gone.
- **Do not remove pulled base images by default.** They are cheap to
  re-pull but cost time and, behind a metered or rate-limited registry, a
  failed rebuild. Offer `-IncludePulled` as a separate, explicit step and
  list what it would remove (old `node`, `postgres`, `python` tags are the
  usual candidates).
- **Devcontainer images (`vsc-*`) and one-off local builds** fall under
  `local-unmatched`. They are not tied to a compose project, so the audit
  cannot tell whether a VS Code workspace still uses them. Offer
  `-IncludeLocalUnmatched` only after naming them.
- **Untagged is not dangling.** The Docker MCP Toolkit and some tools pull
  images by digest, which shows as `<none>:<none>` in `docker images` while
  Docker's own `dangling=true` filter does not report them. The audit
  classes these `digest-pinned` and cleanup never selects them; removing
  one silently breaks the tool that pulled it until its next start.
- **How the audit tells builds from pulls.** Compose labels the images it
  builds with `com.docker.compose.project`, and that label is what ties an
  image to a project. Anything else without a registry namespace is
  treated as a local build only if its name contains a dash or underscore;
  single-word names are library images. With the containerd image store
  every image has a digest and a buildkit comment, so those fields prove
  nothing.
- **Buildx builders in error state** (`docker buildx ls` shows `error`)
  point at a Docker context or socket that no longer exists. Removing them
  loses nothing; they cannot build. Most of them are Docker contexts (for
  example old per-distro WSL engine entries), and `docker buildx rm`
  refuses those; the audit marks them and cleanup uses `docker context rm`
  instead. The current context is never removed.
- **Build-cache pruning by age frees less than the headline.** The
  `unused-for` filter only takes records nobody used within the window,
  and a heavy rebuild week can leave most of the cache "used 6 days ago".
  Report what the prune actually returned and offer a shorter
  `-KeepCacheDays` as a follow-up rather than re-running with a bigger
  hammer; the user knows whether they are about to rebuild.
- **Do not quietly widen the job.** If the user asked about disk space,
  running containers of other projects are not yours to stop, even when
  they are idle.

## Project notes

The audit knows Docker, not your projects. Before a cleanup, look for
project notes in the repository's `CLAUDE.md` (or ask the user) that say,
per stack:

- which compose project is the live stack, and which of its volumes are the
  real data;
- where its database backups live and which script writes them;
- the `-p <prefix>-<tag>` naming of throwaway test and smoke stacks, so their
  leftovers can be cleared as one family with `-Project <prefix>-*`;
- any helper that starts a temporary stack (a restore check, for example)
  whose leftovers are disposable once its job is done.

For example, for the fictional Acme Labs:

```markdown
## Docker notes
- Live stack: compose project `acme-api`, from the repo root. Its volumes
  `postgres_data` and `uploads` are real data. Backups: `backups/`, written
  by `scripts/backup.ps1`.
- Test stacks: `-p acme-<tag>` (`acme-smoke`, `acme-e2e`). They end with
  `down -v`; leftover `acme-<tag>-*` images are safe to remove.
```

One case holds everywhere: a stack recreated from inside a
`.claude/worktrees/<name>` checkout bind-mounts files from that worktree.
If the audit shows a live container whose working directory is a worktree,
recreate it from the repository root before that worktree is deleted.

## Report structure

End with this, in prose or short tables, not the raw script dump:

```
# Docker cleanup <date>
## Before / after
docker system df totals, and the space actually freed.
## Removed
Per tier: what and how much. Volumes listed by name with their project.
## Kept on purpose
Live projects, protected projects, volumes the user did not release,
pulled images left for rebuild speed, anything that failed to remove.
## Still worth a decision
Residue volumes by project with sizes; local-unmatched images; anything
the user deferred. Include the exact cleanup.ps1 command for each.
```
