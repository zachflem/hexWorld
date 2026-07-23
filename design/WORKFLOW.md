# Hex World — Git Workflow

Two developers, two long-lived personal branches, one integration branch.

## Branches

| Branch | Owner | Purpose |
|---|---|---|
| `main` | — | Production / stable releases |
| `dev` | Both | Integration — merge here when a milestone, bugfix, or feature is **finished** |
| `krunchee` | Krunchee | Active development — always push work-in-progress here |
| `goblin` | Goblin | Active development — always push work-in-progress here |

Do **not** create short-lived `cursor/…` or per-feature branches unless there is a specific reason (e.g. a risky experiment you might abandon). Personal branches keep Cloudflare preview URLs stable:

- `krunchee.hexworld.pages.dev` (branch alias — configure once in Cloudflare Pages)
- `goblin.hexworld.pages.dev`

## Day-to-day

### Starting work

```bash
git checkout goblin          # or krunchee
git pull origin goblin
```

### While working

Commit and push to your personal branch often:

```bash
git add …
git commit -m "Describe the change"
git push origin goblin
```

### Finishing a milestone / bug / feature

Open a PR (or merge locally) from your personal branch **into `dev`**:

```bash
git checkout dev
git pull origin dev
git merge goblin             # resolve conflicts if any
git push origin dev
```

Then sync your personal branch with `dev` so you don't drift:

```bash
git checkout goblin
git merge dev
git push origin goblin
```

### Promoting to production

When `dev` is ready for release, merge `dev` → `main` (PR recommended).

## Cloudflare Pages previews

Each personal branch gets one stable preview URL via Cloudflare **branch aliases** (Pages project → Custom domains → add `goblin.hexworld.pages.dev` pointing at the `goblin` branch, same for `krunchee`).

Commit-hash previews (`abc123.hexworld.pages.dev`) still exist but are not the primary way to test — use your named branch URL instead.

## For Cloud Agents / automation

- **Personal branch:** ask the user which branch they work on (`goblin`, `krunchee`, or another personal branch). Confirm and use that for commits and pushes — do not assume a default.
- Do not create `cursor/<random>-6a49` branches unless explicitly asked
- Base PRs and merges on **`dev`**, not `main`, unless releasing
- Playtesting backlog and priorities: [ROADMAP.md](ROADMAP.md) § Bugs & testing feedback
- Complex implementation plans: write `design/MilestoneN.md`; keep ROADMAP milestone entries brief
