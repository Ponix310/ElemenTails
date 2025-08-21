# ElemenTails Master Rules

## Core Combat Flow
- At battle start, **Enemy Turn** goes first.
  - Enemies perform 1 move action.
  - At the end of their turn, they declare the action they will take next turn (intentions are always visible).
- **Player Turn** comes next.
  - Players roll their elemental dice to determine available Energy.
  - Player actions are taken **simultaneously**, not in order. Players may weave their actions together as long as they have Energy to spend.
  - The turn ends once all players agree they are finished.
- Enemy Turn repeats:
  - Enemies execute their previously declared action if in range.
  - If not in range, they move toward the nearest player.
  - If multiple players are valid targets, enemies choose the target who would take the most damage based on elemental weaknesses.

## Movement and Range
- Every unit has a **Speed** and a **Range**.
- A **Move Action** allows moving up to Speed.
- Attacks/Spells may target within Range.

## Dice & Energy
- Each element has its own dice distribution of Attack (A), Defense (D), and Utility (U) energy.
  - Fire: 2a/2a/2a/1a/1d/1u  
  - Water: 2a/1a/2d/1d/2u/1u  
  - Plant: 1a/1d/2u/2u/1u/1u  
  - Air: 2a/1a/1d/2u/2u/1u  
  - Lightning: 3a/2a/2a/1a/1d/1u  
  - Earth: 2a/1a/2d/2d/1d/1u
- Odd levels grant a **Primary Die**, even levels grant a **Secondary Die**.
- **Basic Actions**:
  - Basic Attack: 2 damage strike using Primary or Secondary type, costs 1 Attack Energy.
  - Basic Block: 2 Block, costs 1 Defense Energy.
  - 1 Utility Energy → 2 Mana of Primary/Secondary element.

## Corruption System
- Instead of health, all units use **Corruption**.
- **Enemies**: reduced to 0 Corruption = Cleansed (flee battle).
- **Players**: reaching 10 Corruption = Berserk → roll 1 extra Primary die that turn → perform actions → then become **Exhausted** (removed until next battle, rejoin at 9 Corruption).
- If all players become Exhausted, it’s **Game Over**.
- Corruption gained during the Player Turn immediately triggers Berserk.
- **Block** absorbs incoming Corruption first.

## Status Effects
- **Burn**: take 1 Corruption at start of turn per stack.  
- **Renew**: heal 1 Corruption at start of turn per stack.  
  - Burn and Renew cancel one another out (e.g., 3 Burn + 2 Renew → 1 Burn).  
- **Weakened / Inspired**: cancel each other (e.g., 2 Inspired + 1 Weakened → 1 Inspired).

## Mana & Spells
- **Spells** are shared cards purchased from the Market.  
- **Powers** are unique to classes.  
- Spells cost Energy to cast and grant Mana.  
- Powers cost Mana to activate.  
- Mana can be **shared between players**, but Energy and CP cannot.  
- Mana is lost at end of combat.  
- Energy is lost at the end of each Player Turn.

### Market
- Accessible outside combat.  
- Contains 4 Minor and 2 Major spells.  
- Refreshes after each combat.  
- Players may **Lock** a card for 1 CP per round.  
- Max owned spells = current level.  
- Market is shared among all players.  

### Spell Upgrading
- Buy a duplicate OR pay 2× base cost.  

### Spell Tapping
- Casting a spell **Taps** it.  
- Untap occurs after dice roll phase:  
  - Cost = (Player Level) - (Number of currently tapped cards).  
  - Untaps all cards at once.  
  - If all cards are tapped, untap is free.  
- **Untap effects cannot untap other untap effects** (no infinite loops).

## CP (Cleanse Points)
- Earned from encounters (scales with level).  
- Used to:  
  - Buy spells  
  - Level up  
  - Upgrade spells  
- **Not tradeable between players.**

## Encounters & Enemies
- Each enemy has unique stats, traits, attacks.  
- Encounters = mix of Common, Rare, and sometimes Elite enemies.  
- **Elites**: optional, risky but rewarding → grant shop reroll token.  
- **Dragons**: stationary, raid-style mechanics (pillars, soaks, spreads, stack mechanics, overlapping AoEs). Beating multiple dragons at once = chaotic endgame challenge.  

## Map Progression
- 3 paths with linear flow and occasional splits.  
- ~5 encounters before each boss.  
- 3rd and 5th encounters may offer optional Elite fights.  
- Elites drop reroll tokens; Dragons drop 2 reroll tokens each.  
