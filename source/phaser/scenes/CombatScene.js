// source/phaser/scenes/CombatScene.js
(function(){
  class CombatScene extends Phaser.Scene {
    constructor(){ 
      super('Combat');
      this.party = [];
      this.enemies = [];
      this.currentTurn = 'enemy';
      this.turnPhase = 'start';
      this.gameData = {};
      this.elementData = {};
    }
    
    preload(){
      // Load game data
      this.load.json('enemies', 'source/data/enemies.json');
      this.load.json('classes', 'source/data/classes.json');
      this.load.json('elements', 'source/data/elements.json');
    }
    
    create(){
      const { width: W, height: H } = this.scale;
      
      // Load data
      this.gameData.enemies = this.cache.json.get('enemies').enemies;
      this.gameData.classes = this.cache.json.get('classes').classes;
      this.elementData = this.cache.json.get('elements');
      
      // Get party from registry
      const selectedParty = this.registry.get('selectedParty') || this.generateTestParty();
      
      // Initialize combat
      this.initializeCombat(selectedParty);
      
      // Create UI
      this.createCombatUI();
      
      // Start combat loop
      this.startCombat();
      
      // Esc to go back for convenience
      this.input.keyboard.on('keydown-ESC', ()=> this.scene.start('Menu'));
    }
    
    generateTestParty(){
      // Fallback test party if no party selected
      return [
        { heroName: 'Fox', className: 'Monk', elements: ['Fire', 'Air'] },
        { heroName: 'Frog', className: 'Wizard', elements: ['Water', 'Air'] },
        { heroName: 'Rabbit', className: 'Cleric', elements: ['Plant', 'Air'] },
        { heroName: 'Wolf', className: 'Ninja', elements: ['Lightning', 'Air'] }
      ];
    }
    
    initializeCombat(selectedParty){
      // Initialize party members
      this.party = selectedParty.map((member, index) => {
        const classData = this.gameData.classes[member.className];
        return {
          id: `party_${index}`,
          name: `${member.heroName} (${member.className})`,
          className: member.className,
          elements: member.elements,
          corruption: 0,
          maxCorruption: 10,
          speed: classData ? classData.speed : 2,
          range: classData ? classData.range : 2,
          block: 0,
          energy: { attack: 0, defense: 0, utility: 0 },
          mana: {},
          statusEffects: {},
          position: { x: 2 + index, y: 6 }
        };
      });
      
      // Initialize enemies
      this.enemies = [
        this.createEnemy('corruptedWolf', { x: 6, y: 3 }),
        this.createEnemy('shadowSprite', { x: 8, y: 4 })
      ];
    }
    
    createEnemy(enemyType, position){
      const enemyData = this.gameData.enemies[enemyType];
      return {
        id: `enemy_${enemyType}_${Date.now()}`,
        name: enemyData.name,
        type: enemyType,
        corruption: enemyData.maxCorruption,
        maxCorruption: enemyData.maxCorruption,
        speed: enemyData.speed,
        range: enemyData.range,
        element: enemyData.element,
        attacks: enemyData.attacks,
        block: 0,
        statusEffects: {},
        position: position,
        intention: null
      };
    }
    
    createCombatUI(){
      const { width: W, height: H } = this.scale;
      
      // Background grid
      const g = this.add.graphics();
      g.lineStyle(1, 0x243244, 1);
      const cell = 64;
      for (let x = 0; x <= W; x += cell) g.lineBetween(x, 0, x, H);
      for (let y = 0; y <= H; y += cell) g.lineBetween(0, y, W, y);
      
      // Title
      this.add.text(W/2, 30, 'Combat', { fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#fbbf24' }).setOrigin(0.5);
      
      // Turn indicator
      this.turnText = this.add.text(W/2, 60, '', { fontFamily: 'system-ui, Arial', fontSize: '18px', color: '#e5e7eb' }).setOrigin(0.5);
      
      // Combat area
      this.combatGroup = this.add.group();
      
      // UI panels
      this.createPartyPanel();
      this.createEnemyPanel();
      this.createActionPanel();
      
      this.updateDisplay();
    }
    
    createPartyPanel(){
      const { width: W, height: H } = this.scale;
      const panelX = 50;
      const panelY = 100;
      
      this.add.text(panelX, panelY, 'Party', { fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#fbbf24' });
      
      this.partyTexts = [];
      this.party.forEach((member, index) => {
        const y = panelY + 30 + index * 80;
        
        const nameText = this.add.text(panelX, y, member.name, { fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' });
        const corruptionText = this.add.text(panelX, y + 20, `Corruption: ${member.corruption}/10`, { fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#ef4444' });
        const elementsText = this.add.text(panelX, y + 35, member.elements.join(' + '), { fontFamily: 'system-ui, Arial', fontSize: '11px', color: '#34d399' });
        const energyText = this.add.text(panelX, y + 50, 'Energy: A:0 D:0 U:0', { fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#94a3b8' });
        
        this.partyTexts.push({ nameText, corruptionText, elementsText, energyText });
      });
    }
    
    createEnemyPanel(){
      const { width: W, height: H } = this.scale;
      const panelX = W - 300;
      const panelY = 100;
      
      this.add.text(panelX, panelY, 'Enemies', { fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#ef4444' });
      
      this.enemyTexts = [];
      this.enemies.forEach((enemy, index) => {
        const y = panelY + 30 + index * 100;
        
        const nameText = this.add.text(panelX, y, enemy.name, { fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' });
        const corruptionText = this.add.text(panelX, y + 20, `Corruption: ${enemy.corruption}/${enemy.maxCorruption}`, { fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#34d399' });
        const intentionText = this.add.text(panelX, y + 35, 'Intention: ?', { fontFamily: 'system-ui, Arial', fontSize: '11px', color: '#fbbf24' });
        const elementText = this.add.text(panelX, y + 50, `Element: ${enemy.element}`, { fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#94a3b8' });
        
        this.enemyTexts.push({ nameText, corruptionText, intentionText, elementText });
      });
    }
    
    createActionPanel(){
      const { width: W, height: H } = this.scale;
      const panelY = H - 120;
      
      // Action buttons (initially hidden)
      this.actionButtons = this.add.group();
      
      const rollDiceBtn = this.add.rectangle(W/2 - 100, panelY, 120, 40, 0x3b82f6).setInteractive({useHandCursor:true});
      this.add.text(W/2 - 100, panelY, 'Roll Dice', { fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      rollDiceBtn.on('pointerdown', () => this.rollDice());
      
      const endTurnBtn = this.add.rectangle(W/2 + 100, panelY, 120, 40, 0x10b981).setInteractive({useHandCursor:true});
      this.add.text(W/2 + 100, panelY, 'End Turn', { fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      endTurnBtn.on('pointerdown', () => this.endPlayerTurn());
      
      this.actionButtons.addMultiple([rollDiceBtn, endTurnBtn]);
      this.actionButtons.setVisible(false);
    }
    
    startCombat(){
      this.currentTurn = 'enemy';
      this.turnPhase = 'start';
      this.processTurn();
    }
    
    processTurn(){
      if(this.currentTurn === 'enemy'){
        this.processEnemyTurn();
      } else {
        this.processPlayerTurn();
      }
      this.updateDisplay();
    }
    
    processEnemyTurn(){
      this.turnText.setText('Enemy Turn - Declaring Intentions');
      
      // Enemies declare intentions
      this.enemies.forEach(enemy => {
        const attackKeys = Object.keys(enemy.attacks);
        const randomAttack = attackKeys[Math.floor(Math.random() * attackKeys.length)];
        enemy.intention = enemy.attacks[randomAttack];
      });
      
      // After 2 seconds, switch to player turn
      this.time.delayedCall(2000, () => {
        this.currentTurn = 'player';
        this.turnPhase = 'dice';
        this.processTurn();
      });
    }
    
    processPlayerTurn(){
      if(this.turnPhase === 'dice'){
        this.turnText.setText('Player Turn - Roll Dice for Energy');
        this.actionButtons.setVisible(true);
      } else if(this.turnPhase === 'actions'){
        this.turnText.setText('Player Turn - Take Actions');
      }
    }
    
    rollDice(){
      // Simple dice rolling for prototype
      this.party.forEach(member => {
        const primaryElement = member.elements[0];
        const secondaryElement = member.elements[1];
        
        // Roll primary die
        const primaryRoll = this.rollElementalDie(primaryElement);
        const secondaryRoll = this.rollElementalDie(secondaryElement);
        
        // Combine energy
        member.energy = {
          attack: primaryRoll.attack + secondaryRoll.attack,
          defense: primaryRoll.defense + secondaryRoll.defense,
          utility: primaryRoll.utility + secondaryRoll.utility
        };
      });
      
      this.turnPhase = 'actions';
      this.processTurn();
    }
    
    rollElementalDie(element){
      // Simplified dice rolling based on element distributions from rules
      const distributions = {
        'Fire': { attack: 5, defense: 1, utility: 1 },
        'Water': { attack: 3, defense: 3, utility: 3 },
        'Plant': { attack: 1, defense: 1, utility: 5 },
        'Air': { attack: 3, defense: 1, utility: 4 },
        'Lightning': { attack: 5, defense: 1, utility: 1 },
        'Earth': { attack: 3, defense: 4, utility: 1 }
      };
      
      const dist = distributions[element] || { attack: 2, defense: 2, utility: 2 };
      const total = dist.attack + dist.defense + dist.utility;
      const roll = Math.floor(Math.random() * total);
      
      if(roll < dist.attack) return { attack: 1, defense: 0, utility: 0 };
      if(roll < dist.attack + dist.defense) return { attack: 0, defense: 1, utility: 0 };
      return { attack: 0, defense: 0, utility: 1 };
    }
    
    endPlayerTurn(){
      // Execute enemy intentions
      this.enemies.forEach(enemy => {
        if(enemy.intention && enemy.corruption > 0){
          // Simple damage to first party member for prototype
          const target = this.party[0];
          if(target.corruption < 10){
            const damage = enemy.intention.damage || 1;
            target.corruption = Math.min(target.corruption + damage, 10);
          }
        }
      });
      
      // Reset for next turn
      this.party.forEach(member => {
        member.energy = { attack: 0, defense: 0, utility: 0 };
        member.block = 0;
      });
      
      this.actionButtons.setVisible(false);
      this.currentTurn = 'enemy';
      this.turnPhase = 'start';
      
      // Check win/lose conditions
      if(this.checkCombatEnd()){
        return;
      }
      
      this.time.delayedCall(1000, () => this.processTurn());
    }
    
    checkCombatEnd(){
      const allEnemiesCleansed = this.enemies.every(enemy => enemy.corruption <= 0);
      const allPlayersExhausted = this.party.every(member => member.corruption >= 10);
      
      if(allEnemiesCleansed){
        this.turnText.setText('Victory! All enemies cleansed!');
        return true;
      }
      
      if(allPlayersExhausted){
        this.turnText.setText('Defeat! All party members exhausted!');
        return true;
      }
      
      return false;
    }
    
    updateDisplay(){
      // Update party display
      this.party.forEach((member, index) => {
        if(this.partyTexts[index]){
          this.partyTexts[index].corruptionText.setText(`Corruption: ${member.corruption}/10`);
          this.partyTexts[index].energyText.setText(`Energy: A:${member.energy.attack} D:${member.energy.defense} U:${member.energy.utility}`);
        }
      });
      
      // Update enemy display
      this.enemies.forEach((enemy, index) => {
        if(this.enemyTexts[index]){
          this.enemyTexts[index].corruptionText.setText(`Corruption: ${enemy.corruption}/${enemy.maxCorruption}`);
          this.enemyTexts[index].intentionText.setText(`Intention: ${enemy.intention ? enemy.intention.name : '?'}`);
        }
      });
    }
  }
  window.ETScenes.CombatScene = CombatScene;
})();
