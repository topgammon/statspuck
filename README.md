# StatsPuck

Hockey intelligence platform. Live at statspuck.com (main branch) and staging.statspuck.com (staging branch).

## Layout

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Hub landing page at `/` |
| `src/app/draft-rater/` | Draft Rater module at `/draft-rater` |
| `src/components`, `src/lib` | Shared UI and data helpers |
| `data/draft-rater/` | Draft Rater JSON and `nhl.sqlite` (read at build time) |
| `pipelines/draft-rater/` | Python job that refreshes NHL data, grades, and share images |
| `public/draft-rater/og/` | Pre-drawn share images for every page |
| `public/logos/teams/` | Team logos shared by all modules |
| `functions/` | Cloudflare Pages Functions (headshot proxy for share cards, noindex on non-production hosts) |

## Build and deploy

Cloudflare Pages builds every push:

- Build command: `npm run build`
- Output folder: `out`
- `main` → statspuck.com, `staging` → staging.statspuck.com

`npm run build` runs `next build` (static export) and then removes Next's `.txt` payload files to stay under Cloudflare's 20,000 file limit.

## Data refresh

`.github/workflows/draft-rater-data.yml` runs nightly at 10:00 UTC, refreshes games and grades, and commits to `staging` only.

```bash
pip install -r pipelines/draft-rater/requirements.txt
python pipelines/draft-rater/run.py              # incremental
python pipelines/draft-rater/run.py --skip-fetch # regrade after editing gm_eras.json
```
