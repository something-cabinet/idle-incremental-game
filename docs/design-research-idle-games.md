# Designing a Great Idle/Incremental Game: Systems, Progression, and Theme Direction for a Cross-Platform (Mobile / Web / Steam) Release

## TL;DR
- **Win on systems depth and theme, not raw "numbers-go-up."** The novelty of big numbers is gone; the games that retain players for months (Melvor Idle, NGU Idle, Realm Grinder, Egg Inc.) layer *meaningful decisions* — prestige-currency math, interacting generators, build/faction diversity, and collection — on top of the core loop. Build your economy around a lifetime-vs-since-reset prestige formula (cube/square-root style), soft/hard caps, and staged unlocks introduced one variable at a time.
- **Ship one game, three monetization postures.** Web = free funnel and virality; mobile = free-to-play with *rewarded* ads plus time-warp/no-reset-prestige IAP (in-app advertising is ~60–70% of idle-game revenue and IAP ~30–40%, per adjoe); Steam = premium one-time purchase with no ads/no microtransactions (the Melvor Idle model), which is what the PC/idle-enthusiast audience actively rewards. Cloud saves should sync across all three.
- **Theme is a strong differentiator and cheap to change — pick one that "justifies the numbers."** The safest high-upside directions in 2025–26 are a *cozy/wholesome builder*, a *cultivation/xianxia ascension* fantasy (natively maps to prestige/rebirth), or an *absurdist/narrative* hook (Universal Paperclips, NGU). Use a flat-vector or clean pixel art style for cross-platform scalability and low production cost.

---

## Key Findings

1. **The core loop is solved; the meta-game is where games live or die.** Anthony Pecorella (Kongregate, producer on the AdVenture Capitalist mobile port) has repeatedly shown in his GDC 2015/2016 talks and three-part "Math of Idle Games" series that idle games have "some of the best-retaining games on all of Kongregate.com." What separates hits is interacting generators, layered prestige, and content unfolding — not the base clicker.

2. **Prestige math is the single most important design decision.** The choice between a *lifetime-earnings* formula (Cookie Clicker's cube root, AdVenture Capitalist's square root) and a *since-reset* formula (Egg Inc.'s ~1/7 exponent, Clicker Heroes' upgrade-count log) fundamentally determines whether players optimize for long idle runs or short active resets. This is the lever you tune first.

3. **Platform dictates system design more than theme does.** Session length, offline caps, monetization, and re-engagement differ sharply across mobile, web, and Steam. A single codebase can serve all three (Melvor, Cookie Clicker, Realm Grinder all do), but the tuning and the store-front business model must diverge.

4. **The premium Steam model is real and lucrative for depth-first idlers.** Melvor Idle sells for $9.99 on Steam with *no ads and no microtransactions*, holds a "Very Positive" rating with a Player Score of 90/100 from 15,753 total reviews (14,222 positive, 1,531 negative) per Steambase, and peaked at 9,566 concurrent Steam players on Sept 10, 2023 — while remaining free-with-ads on mobile/web. SteamSpy estimates 500,000–1,000,000 owners; third-party Boxleiter revenue estimates range from ~$2.7M to ~$6.7M gross (Steam-only, unofficial).

5. **Theme is a cheap, high-leverage differentiator.** Because idle games are "just numbers," reskinning is inexpensive, but strong theming is consistently cited (by developers and press) as the top differentiator. The best themes *diegetically justify* exponential growth and resets.

---

## DETAILS — PART 1: GAME SYSTEMS & PROGRESSION MECHANICS (Primary Focus)

### 1.1 The layered loop model: Hook → Habit → Hobby
Design against three time horizons, a framing common in idle best-practice writeups:
- **Hook (0–30 min):** immediate gratification, visible progress, first automation unlock. Your resource-per-minute display and achievement counter belong here.
- **Habit (1–7 days):** daily reasons to return, first prestige, secondary currency introduced.
- **Hobby (weeks–months):** deep systems, build diversity, collection, leaderboards/social.

A widely repeated rule of thumb is to aim for roughly **60% of progress from idle mechanics and 40% from active engagement**, so the game is accessible but rewards attention. Games that pace loops well report Day-7 retention of ~10–15% versus the ~8% casual benchmark.

### 1.2 The economic skeleton: currencies, generators, and growth curves
Pecorella's terminology is the industry standard:
- **Primary currency** — the main incrementing number.
- **Generators** — buildings/heroes/investments that produce currency automatically. Per Pecorella (GDC Europe 2016): "Costs grow exponentially `cost_next = cost_base × (rate_growth)^owned`; Production grows linearly `prod_total = prod_base × n_owned`." Costs grow magnitudes faster than value, which is what forces the prestige loop.
- **Primary exchange currency** — an intermediate layer (e.g., DPS in Clicker Heroes converted to gold by killing monsters) that gives you a control knob on the growth rate via the "exchange rate."
- **Multipliers** — upgrades that temporarily push production ahead of the cost curve.

**Two closed-form formulas every idle dev should hardcode** (Pecorella, Math of Idle Games Part I), valid for simple exponential growth:
- Cost to bulk-buy `n` generators, and
- Max generators affordable with current currency: `max = floor( log( (c(r−1)/(b·r^k)) + 1 ) / log(r) )`, where `b`=base price, `r`=growth rate, `k`=owned, `c`=currency.

**Exponential vs. logarithmic/polynomial:** Exponential growth (`n^x`, n>1) always eventually outpaces polynomial (`x^k`). The psychophysical reason exponential scaling *feels* good is the **just-noticeable-difference**: human perception is roughly logarithmic, so a constant *percentage* gain (e.g., every Creamery level +10% production, cost +15%) keeps each upgrade feeling equally meaningful against a rising baseline (Eric Guan, "Idle Game Design Principles"). Tune growth rates so cost growth slightly outpaces value growth, producing the natural progression-wall that motivates prestige.

**Soft caps and hard caps:**
- **Soft cap** = diminishing returns past a threshold (fractional-power/root formulas). Used to slow progress smoothly, extend longevity, and encourage build diversity. *Too Many Softcaps* is an entire game built on stacking these. Warning from the design community: opaque soft caps that players can't see or understand (as in the Panzer/Slitherine "soft cap" controversy) breed frustration — always surface them in tooltips.
- **Hard cap** = an absolute limit. Necessary for numeric stability (integer overflow) and to prevent broken builds, but hard caps at the end of content make the endgame feel dead unless paired with a new prestige layer.

### 1.3 Prestige / rebirth / ascension: the ladder-climbing engine
Prestige serves two purposes (Pecorella): (1) the "ladder-climbing" dopamine of resetting with a permanent multiplier, and (2) reining growth back into a number you can key new content off. **Note:** most prestiges are a *fractional exponent* (square/cube root), not a true mathematical log — Clicker Heroes is the rare genuine log-type effect.

Real prestige-currency formulas (Pecorella, Part III), with `c_L`=lifetime currency, `c_M`=max currency, `c_R`=this-run currency:
- **Realm Grinder (max earnings):** `p = (√(1 + 8·c_M/10^12) − 1) / 2` — derived from the quadratic formula. Resetting at the same point yields *zero* new currency; you must earn **4×** the previous run to double prestige currency.
- **AdVenture Capitalist (lifetime):** `p = 150·√(c_L/10^15)` — square root of lifetime; ~3–4× needed to double, but you *can* keep resetting at the same point for diminishing gains.
- **Cookie Clicker (lifetime, cube root):** `p = ∛(c_L/10^12)` — needs ~**8×** the previous run to double prestige (Heavenly Chips).
- **Egg Inc. (since-reset):** `Δp = (c_R/10^6)^0.14` — a ~1/7 exponent, so you need ~**128×** to double. This deliberately flattens the curve to nudge active play and compensate for the **2-hour offline cap**.

**Design guidance on *when* to introduce prestige:** don't ship it at launch-minute-one. Introduce the first prestige only after players hit the first natural progression wall (progress slows to ~10–20% of peak speed is the community rule for *when to reset*). Layer additional reset tiers (rebirth, ascension, "reincarnation" à la Realm Grinder, AdCap's Mega Bucks) gradually, each reining numbers in further. Egg Inc.'s Soul Eggs give a permanent +10% earnings each and stack with meta-systems (Eggs of Prophecy, artifacts) — a good model for making resets feel permanent and compounding.

### 1.4 Multiple overlapping currency systems
Layer three tiers, timing their introduction so each feels interconnected (not dumped at once):
- **Soft currency** (gold/cookies) — the moment-to-moment loop.
- **Prestige/meta currency** (Heavenly Chips, Soul Eggs, Angel Investors) — earned on reset.
- **Hard/premium currency** (gems) — the monetization layer; on Steam-premium builds this can be earned-only.

Eric Guan's cheese-idle postmortem adds a useful pattern: **loot-box-style payouts and per-generator "clocks"** (e.g., a Creamery produces every 30 min, caps at 10 uncollected, stops after 5 hours) that create natural re-engagement appointments *without* punitive energy systems.

### 1.5 Automation / auto-clicker unlocks
Automation is the genre's defining pleasure: going from frantic tapping to effortless income. Pecorella argues auto-clickers being "necessary" for serious play reflects a *design flaw*, not cheating — so **build automation in as an earned unlock** (managers in AdVenture Capitalist, Modron automation in Idle Champions). Pacing warning (Apptrove): automate *too early* and players disengage from boredom; *too late* and they churn. Make automation feel earned and upgradeable.

### 1.6 Skill trees, build diversity, and "horizontal" progression
The strongest retention comes from progression that unlocks *new playstyles*, not just bigger numbers (Gamescrye; Forager's Mariano Cavallero: "Getting a +10 percent mining skill is way less fun than getting a new pickaxe that causes rocks to explode"). Mechanisms:
- **Faction/allegiance systems** (Realm Grinder's Elves/Demons/Angels/Undead, each with distinct scaling) force strategic re-optimization each run.
- **Skill webs** (Melvor Idle's 20+ interacting RuneScape-style skills where "every skill serves a purpose, interacting with the others").
- **Formation/positional synergy** (Idle Champions' grid formations, adjacency buffs, Base Ultimate Damage) — this is your "team synergy" mechanic realized.

### 1.7 Gacha / collection mechanics
Collection is a top motivator. In Pecorella's GDC Europe 2016 "Quest for Progress" talk, citing Quantic Foundry: "surveyed players of 3 idle games — 70% identified as 'core gamers', 20% as 'hardcore' — Top motivators were Completion and Power." Fold collection into the mechanics:
- **AbyssRium** ties milestone multipliers to *buying fish*, making collection the progression.
- **Idle Heroes** ($100M+/year) uses "Faction Auras" — roster-composition bonuses — to motivate collecting and upgrading a *diverse* roster, plus embeds idle-progress collection into the core loop (not just app-open) to reinforce retention.
- **Idle Champions** keeps its chest/gacha "benign": free gear chests plus pity mechanics guaranteeing every rare/epic in finite tries — a model that avoids predatory perception while retaining collection depth.

### 1.8 PvP / leaderboards, guilds, and social systems
Pecorella's later talks emphasize social features (multiplayer, guilds) as engagement multipliers. Options in ascending complexity: async leaderboards (event scores, prestige-count ladders), guilds/clans with shared goals, and idle-MMO market economies (Idle Clans, Milky Way Idle, Idlescape). Add these *late* in your roadmap — they raise server/ops cost and are unnecessary for the first launch.

### 1.9 Event / seasonal content systems
Live events are now standard for sustaining idle retention and revenue: Cookie Clicker's seasonal events generate unique building skins; its 2025 "Pantheon Rework" added seasonal deity cycles that change optimal strategy monthly. Idle Champions runs weekend events tied to D&D crossovers with time-limited champion unlocks. Seasonal content drives spending spikes (one market report cites 340–480% transaction-velocity increases during limited-time cosmetic windows — a vendor estimate, treat as directional). For a small team, start with lightweight recurring events (rotating modifiers, limited-time cosmetics) before full battle passes.

### 1.10 How the standout games structure progression — quick teardown
- **Cookie Clicker (2013, Orteil):** the genre's clearest design statement; exponential building tiers, Heavenly-Chip cube-root prestige, hundreds of achievements ("milk %"), absurdist escalation. Zero monetization, still free after 13 years. Lesson: achievements + humor + clean prestige.
- **AdVenture Capitalist (2014, Hyper Hippo):** polished tycoon theme, managers = automation, Angel Investor square-root prestige, pioneered robust offline earning. Lesson: theme + presentation + a compelling early x3 multiplier IAP (one of Kongregate's highest buyer %).
- **Egg Inc.:** 2-hour offline cap + flat since-reset prestige forces active play; sub-prestige tiers (~5× each); artifacts/contracts add meta. Lesson: offline caps and prestige curve are *coupled* design decisions.
- **Melvor Idle (2021):** RuneScape-style skill web, offline banking (24h at full rate), cross-platform cloud saves, premium no-MTX. Lesson: depth + fair monetization = "Very Positive" and durable PC sales.
- **NGU Idle:** "Numbers Go Up" — 20+ layered systems (Blood Magic, Time Machine), rebirth resets, absurdist humor; "spreadsheet-shaped" optimization depth beloved by the r/incremental hardcore.
- **Realm Grinder:** factions + reincarnation + research; "management sim disguised as a clicker."
- **Antimatter Dimensions:** pure number-go-up done impeccably; dimensions feeding dimensions, layered resets (Infinity, Eternity, Reality); free everywhere.
- **Universal Paperclips (2017, Frank Lantz):** narrative incremental; evolving mechanics across three acts, finite ~3–6h completion, philosophical AI theme. Lesson: theme + evolving mechanics + an *ending* can be a feature.
- **Idle Champions:** formation/positional strategy, D&D license, benign gacha, cosmetic monetization.

### 1.11 Platform-specific system design

| Dimension | Mobile | Web/Browser | Steam/PC |
|---|---|---|---|
| **Session assumption** | Many short check-ins; notification-driven | Background tab, "one eye on it" | Long sessions, second-monitor "always on" |
| **Offline cap** | Shorter/capped (e.g., Egg Inc. 2h) to drive re-engagement + ad views | Moderate | Generous (Melvor banks 24h at full rate) |
| **Monetization** | F2P: rewarded ads (~60–70% of idle revenue) + IAP (time-warp, no-reset prestige, ad removal, cosmetics) | Free funnel/virality; optional cosmetics | Premium one-time purchase; no ads/no MTX |
| **Re-engagement** | Push notifications (behavior-triggered, deep-linked) | Browser can't push reliably | Steam achievements, cloud saves, Steam notifications |
| **Integration** | App-store IAP, ad SDKs (AdMob/ironSource/AppLovin) | — | Steam achievements (Cookie Clicker has 600+), cloud sync, trading cards |

**Monetization detail (mobile):** The genre-standard "Basic Three" IAP (Pecorella): **Time Warp** (jump ahead hours/days — scales perfectly with exponential growth, deeply discountable for long warps), **No-reset Prestige** (claim prestige benefits without starting over — AdVenture Capitalist, Taps to Riches), and multiplier boosts. Rewarded video ("double your offline earnings," "watch to 2× income") is the least intrusive because it's opt-in — rewarded eCPMs in the US run ~$10–15. Per adjoe's idle-games breakdown, "in-app advertising for idle mobile games makes up around 60 to 70 percent" of revenue and "in-app purchases generate around 30 to 40 percent," with rewarded video cited as "one of the best ad formats for idle games." Depth-first titles can flip to IAP-dominant (one teardown cites a title where only 38% of revenue was ads, with paying players' LTV 2.6× non-payers).

**Re-engagement detail:** Push notifications are one of the few owned re-engagement channels; best practice is behavior-*triggered*, personalized, and deep-linked (not calendar blasts). Per Localytics (PR Newswire release on iOS 10 rich push): "65% of users returned to an app in the 30 days after the app's initial download if they have push enabled, whereas only 19% of those without push enabled return the following month." Median mobile Day-7 retention sits at ~3.4–3.9% (top quartile ~7–8%) per GameAnalytics 2025 — but **idle games structurally over-index**, with a ~38% DAU/MAU ratio vs. ~22% for mobile overall. On iOS push is opt-in (ask *after* showing value, not on first launch); on Android it's default-on.

**Steam-specific:** The Melvor developer (Brendan Malcolm) has been explicit that the Steam version costs money precisely because "Steam will not let me advertise my Patreon or Donation links" and the paid model "keeps In-App purchases AWAY from this game." Steam achievements (Cookie Clicker's 600+) and cross-platform cloud saves are the main integration levers. Steam idle releases grew sharply year-over-year (one report cites 89% YoY growth in 2025 — vendor estimate).

### 1.12 Progression pacing / balancing frameworks
- **Model in spreadsheets first.** Pecorella's public idle-math spreadsheets simulate optimal buy order (best income:cost ratio at each step) and prestige cadence; use them to find where runs get "bumpy" (fast/slow sections) and place multiplier milestones (e.g., at 25/50/100/300/400/500 generators owned) to create satisfying acceleration bursts.
- **Tune by percentage, not absolute.** Because perception is logarithmic, tune with multipliers (+10% production / +15% cost) rather than hand-set numbers. The Idle Idol postmortem is a cautionary tale: hand-tuning every upgrade cost worked early but broke in the late game — they had to return to formulas.
- **Introduce one new variable at a time** (a new currency, then automation, then prestige) to avoid overwhelming players (Apptrove).
- **The prestige-timing target:** design so the "optimal" reset lands when progress slows to ~10–20% of peak — and communicate the prestige payoff clearly. One studio found a large pre-prestige drop-off was caused by players not understanding the button; a tooltip + animated preview yielded a 19% Day-7 retention uplift (vendor case study).

### 1.13 Common pitfalls & anti-patterns to avoid
1. **Numbers-go-up with no decisions.** "The novelty of big numbers on their own is largely gone" (Pecorella). Provide optimization choices (what to prestige for, which tree compounds best, which generator to skip).
2. **Automating too early / prestiging too often.** Both flatten the dopamine loop; pace unlocks.
3. **Opaque soft caps and hidden walls.** Surface diminishing returns and reset math in tooltips.
4. **Purely vertical progression** (only +stat upgrades). Add horizontal unlocks (new mechanics, playstyles) — the Forager lesson.
5. **Over-monetization / early paywalls.** The single most-cited churn driver; "long-tail earnings" beat "applying the thumbscrews" (Machinations). Perceived greed makes players migrate.
6. **Hand-tuned economies that don't scale** (Idle Idol).
7. **Forced ads / forced appointment mechanics.** Rewarded/opt-in ads retain; forced interstitials and energy timers repel the core idle audience (who dislike social-game constructs).
8. **Front-loading complexity.** Idle's strength is *unfolding*; a wall of systems at launch kills the hook.

---

## DETAILS — PART 2: THEME & ART DIRECTION (Strong Secondary Focus)

### 2.1 Why theme matters and how it "justifies the numbers"
Kotaku's Nathan Grayson observed the genre "adopts themes and aesthetics of more complex games" to appeal to core gamers, and supports huge thematic variety (fantasy, sci-fi, even erotica). The design goal: pick a fantasy where **exponential growth and periodic resets are diegetically natural**, so the meta-loop feels earned rather than arbitrary. Idle games split into three dominant commercial formats — **idle RPG** (hero collection/auto-battle), **idle tycoon** (business empire), and **idle miner/extraction** — with theme driving audience demographics (e.g., mining skews male; cozy/farming and pet themes skew more female per publisher data).

### 2.2 Theme survey

**Fantasy / RPG (most crowded, most proven).** Examples: Melvor Idle, Realm Grinder, NGU Idle, Idle Champions, AFK Arena/Journey, Idle Heroes, Firestone, Soul Strike. Resonance: familiar RPG power fantasy, gear/loot dopamine, hero collection. Currency fantasy: gold from slain monsters → gear → deeper zones; prestige = "new hero awakening"/reincarnation. *Verdict: high demand but you must differentiate on systems (factions, skill webs) or theme twist.*

**Sci-fi / space / factory.** Examples: Egg Inc. (sci-fi egg empire), Universal Paperclips, Spaceplan, Cell to Singularity, ExoMiner, Rocket Star, Unnamed Space Idle, Dyson-sphere-style builders. Resonance: "builder" satisfaction of a production chain spun up from nothing; scale (planets → stars → galaxies) natively justifies astronomical numbers. Currency fantasy: energy/minerals → automation → interstellar expansion; prestige = new tech epoch or von Neumann replication.

**Business / tycoon.** Examples: AdVenture Capitalist/Communist, Idle Miner Tycoon, Tap Tycoon, Bit City. Resonance: rags-to-riches, satirical capitalism. Currency fantasy: money is *literally* the number; prestige = "angel investors"/going public. *Very legible to new players; crowded on mobile.*

**Cooking / restaurant / food.** Examples: Eatventure, Pizza Ready!, Cat Snack Bar, Burger Please, arcade-idle food games (Homa/Supercent). Resonance: tangible, universally understood, cozy. Strong in the **arcade-idle hybrid** segment (~50% D1 retention, ~25-min D0 sessions, ~$0.40 CPI per SensorTower/Homa data). Currency fantasy: serve → upgrade → franchise expansion; prestige = new restaurant/location.

**Farming / agriculture.** Examples: Idle Bee Factory, farming arcade-idlers, cozy orchard builders. Resonance: calming, "comfort-food" background play, growth metaphor is literal. Skews to a broader/more female demographic.

**Post-apocalyptic / survival.** Adjacent hits (Fallout Shelter; strategy-survival Whiteout Survival, LastWar earning $800M+/6mo). Resonance: rebuild-from-ruins tension, scarcity→abundance arc. Currency fantasy: scavenge → rebuild → repopulate; prestige = "new settlement." *Underexplored in pure-idle form.*

**Cozy / wholesome.** Examples: cozy café/aquarium/village builders; "Mushies" (cozy-complex village). Resonance: 2025–26's strongest casual trend; low-stress "quiet-tab companion." Currency fantasy: nurture and decorate; prestige can be reframed gently (seasons, "new garden") to avoid the punitive feel of a reset.

**Absurdist / comedy.** Examples: Cookie Clicker, NGU Idle, AdVenture Capitalist, Universal Paperclips, Leaf Blower Revolution. Resonance: humor carries the grind; "you should feel mildly ridiculous for caring this much, and that's the point." Currency fantasy: the *joke* is the escalation (cookies → antimatter → the cosmos). Cheap to produce, high virality.

**Historical / civilization.** Examples: Kittens Game (village → society → space), Cell to Singularity, Microcivilization. Resonance: tech-tree/"just one more unlock" progression; educational appeal. Currency fantasy: gather → research → advance epochs; prestige = new age/dynasty. Deep but text-heavy.

**Monster collecting / pets.** Examples: Tap Tap Monsters, Idle Pet Shop, Summoner's Greed, mushroom-hero idlers. Resonance: collection + companion attachment; broad appeal. Currency fantasy: catch → train → evolve; prestige = "release/rebirth."

**Cultivation / xianxia (trending, natively idle).** Examples: proliferating browser/itch xianxia idlers (Cultivators Chronicles, Idle Xianxia). Resonance: the cultivation fantasy — Qi Gathering → Foundation → Golden Core → Nascent Soul → ascension — **is structurally a prestige ladder**, making it the most theme-mechanic-aligned option. Strong pull with the web-novel/manhua audience; still under-served by polished, well-produced titles.

**Music-industry / other novel niches.** Retro-futuristic record-label idler (sign artists → streaming numbers tick up), and math-native themes (Exponential Idle). These niche hooks stand out in crowded feeds.

### 2.3 Underexplored / trending niches (2025–26)
- **Cultivation/xianxia done *well*** — huge amateur supply on itch.io, little polished cross-platform product; the theme *is* the prestige system.
- **Cozy-complex hybrids** (cozy skin, real optimization depth) — the "Mushies" niche; low-stress framing with hardcore mechanics.
- **Narrative/finite incrementals** — Universal Paperclips proved story + an ending is a selling point; underused on Steam.
- **AI-adaptive/procedural content** — early entrants use procedural quests/loot and live-tuning of offline pacing; nascent and buzzy but unproven (treat marketing claims skeptically).
- **Arcade-idle hybrids** — the fastest-growing mobile sub-segment (Homa, SayGames, Supercent), mixing a light active core with idle meta; strong CPI/retention economics.

### 2.4 Art style vs. production cost vs. cross-platform fit
| Style | Rel. cost | Cross-platform fit | Player perception | Notes |
|---|---|---|---|---|
| **Flat / vector** | Low | **Excellent** (scales to any DPI/screen without quality loss) | Clean, modern, casual | Best default for mobile+web+Steam; can feel "too minimal" without gradients/lighting |
| **Pixel art** | Low–moderate (deceptively skill-heavy to animate) | Good, but sprite scaling on hi-DPI needs care | Nostalgic, indie, readable | Idle Slayer-style auto-runners; strong on Steam |
| **Cartoon / hand-drawn illustration** | Moderate–high (frame-by-frame is costly) | Good | Characterful, premium | NGU/AdCap charm; reserve for character-driven RPG/absurdist themes |
| **Minimalist UI / text** | Very low | Excellent | "Spreadsheet," hardcore-friendly | Universal Paperclips, Kittens Game — proves graphics aren't required |
| **Low-poly / 3D** | Moderate–high | Heavier on mobile hardware | Atmospheric | Rarely needed for idle; adds cost without clear retention benefit |

Guidance: for a solo/small team shipping to all three platforms, **flat-vector or clean pixel** maximizes scalability and minimizes cost, while a distinctive *art direction* (palette, character design, UI polish) — not fidelity — is what differentiates. Match style to theme (pixel↔retro/RPG, vector↔cozy/tycoon, minimalist↔absurdist/narrative). Art should preserve **gameplay clarity** (readable numbers, distinguishable generators) above all.

---

## RECOMMENDATIONS

**Stage 0 — Prototype the economy (before art).**
1. Build Pecorella's spreadsheet model. Choose your prestige formula based on desired play pattern: **lifetime cube-root (Cookie Clicker-style)** if you want long idle runs and generous offline; **since-reset low-exponent (Egg Inc.-style)** if you want shorter, active resets and a tight offline cap. For a cross-platform game aiming to satisfy both casual mobile and hardcore PC, start with a **lifetime square/cube-root primary prestige** and reserve a **since-reset secondary layer** for later.
2. Lock a single-codebase engine (HTML5/Unity) that exports to web, iOS/Android, and Steam, with **cloud saves from day one**.

**Stage 1 — Soft launch (mobile + web), minimum viable meta.**
3. Ship the Hook→Habit loop: core generators, resource/min display, achievements, first automation, and *one* prestige layer introduced at the first wall.
4. Monetize gently: rewarded ads ("2× offline") + the "Basic Three" IAP + ad-removal. Avoid forced ads and energy timers.
5. Instrument retention (D1/D7/D30, DAU/MAU) and prestige-funnel drop-off. **Benchmark to beat:** idle D7 ~10–15%; DAU/MAU well above the ~22% mobile norm (idle structurally hits ~38%).

**Stage 2 — Layer the meta gradually (respond to data).**
6. Add build/faction diversity or a skill web (the biggest retention lever), then collection, then a second prestige/rebirth tier — one variable at a time.
7. Add lightweight recurring events before any battle pass. Add social/guilds/leaderboards only once core retention is proven (they add ops cost).

**Stage 3 — Steam release as premium.**
8. Launch on Steam as a **one-time purchase (~$9.99), no ads, no microtransactions**, with Steam achievements and cross-platform cloud saves — the Melvor model that the PC idle audience rewards (Melvor: Player Score 90/100 from 15,753 reviews; 500k–1M SteamSpy owners). Keep mobile/web free-with-ads; let a Steam/premium purchase unlock the ad-free version cross-platform via cloud account.
9. Monetize post-launch via **paid expansions**, not MTX.

**Theme & art decision:**
10. **Primary recommendation:** a **cultivation/xianxia ascension** or **cozy-complex builder** theme — both natively justify prestige/reset and are under-served by polished cross-platform products. **Safer commercial fallback:** a differentiated **idle RPG** (faction/skill-web driven) or **cooking/tycoon** (proven mobile economics). Use **flat-vector or clean pixel** art with a strong, consistent art direction.

**Thresholds that would change the plan:**
- If soft-launch D7 < ~8% or DAU/MAU < ~25%, the *core loop/first-prestige pacing* is wrong — fix before adding systems.
- If ad ARPDAU underperforms but paying-player LTV is high, tilt toward IAP/premium (some idlers are IAP-dominant with LTV 2.6× on payers).
- If the chosen theme isn't driving install/CTR lift in soft launch, reskin — theme is cheap to change, systems are not.

---

## CAVEATS
- **Revenue/market figures are mixed-reliability.** Idle-game "market size" reports ($13.2B in 2025, 8.7% CAGR, etc.) come from commercial market-research vendors with divergent methodologies and should be treated as directional, not authoritative. Melvor Idle's revenue figures are **third-party Boxleiter estimates, Steam-only, and diverge widely (~$2.7M vs ~$6.7M gross)** — there is *no* official Jagex disclosure; SteamSpy's 500k–1M owner band and Steambase's review/concurrent figures are the most reliable public data points.
- **Vendor/blog claims flagged in-text** (e.g., 340–480% event spending spikes, 19% retention uplift, 89% Steam YoY growth, AI-adaptive idle claims) come from marketing/analytics vendors or SEO content and are illustrative, not peer-reviewed.
- **Formulas are archetypes, not copy-paste balance.** The Cookie Clicker/AdCap/Egg Inc./Realm Grinder formulas are reverse-engineered by the community and Pecorella; your constants (the 10^12, 10^15 anchors, exponents) must be re-tuned to your content length and offline-cap decisions.
- **Retention benchmarks vary by source and date** (GameAnalytics 2025 medians vs. older Localytics/OneSignal figures). Use them as ranges.
- **The genre carries ethical scrutiny.** Idle loops share operant-conditioning/variable-ratio mechanics with gambling; the premium/no-MTX and rewarded-only-ads postures recommended here are both commercially proven *and* the most defensible against "predatory design" criticism.
- One flagged claim (a note.com post alleging a Melvor a16z "$2.8M seed / Feb 2025 launch") appears erroneous and was excluded.
