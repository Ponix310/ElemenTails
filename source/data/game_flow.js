// source/data/game_flow.js
import { gameState } from './game_state.js';

export class GameFlow {
  constructor(scene) {
    this.scene = scene;
    this.currentEncounter = null;
    this.party = [];
    this.inventory = [];
    this.cleansePoints = 10;
    this.currentMapNode = null;
  }

  // Initialize a new game
  startNewGame(partyData) {
    this.party = [...partyData];
    this.inventory = [];
    this.cleansePoints = 10;
    this.currentMapNode = null;
    gameState.reset();
    
    // Initialize party stats
    this.party.forEach(member => {
      member.maxHealth = member.health = 30;
      member.energy = 3;
      member.maxEnergy = 3;
      member.defense = 0;
      member.speed = 100;
      member.abilities = this.getStarterAbilities(member.class);
    });
    
    // Start at the map
    this.scene.scene.start('Map');
  }

  // Get starter abilities based on class
  getStarterAbilities(className) {
    const abilities = {
      'Warrior': [
        { name: 'Strike', cost: 1, damage: 6, target: 'single', description: 'Basic attack' },
        { name: 'Defend', cost: 1, defense: 3, target: 'self', description: 'Raise defense' }
      ],
      'Mage': [
        { name: 'Fireball', cost: 2, damage: 8, target: 'single', description: 'Fire damage' },
        { name: 'Barrier', cost: 1, defense: 2, target: 'ally', description: 'Raise ally defense' }
      ],
      'Cleric': [
        { name: 'Heal', cost: 2, heal: 8, target: 'ally', description: 'Heal an ally' },
        { name: 'Smite', cost: 1, damage: 4, target: 'single', description: 'Holy damage' }
      ],
      'Rogue': [
        { name: 'Backstab', cost: 2, damage: 10, target: 'single', description: 'High damage to one target' },
        { name: 'Poison Dart', cost: 1, damage: 3, effect: 'poison', target: 'single', description: 'Poison an enemy' }
      ]
    };
    
    return abilities[className] || [];
  }

  // Start an encounter
  startEncounter(encounterType, nodeData) {
    this.currentMapNode = nodeData;
    
    switch (encounterType) {
      case 'combat':
        this.startCombat(nodeData);
        break;
      case 'elite':
        this.startEliteCombat(nodeData);
        break;
      case 'market':
        this.startMarket();
        break;
      case 'boss':
        this.startBossFight(nodeData);
        break;
      default:
        console.error('Unknown encounter type:', encounterType);
    }
  }

  // Start a regular combat encounter
  startCombat(nodeData) {
    // Simple enemy generation for now
    const enemies = [
      { name: 'Goblin', health: 20, maxHealth: 20, attack: 4, defense: 1, speed: 110 },
      { name: 'Skeleton', health: 25, maxHealth: 25, attack: 5, defense: 2, speed: 90 }
    ];
    
    this.currentEncounter = {
      type: 'combat',
      enemies: enemies,
      rewards: this.generateRewards('normal')
    };
    
    this.scene.scene.start('Combat', { 
      party: this.party,
      enemies: enemies,
      onComplete: this.onCombatComplete.bind(this)
    });
  }

  // Handle combat completion
  onCombatComplete(victory) {
    if (victory) {
      // Grant rewards
      this.grantRewards(this.currentEncounter.rewards);
      
      // Mark node as completed
      if (this.currentMapNode) {
        this.currentMapNode.completed = true;
      }
      
      // Return to map
      this.scene.scene.start('Map');
    } else {
      // Game over or return to map with penalty
      this.scene.scene.start('GameOver');
    }
  }

  // Generate rewards based on encounter type
  generateRewards(encounterType) {
    const rewards = {
      gold: Phaser.Math.Between(5, 15),
      xp: 10,
      items: []
    };
    
    // Add chance for items
    if (Math.random() > 0.7) {
      rewards.items.push(this.generateRandomItem());
    }
    
    return rewards;
  }

  // Generate a random item
  generateRandomItem() {
    const items = [
      { name: 'Health Potion', type: 'consumable', effect: { heal: 10 } },
      { name: 'Energy Potion', type: 'consumable', effect: { energy: 1 } },
      { name: 'Attack Scroll', type: 'consumable', effect: { attack: 2, duration: 3 } }
    ];
    
    return Phaser.Utils.Array.GetRandom(items);
  }

  // Grant rewards to the player
  grantRewards(rewards) {
    this.cleansePoints += rewards.gold;
    
    // Add items to inventory
    rewards.items.forEach(item => {
      this.inventory.push(item);
    });
    
    // TODO: Add XP and level up logic
    
    // Show reward screen
    this.scene.scene.launch('RewardScreen', {
      rewards: rewards,
      onContinue: () => {
        this.scene.scene.stop('RewardScreen');
        this.scene.scene.start('Map');
      }
    });
  }

  // Save game state
  saveGame() {
    const saveData = {
      party: this.party,
      inventory: this.inventory,
      cleansePoints: this.cleansePoints,
      mapState: gameState,
      currentMapNode: this.currentMapNode
    };
    
    localStorage.setItem('elementails_save', JSON.stringify(saveData));
  }

  // Load game state
  loadGame() {
    const saveData = JSON.parse(localStorage.getItem('elementails_save'));
    if (saveData) {
      this.party = saveData.party;
      this.inventory = saveData.inventory;
      this.cleansePoints = saveData.cleansePoints;
      Object.assign(gameState, saveData.mapState);
      this.currentMapNode = saveData.currentMapNode;
      
      // Return to map
      this.scene.scene.start('Map');
      return true;
    }
    return false;
  }
}

// Create a singleton instance
export const gameFlow = new GameFlow();
