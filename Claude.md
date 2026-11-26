#### CLAUDE.md — StatsPuck (statspuck.com)

#### 1. Founder & Working Rules (CRITICAL — READ FIRST)

* **User Profile:** The founder is a creative visionary with **limited technical proficiency**. Never explain low-level code syntax, terminal internals, or boilerplate unless asked. Keep all communication simple, concise, and plain-English.
* **Mandatory Post-Task Summary:** After **every** completed prompt or task, ALWAYS output a short, scannable **bulleted list of everything you changed, added, or fixed** in plain language so the founder can review and approve before moving on.
* **Hands-Off Automation:** Use available MCP tools and CLI integrations (GitHub, Cloudflare, database migrations) to handle deployments, commits, and schema updates directly without asking the founder to manually configure dashboards unless a secret/login is strictly required.
* **Branching & Live Staging Workflow:** 

  * **NEVER ask the founder to test locally (localhost).** All testing is done live in the browser on the **staging** branch URL (staging.statspuck.com / Cloudflare Pages preview).
  * Always commit and push work-in-progress updates to the **staging** branch first. Only merge/push to **main** (production statspuck.com) when the founder explicitly approves.
* **Cost Discipline:** Keep infrastructure on free tiers (**$0–$10/mo max**) using free NHL APIs, Cloudflare Pages, Cloudflare D1 / SQLite, and GitHub Actions. Never introduce expensive paid third-party APIs without explicit approval.

#### 2. Project Vision: The "Stockfish / GTO Wizard" of Hockey

**StatsPuck (statspuck.com)** is a unified, modular hockey intelligence platform that boils complex hockey decisions down to clear, objective, math-backed insights—serving hardcore fans, fantasy players, player agents, and hockey front offices. 

#### Core Design Principle: Unified Entity Architecture

* Every **Player**, **Team**, **GM**, and **Coach** has **one canonical profile page** with a persistent **Top Bio Card** and **Module Context Tabs** (Overview | Draft | Development | Asset Value | Luck & Variance | Chemistry | Matchups).
* Entering a profile from a specific module (e.g., clicking a player from Draft Rater vs. Trade Machine vs. Injury Report) automatically opens that module's tab while keeping the persistent Bio Card and cross-module navigation one click away.
* **Core Currency — Impact:** Standardize our core on-ice value metric under the name **Impact** (evolved from Quality Games: regular-season games weighted by positional ice time, role usage, and box-score/play-by-play impact).

#### 3. StatsPuck Visual Identity & Brand Kit

Maintain strict visual congruency across every page, chart, table, and share card: 

* **Color Palette (Dark-Mode Editorial + Neutral Hockey Accents):** 

  * **Primary Canvas Background:** Obsidian Black (#0B0D10)
  * **Elevated Cards / Panels:** Carbon Slate (#14171F) with subtle 1px solid #262B36 borders
  * **Primary Text:** Crisp White (#F8FAFC) | **Secondary Muted Text:** Cool Gray (#94A3B8)
  * **Brand Primary Accent:** StatsPuck Crimson Red (#E11D48)
  * **Neutral Analytics Accent:** Ice Cyan (#38BDF8) — used for secondary chart lines, active tabs, and neutral highlights so the site never favors any single NHL team's colors.
  * **Semantic Badge & Grade Colors:** 

    * ELITE / A+: Championship Gold (#F59E0B)
    * STEAL / Positive Delta: Emerald (#10B981)
    * LATE BLOOMER: Violet/Purple (#8B5CF6)
    * STALLED: Amber/Orange (#F97316)
    * BUST / Negative Delta: Crimson Red (#EF4444)
    * DEVELOPING: Ice Blue (#3B82F6)
    * RETIRED: Vintage Slate (#64748B)
* **Logo Handling on Dark Mode:** Because the StatsPuck geometric stick-and-puck logo contains black linework, always render it inside a **clean white or light-frosted badge container** (or with a crisp white vector outline) in the top navbar and share card footers so it remains high-contrast on #0B0D10.
* **UI Standards Across All Modules:** 

  * All data tables must have **sticky <thead> headers**, **ascending-first click sorting**, and **hover tooltip bubbles** on non-obvious metric headers.
  * All player headshots use https://assets.nhle.com/mugs/nhl/latest/{playerId}.png with an automatic fallback to our local silhouette SVG, routed through a CORS-safe proxy for share card PNG exports.
  * Every module page must include a **Share Card Modal** supporting Landscape (1200×630) and Square (1080×1080) PNG export, clipboard copy, social share links, and statspuck.com branding.

#### 4. Recommended Tech Stack

* **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
* **Hosting & CI/CD:** Cloudflare Pages (auto-deploys staging branch to staging URL and main branch to statspuck.com)
* **Database:** Cloudflare D1 (Serverless SQLite) or Turso SQLite (zero-cost, zero-maintenance, fast read performance)
* **Automated Data Pipelines:** GitHub Actions cron jobs pulling free NHL API endpoints (api-web.nhle.com) for rosters, draft picks, box scores, play-by-play logs, and injury/status updates.

#### 5. Product Roadmap (Phased Execution)

#### Phase 1: Foundation & Draft Rater Migration (/draft-rater)

* Migrate the existing **Draft Rater** tool from stuffthatslaps into this new statspuck repository under /draft-rater (with a unified statspuck.com hub landing page at /).
* Preserve all calibrated Draft Rater rules: 

  * **Full-Career Impact (Quality Games)** vs. draft-slot expected curve (D+1 through D+21+), with current-season Season_Progress proration for active players and full cohort Expected for inactive/retired players.
  * **Asymmetric Scouting Skill Weighting** for Team & GM grades (penalizing Top-20 busts up to 2.5x, capping consensus Top-15 hits at 1.0x, boosting Round 2–7 hits at 1.35x, dampening outliers above +600, and applying GM sample-size confidence).
  * **Stamp Badges:** DEVELOPING (< 25 Impact in D+1–D+3 skaters / D+1–D+5 goalies), STALLED (D+4–D+5 1st-rounders below C-), BUST (D+6+ 1st-rounders below C-), STEAL (Pick #20+ with A/A+ or +200+), LATE BLOOMER (Score < 0 through D+4, crossing > 0 in D+5+), ELITE (3+ seasons 105+ Impact, 850+ career or 1.15+ rate, 0.80+ PPG for forwards; 3+ seasons 60+ Impact and 450+ career or 1.05+ rate for goalies), and RETIRED (isActive === false + 25+ GP + D+7+).

#### Phase 2: Development Path Lab & Prospect Projections (/development)

* Interactive league-pathway flow visualization (CHL, NCAA, USHL, AHL, SHL, Liiga, KHL → NHL) showing NHL graduation probabilities by draft slot and age.
* **"Make The Show" Path Optimizer:** Advises prospects and player agents on optimal next-step league routes based on historical cohort success rates.
* Separate **Team/GM Development Grade** (how well a franchise develops picks post-draft) from **Drafting Grade**.

#### Phase 3: Player Archetypes, Luck Meter & Asset Valuation (/trade-machine)

* **Auto-Classified Player Archetypes:** Algorithmically assign role badges (Sniper, Playmaker, Two-Way, Power Forward, Puck-Moving D, Shutdown D) from shot/box-score rates, plus tiered prospect projection badges.
* **Luck & Variance Meter (Players, GMs, Coaches):** Quantifies factors outside an individual's control—injury man-games lost, on-ice shooting/save percentage swings (PDO), and linemate quality—to show whether someone's results are depressed or inflated by luck.
* **Asset Valuation & EA-Style Trade Machine:** Values every player (Projected Impact / $1M Cap Hit, term, age curve, injury risk) and draft pick on one universal scale, powering an interactive **Trade Simulator**, **Historical Trade Grader**, and **Contract Comparable Engine** for agent/front-office use.

#### Phase 4: Pregame Tactical Matchups, Goal Types, Goalies, Chemistry & Refs

* **Goal-Type & Pregame Matchup Lab (/matchups):** Derives goal types (rebounds, rush chances, tips/deflections, cross-ice/royal-road) from NHL play-by-play event coordinates and timestamps to surface actionable pregame edges.
* **Goalie Tendency Deep-Dive (/goalies):** Splits goalie Impact and SV% by shot type, ice location, arena, fatigue, and rebound control.
* **Line Chemistry & Roster Balance (/chemistry):** Evaluates archetype combinations and on-ice shift synergy.
* **Ref Transparency Reports (/refs):** Analyzes referee crew assignments, call tendencies, and home/away or team-specific penalty differentials to compute a pregame **Ref Edge**.