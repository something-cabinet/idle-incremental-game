# TODO

## General UI
- [x] Move the tab to bottom of screen, like a navbar bottom. Locked tab (guild/map/inventory) should still occupy space, just hidden. — tab bar is now a fixed bottom navbar; locked tabs render invisible but keep their slot.
- [x] Add a detail view for adventurer, which open a popup show their equipment (and equipment info), their stat, xp level, more detailed info. — click an adventurer card to open the popup: stats with base/gear breakdown, XP bar, equipment per slot with unequip.

## SFX
- [x] Add sfx for clicking, notification — WebAudio-synthesized blip for button clicks, two-note chime for story beats/offline toast (no asset files); toggle in Settings.

## Progression balance
- [x] Add a few more gold maker option to buy — added Money Lender and Trading Company jobs after Trade Caravan.
- [x] Reduce the price and increase gold gain for first 4 jobs. Speedup early progression a bit. — costs roughly halved, production increased ~50-70% for Run Errands/Market Stall/Herb Garden/Workshop.
- [x] First quest should only be like 1 min and easy to win. Add more quests. — Forest Edge is now 60s at power 16 (~95% win chance for a fresh adventurer); added River Crossing and Sunken Ruins as two new zones, 6 zones total before Act 3.
- [x] Generally reduce duration for guild-activities (quest, patrol interval, recovery) to speed up the game. — quest durations cut ~5-8x across zones/bosses, patrol encounter interval 60s→20s, injury duration per tier 900s→180s.

## New features
- [x] QoL: Add by x5, x10, x100 buttons. — ×1/×5/×10/×100 selector in the Town tab, applies to jobs and workers (workers clamp to the cap).
- [x] QoL: Add a few debug buttons in options where I can change game speed, receive cheat gold, receive material so I can quickly test it. — Settings → Debug: game speed ×1–×50, +gold/+materials/+shards buttons. (Currently always visible; gate or strip before release.)
- [x] Upgrade section for town (divide the town tab into jobs and upgrades, like the guild tab) — Town tab split into Jobs/Skills subtabs; skill tree with two branches (Industry: flat gold + job %, Hustle: click flat/% and %-of-gps), parent node required to unlock the next, cost grows with depth, deeper nodes need materials, top nodes are one-time buys. Balance numbers are placeholders in `config.ts` → `TOWN_SKILLS`.

- Guild tab:
    - [x] Show progress bar and time left for adventurers who on quest and patrol. On quest is until they finish the quest. On patrol is until they get the next reward drop. Or recovering time.
    - [x] Show adventure xp percentage next to level.
    - [x] Add a log that show the quest result, patrol result — activity log at the bottom of the Guild tab with day stamps, phrase variation, loot lines (gold/materials/equipment names/shards/XP), injury and expedition lines; offline patrol rewards group into one line per adventurer; capped at 60 entries.
