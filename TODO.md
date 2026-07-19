# TODO

## Rework

- Overall: Rework the quest and adventurers system. Add a new resource called Reputation.

- Adventurers/Mecenaries:
    - Add a new type of adventurers called Guild Mecenaries. These replaced the current adventurers system.
    - The new adventurers system will be just a number. We dont manage them directly.
    - The idea is you as the guild master, you manage them directly with their equipment and assign jobs. You dont control a lot.
    - Other adventurers are more numerous, who come and go, pick up quests posted by your guild. The number of adventurers will increase overtime as the town/guild grow and more quests completed.
    - Mecenaries currently wont do anything, will be develop later. That mean the equipment system will not be used at the moment.

- Quest system:
    - No more go to map tap and assign quest/patrol. Now, when you go to map tab and click on a location item, it will expand and show the location detail: name, monsters, gatherables, current quests. Monster loot now tied to monsters, not the location. Gatherables is tied to location.
    - At the map detail interface, you can create quest to post on guild: You can request monster/gatherable to be killed/collected, and the amount for each quest instance. The more material you requested, the longer it took and more gold you pay. NOTE: Both the time and money dont scale linearly, it more efficient in time and less efficient in gold to request more materials per quest. This provide a gold sink for player money.
    - Adventurers (the numerous one, not your mecenary) will pick up quests and do them. More adventurers mean more quests can be completed per second. Use a simple formula that take quest difficult (based on location), quest time and adventurer to calculate quest completed per second. Then, use this to compute material received and gold cost per second. Show this on quest UI so player know
    - Player can view all running quests at a new subtab in Guild tab, and can choose to delete them.
    - Keep the number of adventurer realistic for a small town, somewhere a few guys at first and grow to hundreads, but no more than that unless player played for a long time.
