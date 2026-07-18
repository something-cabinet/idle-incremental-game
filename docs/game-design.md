# Game Design — Narrative RPG Management Idle (canonical)

The designer's vision, recorded 2026-07-20. This overrides placeholder systems;
mechanics below are the target. Balance numbers in code are AI-proposed
placeholders until playtested.

## Pillars

- **Narrative RPG management idle.** One main resource (gold) plus sub-resources
  (materials, monster drops). Numbers stay relatively low — no scientific
  notation needed.
- **Core gameplay changes significantly between acts** (the Spaceplan/Universal
  Paperclips "paradigm shift" structure — see `spaceplan-framework-notes.md`).
- **Finite ending** after a few prestiges.

## Acts

### Act 1 — Refugee
Player flees to a small town and earns money. Loop: odd-jobs clicking + buying
income sources (reskin of the classic click/generator loop).

### Act 2 — Guild Leader
Rich enough to become the town's de facto leader; founds the Guild.
- **Workers**: just a number; increase town resource production. Town idle loop
  stays Act-1-like.
- **Adventurers**: limited roster (grows 2 → ~8). Each is a distinct randomly
  generated character with stats and equipment.
- Send adventurers to **locations** to farm monsters. Kills drop materials +
  XP; rare equipment drops; occasional **chests** (guaranteed equipment or
  gold treasure).
- Two assignment modes:
  - **Quest** — takes a set time; big rewards + equipment at the end; the
    adventurer then auto-switches to patrol.
  - **Patrol** — infinite; XP + material drops, rarely equipment.
- **Combat risk: injury only.** Lost fights injure adventurers; they rest and
  recover over time. No permadeath.

### Act 3 — Revenge & Time Travel
Guild territory expands until the player tracks back to their home town —
devastated by the demon king's legion. Send **expeditions** against the demon
king's generals, then the demon king himself. After victory, the player finds
the **time crystal** in the demon king's chamber: they can travel further into
the past, rebuild the guild, and try to defeat the demon king BEFORE he razes
the hometown. **This is the prestige system.**

### Ending
If the player defeats the demon king **before the time limit** (achievable
after a few prestiges), they save the hometown — but only in that timeline.
They watch their alternate-timeline self live happily with their family, and
find peace. End of game.

- **Time limit is in-game days** (a run calendar, e.g. "the legion razes the
  hometown on Day N"). Days tick with played + offline time.

## Prestige currency — Time Shards

Adventurers can find **Time Shards**; they persist across timelines and buy
permanent perks and multipliers.

## UI

Standard idle UI for upgrades/inventory management, plus (later) a small
**town overview window**: the town visually grows from small to large,
adventurers come and go — reflecting the player's upgrades. Design later;
architecture should keep it in mind (render layer reads game state, likely
PixiJS/canvas).
