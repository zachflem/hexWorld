# Hex World — Git & Issues Workflow

Two developers, two long-lived personal branches, one integration branch.  
**Backlog status lives on GitHub only** — never in personal-branch markdown trackers.

## Branches

| Branch | Owner | Purpose |
|---|---|---|
| `main` | — | Production / stable releases |
| `dev` | Both | Integration — merge here when a milestone, bug fix, or feature is **finished** |
| `krunchee` | Krunchee | Active development — always push work-in-progress here |
| `goblin` | Goblin | Active development — always push work-in-progress here |

Do **not** create short-lived `cursor/…` or per-feature branches unless there is a specific reason (e.g. a risky experiment you might abandon). Personal branches keep Cloudflare preview URLs stable:

- `krunchee.hexworld.pages.dev`
- `goblin.hexworld.pages.dev`

## GitHub tracking

| Surface | URL / notes |
|---------|-------------|
| Issues | https://github.com/zachflem/hexWorld/issues |
| Milestones | https://github.com/zachflem/hexWorld/milestones |
| Project board | https://github.com/users/zachflem/projects/1 (**hexWorld**) |

### Project Status columns

| Status | Meaning |
|--------|---------|
| **OPEN** | Triaged / not started |
| **ACTIVE** | Implementing |
| **TESTING** | On personal-branch preview; playtest & verify |
| **DONE** | Merged to `dev` / closed (working view hides these; auto-archive ~14d) |

**Board hygiene (manual once in Project → … → Workflows):**

1. Auto-add to project → Status **OPEN**
2. Item closed → Status **DONE**
3. Auto-archive items: `is:closed updated:<@today-14d`
4. Working board view filtered to OPEN, ACTIVE, TESTING

### Labels

`bug`, `ui`, `ux`, `balance`, `proposed`, `concept`, `design-question`, `deferred`, `docs`, `urgent`  
Urgent work also prefixes the title with `[URGENT]`.

### Filing issues

Prefer the prompted **`/issue`** skill from private [`zachflem/dev-tools`](https://github.com/zachflem/dev-tools):

```bash
gh api repos/zachflem/dev-tools/contents/install.sh --jq .content | base64 -d | bash
```

Or use `.github/ISSUE_TEMPLATE/*` in the GitHub UI. Create issues as soon as findings appear during playtest — do not stash them in local files.

**gh scopes:** `repo` for Issues; `project` (+ `read:project` if prompted) for the board:

```bash
gh auth refresh -h github.com -s project,read:project
```

## Day-to-day

### Starting work

```bash
git checkout goblin          # or krunchee
git pull origin goblin
git merge origin/dev         # stay current with integration
```

Consult `gh issue list` / the Project board (not `ROADMAP.retired.md`).

### While working

1. Move the card **ACTIVE**; keep issue Status notes honest.
2. Commit and push to your personal branch often.
3. Move to **TESTING** for playtest on the preview URL.
4. File new playtest findings as new Issues immediately.

### Finishing

Merge personal branch **into `dev`** (PR or local merge). Prefer `Fixes #N` in the commit/PR so the issue closes. Board → **DONE**.

```bash
git checkout dev
git pull origin dev
git merge goblin
git push origin dev
git checkout goblin
git merge dev
git push origin goblin
```

### Promoting to production

When `dev` is ready for release, merge `dev` → `main` (PR recommended). Manual; out of day-to-day backlog flow.

## Deep context docs

Live under [`context/`](README.md). Update DESIGN / PLAYER_GUIDE / TWEAKS when shipping mechanical or player-visible changes (see [context/README.md](README.md)). Complex agent plans → `context/MilestoneN.md` with a `GitHub:` link to the milestone/issue.

## For Cloud Agents / automation

- **Personal branch:** ask which branch (`goblin`, `krunchee`, …). Do not assume.
- Do not create `cursor/<random>` branches unless asked.
- Base merges on **`dev`**, not `main`, unless releasing.
- **Backlog:** GitHub Issues / Project only. Never edit `ROADMAP.retired.md`.
- **Issue create/edit/close:** use `/issue` prompted flow; require human approval before `gh issue create` or other state-changing `gh` calls.
- Install tools: `zachflem/dev-tools` (see above).
