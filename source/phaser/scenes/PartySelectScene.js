// source/phaser/scenes/PartySelectScene.js
(function(){
  class PartySelectScene extends Phaser.Scene {
    constructor(){ 
      super('PartySelect'); 
      this.selectedWeapons = [];
      this.selectedClasses = [];
      this.usedHeroes = new Set();
      this.usedWeapons = new Set();
      this.gameData = {};
      this.classCards = [];
      this.isMultiplayer = false;
    }
    
    preload(){
      // Load game data
      this.load.json('heroes', 'source/data/heroes.json');
      this.load.json('weapons', 'source/data/weapons.json');
      this.load.json('classes', 'source/data/classes.json');
      
      // Load class portraits
      const classNames = ['Monk', 'Berserker', 'Wizard', 'Druid', 'Cleric', 'Summoner', 'Archer', 'Bard', 'Ninja', 'Assassin', 'Lancer', 'Myrmidon', 'Barbearian', 'Reaper', 'Samurai', 'Battlemage', 'Paladin', 'Warrior'];
      classNames.forEach(className => {
        this.load.image(className.toLowerCase() + 'portrait', `source/phaser/assets/ClassPortraits/${className.toLowerCase()}portrait.png`);
      });
    }
    
    create(){
      const { width: W, height: H } = this.scale;
      
      // Load data
      this.gameData.heroes = this.cache.json.get('heroes').heroes;
      this.gameData.weapons = this.cache.json.get('weapons').weapons;
      this.gameData.classes = this.cache.json.get('classes').classes;
      
      // Generate random weapons
      this.generateRandomWeapons();
      
      // Title
      this.add.text(W/2, 30, 'Choose Classes', { fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#e5e7eb' }).setOrigin(0.5);
      
      // Singleplayer/Multiplayer toggle
      this.modeToggle = this.add.rectangle(W/2, 70, 200, 30, this.isMultiplayer ? 0x374151 : 0x22c55e)
        .setInteractive({useHandCursor: true});
      this.modeText = this.add.text(W/2, 70, this.isMultiplayer ? 'Multiplayer Lobby' : 'Singleplayer', { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' 
      }).setOrigin(0.5);
      
      this.modeToggle.on('pointerdown', () => this.toggleMode());
      
      // Display weapon columns with class selection
      this.displayWeaponColumns();
      
      // Back button
      const back = this.add.text(24, 20, '← Back', { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#93c5fd' })
        .setInteractive({useHandCursor:true}).on('pointerdown', ()=> this.scene.start('Menu'));
        
      // Continue button (initially hidden)
      this.continueButton = this.add.rectangle(W/2, H - 60, 200, 50, 0x34d399)
        .setInteractive({useHandCursor:true}).setVisible(false);
      this.continueText = this.add.text(W/2, H - 60, 'Begin Adventure', { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#0b1220' 
      }).setOrigin(0.5).setVisible(false);
      
      this.continueButton.on('pointerover', () => this.continueButton.setFillStyle(0x6ee7b7));
      this.continueButton.on('pointerout', () => this.continueButton.setFillStyle(0x34d399));
      this.continueButton.on('pointerdown', () => this.startCombat());
    }
    
    generateRandomWeapons(){
      const allWeapons = Object.keys(this.gameData.weapons);
      this.selectedWeapons = [];
      
      // Randomly select 4 weapons
      while(this.selectedWeapons.length < 4){
        const randomWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
        if(!this.selectedWeapons.includes(randomWeapon)){
          this.selectedWeapons.push(randomWeapon);
        }
      }
    }
    
    displayWeaponColumns(){
      const { width: W, height: H } = this.scale;
      const columnWidth = W / 4;
      const startY = 80;
      
      this.selectedWeapons.forEach((weaponKey, index) => {
        const weapon = this.gameData.weapons[weaponKey];
        const x = columnWidth * (index + 0.5);
        
        // Weapon header
        const headerBg = this.add.rectangle(x, startY, columnWidth - 20, 40, 0x374151);
        this.add.text(x, startY, weapon.name, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '16px', 
          color: '#e5e7eb'
        }).setOrigin(0.5);
        
        // Class 1 card
        const class1Data = this.gameData.classes[weapon.class1.className];
        const hero1 = this.gameData.heroes[weapon.class1.hero];
        const class1Card = this.createClassCard(x, startY + 100, weapon.class1.className, hero1, class1Data, weaponKey, 1);
        
        // Class 2 card
        const class2Data = this.gameData.classes[weapon.class2.className];
        const hero2 = this.gameData.heroes[weapon.class2.hero];
        const class2Card = this.createClassCard(x, startY + 240, weapon.class2.className, hero2, class2Data, weaponKey, 2);
        
        this.classCards.push(class1Card, class2Card);
      });
    }
    
    createClassCard(x, y, className, hero, classData, weaponKey, classIndex){
      const cardWidth = 200;
      const cardHeight = 120;
      
      // Class portrait as background
      const portrait = this.add.image(x, y, className.toLowerCase() + 'portrait')
        .setDisplaySize(cardWidth - 10, cardHeight - 10);
      
      // Semi-transparent overlay for readability
      const cardBg = this.add.rectangle(x, y, cardWidth, cardHeight, 0x000000, 0.4)
        .setStrokeStyle(2, 0x475569)
        .setInteractive({useHandCursor: true});
      
      // Class name (only text needed)
      const classText = this.add.text(x, y + 45, className, {
        fontFamily: 'system-ui, Arial',
        fontSize: '16px',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      
      const cardData = {
        portrait,
        bg: cardBg,
        texts: [classText],
        className,
        heroKey: hero.key || Object.keys(this.gameData.heroes).find(k => this.gameData.heroes[k].name === hero.name),
        weaponKey,
        classIndex,
        selected: false,
        available: true
      };
      
      cardBg.on('pointerdown', () => this.selectClass(cardData));
      cardBg.on('pointerover', () => {
        if(cardData.available && !cardData.selected) {
          cardBg.setStrokeStyle(2, 0x6ee7b7);
        }
      });
      cardBg.on('pointerout', () => {
        if(cardData.available && !cardData.selected) {
          cardBg.setStrokeStyle(2, 0x475569);
        }
      });
      
      return cardData;
    }
    
    selectClass(cardData){
      if(!cardData.available) return;
      
      // If already selected, deselect
      if(cardData.selected) {
        this.deselectClass(cardData);
        return;
      }
      
      // Check if we can select this class
      if(this.selectedClasses.length >= 4) return;
      
      // Select the class
      cardData.selected = true;
      cardData.bg.setFillStyle(0x065f46).setStrokeStyle(2, 0x10b981);
      cardData.texts.forEach(text => text.setTint(0xffffff));
      
      this.selectedClasses.push(cardData);
      this.usedHeroes.add(cardData.heroKey);
      this.usedWeapons.add(cardData.weaponKey);
      
      // Update availability of other cards
      this.updateCardAvailability();
      
      // Show continue button if 4 classes selected
      if(this.selectedClasses.length === 4) {
        this.continueButton.setVisible(true);
        this.continueText.setVisible(true);
      }
    }
    
    deselectClass(cardData){
      cardData.selected = false;
      cardData.bg.setFillStyle(0x1e293b).setStrokeStyle(2, 0x475569);
      cardData.texts.forEach(text => text.clearTint());
      
      // Remove from selected arrays
      this.selectedClasses = this.selectedClasses.filter(c => c !== cardData);
      this.usedHeroes.delete(cardData.heroKey);
      this.usedWeapons.delete(cardData.weaponKey);
      
      // Update availability
      this.updateCardAvailability();
      
      // Hide continue button if less than 4 selected
      if(this.selectedClasses.length < 4) {
        this.continueButton.setVisible(false);
        this.continueText.setVisible(false);
      }
    }
    
    updateCardAvailability(){
      this.classCards.forEach(card => {
        const wasAvailable = card.available;
        
        // Check if this card conflicts with selected classes
        const heroConflict = this.usedHeroes.has(card.heroKey) && !card.selected;
        const weaponConflict = this.usedWeapons.has(card.weaponKey) && !card.selected;
        
        card.available = !heroConflict && !weaponConflict;
        
        // Update visual state if availability changed
        if(wasAvailable !== card.available && !card.selected) {
          if(card.available) {
            // Make available - restore color
            card.portrait.clearTint();
            card.bg.setFillStyle(0x000000, 0.4).setStrokeStyle(2, 0x475569);
            card.texts.forEach(text => text.clearTint());
          } else {
            // Make monochrome instead of grey
            card.portrait.setTint(0x666666);
            card.bg.setFillStyle(0x000000, 0.6).setStrokeStyle(2, 0x334155);
            card.texts.forEach(text => text.setTint(0x888888));
          }
        }
      });
    }
    
    toggleMode(){
      this.isMultiplayer = !this.isMultiplayer;
      this.modeToggle.setFillStyle(this.isMultiplayer ? 0x374151 : 0x22c55e);
      this.modeText.setText(this.isMultiplayer ? 'Multiplayer Lobby' : 'Singleplayer');
      
      if(this.isMultiplayer) {
        // Show multiplayer features (friend list, lobby info, etc.)
        this.showMultiplayerFeatures();
      } else {
        // Hide multiplayer features
        this.hideMultiplayerFeatures();
      }
    }
    
    showMultiplayerFeatures(){
      // Create lobby info display
      if(!this.lobbyInfo) {
        const { width: W } = this.scale;
        this.lobbyInfo = this.add.text(W - 200, 100, 'Lobby: Open to Friends', { 
          fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#34d399' 
        });
        
        // Show online friends who can join
        this.friendsList = this.add.text(W - 200, 130, 'Friends Online:', { 
          fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#e5e7eb' 
        });
        
        // Note: In a full implementation, this would show actual online friends
        // For now, just show placeholder
        this.friendsPlaceholder = this.add.text(W - 200, 150, '(No friends online)', { 
          fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#64748b' 
        });
      }
    }
    
    hideMultiplayerFeatures(){
      // Remove multiplayer UI elements
      if(this.lobbyInfo) {
        this.lobbyInfo.destroy();
        this.friendsList.destroy();
        this.friendsPlaceholder.destroy();
        this.lobbyInfo = null;
        this.friendsList = null;
        this.friendsPlaceholder = null;
      }
    }
    
    startCombat(){
      if(this.selectedClasses.length !== 4) return;
      
      // Convert selected classes to party format
      const selectedParty = this.selectedClasses.map(card => {
        const hero = this.gameData.heroes[card.heroKey];
        const weapon = this.gameData.weapons[card.weaponKey];
        const classData = this.gameData.classes[card.className];
        
        return {
          heroKey: card.heroKey,
          heroName: hero.name,
          weaponKey: card.weaponKey,
          weaponName: weapon.name,
          className: card.className,
          elements: [classData.primaryElement, classData.secondaryElement]
        };
      });
      
      // Store party data and game mode
      this.registry.set('selectedParty', selectedParty);
      this.registry.set('isMultiplayer', this.isMultiplayer);
      this.scene.start('Combat');
    }
  }
  window.ETScenes.PartySelectScene = PartySelectScene;
})();
