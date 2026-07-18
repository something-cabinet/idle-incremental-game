# TODO

## General UI
- Move the tab to bottom of screne, like a navbar bottom. Locked tab (guild/map/inventory) should still occupy space, just hidden.
- Add a detail view for adventurer, which open a popup show their equipment (and equipment info), their stat, xp level, more detailed info.

## SFX
- Add sfx for clicking, notification

## Progression balance
- [x] Add a few more gold maker option to buy — added Money Lender and Trading Company jobs after Trade Caravan.
- [x] Reduce the price and increase gold gain for first 4 jobs. Speedup early progression a bit. — costs roughly halved, production increased ~50-70% for Run Errands/Market Stall/Herb Garden/Workshop.
- [x] First quest should only be like 1 min and easy to win. Add more quests. — Forest Edge is now 60s at power 16 (~95% win chance for a fresh adventurer); added River Crossing and Sunken Ruins as two new zones, 6 zones total before Act 3.
- [x] Generally reduce duration for guild-activities (quest, patrol interval, recovery) to speed up the game. — quest durations cut ~5-8x across zones/bosses, patrol encounter interval 60s→20s, injury duration per tier 900s→180s.

## New features
- QoL: Add by x5, x10, x100 buttons.
- QoL: Add a few debug buttons in options where I can change game speed, receive cheat gold, receive material so I can quickly test it.
- Upgrade section for town (divie the town tab into jobs and upgrades, like the guild tab):
    - Skills: 
        - Improve efficiency of jobs (add flat gold per second, increased by percetange, ..)
        - Improve clicking efficency (by a percentage of current gold per second, by flat amount, by percentage, ..)
    - Skill UI should be a tree-shape, with previous skill need to be unlocked to buy the next. Cost increased according to depth. Each skill can be buy multiple time to level up (to a cap). Powerful skill only have one.
    - Skills usually cost gold, but depend on context, some skill may need materials too.

- Guild tab:
    - Show progress bar and time left for adventurers who on quest and patrol. On quest is until they finish the quest. On patrol is until they get the next reward drop. Or recovering time.
    - Show adventure xp percentage next to level.
    - Add a log that show the quest result, patrol result:
        - Example: "[Adventurer name] acquired 2 pelts, 1 crystal, 1 new equipment (Black Iron Sword), 30xp from [quest name]".
        - Example: "[Adventurer name] injured and retreat from quest"
        - Example: "[Adventurer name] collected 5 herb and 2 pelt during patrol at [patrol location]"
        - Add some variation so it more fun to read.
        - Take into account offline progression too. Mostly Patrol since it can stay indefinitely. Just generate and group all the reward into a line.

