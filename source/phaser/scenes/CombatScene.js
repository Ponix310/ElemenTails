// source/phaser/scenes/CombatScene.js
export default class CombatScene extends Phaser.Scene {
  constructor() { 
    super('Combat');
    this.party = [];
    this.enemies = [];
    this.currentTurn = 'player';
    this.turnPhase = 'start';
    this.combatLog = [];
    this.onCombatComplete = null;
  }
  
  init(data) {
    this.party = data.party || [];
    this.enemies = data.enemies || [];
    this.onCombatComplete = data.onComplete || (() => {});
  }
  
  create() {
    const { width: W, height: H } = this.scale;
    
    // Background
    this.add.rectangle(W/2, H/2, W, H, 0x1e293b);
    
    // Create combat UI
    this.createCombatUI();
    
    // Start combat
    this.startCombat();
    
    // Debug: Press 'D' to win combat
    this.input.keyboard.on('keydown-D', () => this.endCombat(true));
  }
  
  createCombatUI() {
    const { width: W, height: H } = this.scale;
    
    // Party UI (left side)
    this.createPartyUI();
    
    // Enemies UI (right side)
    this.createEnemiesUI();
    
    // Action buttons
    this.createActionButtons();
    
    // Combat log
    this.createCombatLog();
  }
  
  createPartyUI() {
    const startX = 100;
    const startY = 200;
    const spacing = 120;
    
    this.party.forEach((member, index) => {
      const x = startX;
      const y = startY + (index * spacing);
      
      // Character card
      const bg = this.add.rectangle(x, y, 180, 100, 0x334155)
        .setStrokeStyle(2, 0x64748b);
      
      // Character name and health
      this.add.text(x - 80, y - 40, member.name, { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      });
      
      // Health bar
      this.createHealthBar(x, y - 20, 160, 20, member.health / member.maxHealth);
      
      // Energy
      this.add.text(x - 80, y + 5, 'Energy:', { 
        fontFamily: 'Arial', 
        fontSize: '14px', 
        color: '#ffffff' 
      });
      
      // Energy orbs
      for (let i = 0; i < member.maxEnergy; i++) {
        const energyX = x - 30 + (i * 15);
        const energyColor = i < member.energy ? 0xfacc15 : 0x4b5563;
        this.add.circle(energyX, y + 15, 5, energyColor);
      }
    });
  }
  
  createEnemiesUI() {
    const startX = 700;
    const startY = 200;
    const spacing = 120;
    
    this.enemies.forEach((enemy, index) => {
      const x = startX;
      const y = startY + (index * spacing);
      
      // Enemy card
      const bg = this.add.rectangle(x, y, 180, 100, 0x7f1d1d)
        .setStrokeStyle(2, 0xfecaca);
      
      // Enemy name and health
      this.add.text(x - 80, y - 40, enemy.name, { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      });
      
      // Health bar
      this.createHealthBar(x, y - 20, 160, 20, enemy.health / enemy.maxHealth);
    });
  }
  
  createHealthBar(x, y, width, height, percent) {
    // Background
    const bg = this.add.rectangle(x, y, width, height, 0x1e293b)
      .setStrokeStyle(1, 0x64748b);
    
    // Health fill
    const fillWidth = Math.max(0, (width - 4) * percent);
    const fill = this.add.rectangle(
      x - (width / 2) + 2 + (fillWidth / 2), 
      y, 
      fillWidth, 
      height - 4, 
      0x10b981
    ).setOrigin(0, 0.5);
    
    return { bg, fill };
  }
  
  createActionButtons() {
    const { width: W, height: H } = this.scale;
    const buttonY = H - 80;
    const spacing = 150;
    
    const actions = [
      { 
        text: 'Attack', 
        x: W/2 - spacing, 
        action: () => this.playerAction('attack') 
      },
      { 
        text: 'Abilities', 
        x: W/2, 
        action: () => this.showAbilities() 
      },
      { 
        text: 'Items', 
        x: W/2 + spacing, 
        action: () => this.showItems() 
      }
    ];
    
    actions.forEach(btn => {
      const bg = this.add.rectangle(btn.x, buttonY, 120, 40, 0x334155)
        .setInteractive()
        .on('pointerdown', btn.action);
        
      this.add.text(btn.x, buttonY, btn.text, { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      }).setOrigin(0.5);
    });
  }
  
  showAbilities() {
    // TODO: Implement ability selection
    this.logMessage('Abilities not implemented yet!');
  }
  
  showItems() {
    // TODO: Implement item selection
    this.logMessage('Items not implemented yet!');
  }
  
  createCombatLog() {
    const { width: W, height: H } = this.scale;
    
    // Log background
    this.logBg = this.add.rectangle(W/2, H - 150, W - 40, 100, 0x1e293b)
      .setStrokeStyle(1, 0x64748b);
    
    // Log text
    this.logText = this.add.text(W/2 - 180, H - 180, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#e2e8f0',
      wordWrap: { width: 360 }
    });
  }
  
  logMessage(message) {
    this.combatLog.push(message);
    if (this.combatLog.length > 3) {
      this.combatLog.shift();
    }
    this.logText.setText(this.combatLog.join('\n'));
  }
  
  startCombat() {
    this.logMessage('Combat started!');
    this.startPlayerTurn();
  }
  
  startPlayerTurn() {
    this.currentTurn = 'player';
    this.logMessage('Your turn!');
    
    // Reset energy for party members
    this.party.forEach(member => {
      member.energy = member.maxEnergy;
    });
  }
  
  playerAction(action, target = null) {
    // Simple attack for now
    if (action === 'attack' && this.enemies.length > 0) {
      const enemy = this.enemies[0]; // Simple target first enemy for now
      enemy.health -= 5; // Simple damage calculation
      this.logMessage(`You attacked ${enemy.name} for 5 damage!`);
      
      // Check if enemy is defeated
      if (enemy.health <= 0) {
        this.logMessage(`${enemy.name} was defeated!`);
        this.enemies = this.enemies.filter(e => e !== enemy);
      }
      
      // End player turn
      this.endPlayerTurn();
    }
  }
  
  endPlayerTurn() {
    this.currentTurn = 'enemy';
    this.logMessage('Enemy turn!');
    
    // Simple enemy AI
    this.time.delayedCall(1000, () => {
      if (this.enemies.length > 0 && this.party.length > 0) {
        const enemy = this.enemies[0];
        const target = this.party[0]; // Simple target first party member
        
        target.health -= enemy.attack;
        this.logMessage(`${enemy.name} attacks ${target.name} for ${enemy.attack} damage!`);
        
        // Check if party member is defeated
        if (target.health <= 0) {
          this.logMessage(`${target.name} was defeated!`);
          this.party = this.party.filter(p => p !== target);
        }
        
        // Check win/lose conditions
        if (this.party.length === 0) {
          this.endCombat(false); // Player lost
        } else if (this.enemies.length === 0) {
          this.endCombat(true); // Player won
        } else {
          // Start next turn
          this.startPlayerTurn();
        }
      }
    });
  }
  
  endCombat(victory) {
    this.logMessage(victory ? 'Victory!' : 'Defeat!');
    
    // Return to game flow after a delay
    this.time.delayedCall(2000, () => {
      this.onCombatComplete(victory);
      this.scene.stop();
    });
  }
}
