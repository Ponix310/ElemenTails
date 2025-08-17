1. **ElemenTails — Master Rules**

Source of truth for gameplay rules. If a mechanic is not documented here, it is not considered part of the game. When in doubt, consult the designer before adding new behavior.

Version: 0.1 (Template)

Owner: Ponix | Last updated: (8/14/25)

2. **Overview & Core Concepts**

Premise: 1-4 Player Co-op Roguelike Strategy RPG

Victory Conditions: Defeat the Shadow Dragon

Defeat Conditions: All players become Corrupted.

Turn Structure: 1: Party Select \> 2: Map/Shop phase \> 3: Combat \> 2 \> 3 \> 2 \> 3 until victory or defeat.

Players should not expect to win the game guaranteed. Beating the full game should take a good amount of strategy and coordination and feel like a real accomplishment.

**Corruption**

There is no actual “Health” system in the game. Instead there is “Corruption”. It functions very similarly to how Health would. Every enemy in the game has a “Corruption Level”. When players attack enemies they are actually instead “attacking their corruption” directly. Once an enemy reaches 0 Corruption (basically similar to 0 health) they are Cleansed, and leave the battle. Players start at 0 Corruption, and if they ever reach 10 they go Berserk. This means they get one last round of battle, with one extra dice roll, then become Exhausted and are unable to rejoin the battle. If all 4 heroes become Exhausted it’s Game Over.

3. **Elemental System**

Affinities and interactions are defined numerically in the Data Sheet. This section explains the logic in words.

There are 6 Elements: Fire, Water, Plant, Air, Lightning, and Earth

4. **Classes & Weapons**

When the game starts, players draw 4 of the 9 total weapons at random. They then decide which combination of classes to choose for the run.

Each Hero (Fox, Frog, Rabbit, etc) and each Weapon (Daggers, Spear, Bow, etc) are represented by one element. 

Each Class is a specific combination of 1 Hero and 1 Weapon (The Hero grants the “primary element” the weapon grants the “secondary element”). 

Each Weapon is equippable by exactly 2 Heroes. All classes are as follows:

* Monk (Fire \+ Fire) | Fox \+ Knuckles

* Summoner (Fire \+ Plant) | Fox \+ Tome

* Assassin (Fire \+ Lightning) | Fox \+ Daggers

* Wizard (Water \+ Water) | Frog \+ Staff

* Berserker (Water \+ Fire) | Frog \+ Knuckles

* Myrmidon (Water \+ Earth) | Frog \+ Spear

* Cleric (Plant \+ Plant) | Rabbit \+ Tome

* Druid (Plant \+ Water) | Rabbit \+ Staff

* Bard (Plant \+ Air) | Rabbit \+ Bow

* Archer (Air \+ Air) | Raven \+ Bow

* Battlemage (Air \+ Water) | Raven \+ Katana

* Reaper (Air \+ Fire) | Raven \+ Greataxe

* Ninja (Lightning \+ Lightning) | Wolf \+ Daggers

* Samurai (Lightning \+ Water) | Wolf \+ Katana

* Paladin (Lightning \+ Plant) | Wolf \+ Sword & Shield

* Lancer (Earth \+ Earth) | Bear \+ Spear

* Barbearian (Earth \+ Fire) | Bear \+ Greataxe

* Warrior (Earth \+ Plant) | Bear \+ Sword & Shield

Each Hero can only be represented once (If you drew the Knuckles and the Daggers, you would have to choose from the Monk OR the Assassin, you can’t play both in the same run)

5. **Energy**

Energy is gained each round by rolling dice. Each Element has its own dice, with unique faces.  
There are 3 types of Energy: Attack Energy, Defense Energy, and Utility Energy.

| Element | Dice Faces (6 total) | Attack (A) | Defense (D) | Utility (U) |
| ----- | ----- | ----- | ----- | ----- |
| **Fire** 🔥 | 2A / 2A / 2A / 1A / 1D / 1U | 4 | 1 | 1 |
| **Water** 💧 | 2A / 1A / 2D / 1D / 2U / 1U | 2 | 3 | 2 |
| **Plant** 🌿 | 1A / 1D / 2U / 2U / 1U / 1U | 1 | 1 | 4 |
| **Air** 🌪 | 2A / 1A / 1D / 2U / 2U / 1U | 2 | 1 | 3 |
| **Lightning** ⚡ | 3A / 2A / 2A / 1A / 1D / 1U | 5 | 1 | 1 |
| **Earth** ⛰ | 2A / 1A / 2D / 2D / 1D / 1U | 2 | 4 | 1 |

6. **Spell Cards**

Spells cost Energy to cast, and grant Elemental Mana when cast.

The type of Mana granted when cast is shown at the bottom of each Spell Card.

The damage type of an Attack Spell can be chosen from any of the Mana.

Spells can be upgraded by either purchasing a 2nd copy of the card from the Market, or paying twice the CP cost of the card.

7. **Mana**

Mana is used to cast Class Powers. Each Class has a Basic, Advanced, and Epic Class Power.

Players can share their mana freely with one another, and are in fact encouraged to do so (probably required to do so to beat the game)

8. **CP and Levels**

9. Players start the game with 3 CP (Cleanse Points), and gain additional CP by winning combats.

10. CP is used to Purchase Spells as well as level up.

11. 

| Level | Dice Gained | Total Dice Pool | Class Power Access |
| ----- | ----- | ----- | ----- |
| **1** | \+1 Primary | 1P | — |
| **2** | \+1 Secondary | 1P \+ 1S | **Basic** Power unlocked |
| **3** | \+1 Primary | 2P \+ 1S | — |
| **4** | \+1 Secondary | 2P \+ 2S | **Advanced** Power unlocked |
| **5** | \+1 Primary | 3P \+ 2S | — |
| **6** | \+1 Secondary | 3P \+ 3S | **Epic** Power unlocked |

12. 

13. CP can not be shared or traded between characters.

14. **Market**

Players can access the Market any time they are not in combat.

The Market sells Spell Cards.

The cost of a spell is equal to it’s Energy Cost.

Players can only equip as many spells as their current level (1 at level 1, 3 at level 3, etc)

The Market contains 4 Minor Spells and 2 Major Spells

Cards refresh at the start of every combat encounter

Players can spend 1 CP to lock a card in the shop, preventing it from refreshing to a new card for 1 round.

All players have shared access to the Market and can buy cards simultaneously.

There is no limit to how many cards a player can buy at once, as long as they have the space to equip it (determined by character level) and the CP to buy it.

15. **Enemies & AI**

Enemy stat baselines, scaling, movement heuristics, focus/aggro rules, and ability triggers.

16. **Combat Grid & Positioning**

Define the grid type (hex/radial/etc.), movement costs, adjacency, flanking, cover, elevation.

17. **Special Exceptions & Clarifications**

Document one-off overrides and rulings to avoid ambiguity.

18. **Data Sheet Links**

• Elemental Multipliers → (paste Google Sheet or local CSV/JSON link)

• Classes → (Sheet tab / JSON path)

• Spells / Power Cards → (Sheet tab / JSON path)

• Enemies → (Sheet tab / JSON path)

