// source/phaser/scenes/PartySelectScene.js
(function(){
  class PartySelectScene extends Phaser.Scene {
    constructor(){ 
      super('PartySelect'); 
      this.selectedWeapons = [];
      this.selectedParty = [];
      this.gameData = {};
    }
    
    preload(){
      // Load game data
      this.load.json('heroes', 'source/data/heroes.json');
      this.load.json('weapons', 'source/data/weapons.json');
      this.load.json('classes', 'source/data/classes.json');
    }
    
    create(){
      const { width: W, height: H } = this.scale;
      
      // Load data
      this.gameData.heroes = this.cache.json.get('heroes').heroes;
      this.gameData.weapons = this.cache.json.get('weapons').weapons;
      this.gameData.classes = this.cache.json.get('classes').classes;
      
      // Title
      this.add.text(W/2, 40, 'Sun Dragon\'s Gift', { fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#fbbf24' }).setOrigin(0.5);
      this.add.text(W/2, 70, 'Choose 4 Legendary Weapons', { fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#e5e7eb' }).setOrigin(0.5);
      
      // Generate 4 random weapons for this run
      this.generateRandomWeapons();
      
      // Display weapon selection
      this.displayWeaponSelection();
      
      // Hero selection area (initially hidden)
      this.heroSelectionGroup = this.add.group();
      
      // Back button
      const back = this.add.text(24, 20, '← Back', { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#93c5fd' })
        .setInteractive({useHandCursor:true}).on('pointerdown', ()=> this.scene.start('Menu'));
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
    
    displayWeaponSelection(){
      const { width: W, height: H } = this.scale;
      const startY = 120;
      
      this.selectedWeapons.forEach((weaponKey, index) => {
        const weapon = this.gameData.weapons[weaponKey];
        const x = W/2 + (index - 1.5) * 200;
        const y = startY;
        
        // Weapon card
        const card = this.add.rectangle(x, y, 180, 120, 0x1f2937).setStrokeStyle(2, 0x374151);
        
        // Weapon name
        this.add.text(x, y - 35, weapon.name, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '14px', 
          color: '#fbbf24',
          align: 'center'
        }).setOrigin(0.5);
        
        // Class name
        this.add.text(x, y - 15, weapon.className, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '16px', 
          color: '#e5e7eb',
          align: 'center'
        }).setOrigin(0.5);
        
        // Elements
        const elementsText = weapon.elements.join(' + ');
        this.add.text(x, y + 10, elementsText, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '12px', 
          color: '#94a3b8',
          align: 'center'
        }).setOrigin(0.5);
        
        // Required hero
        const heroName = this.gameData.heroes[weapon.heroType].name;
        this.add.text(x, y + 35, `Requires: ${heroName}`, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '11px', 
          color: '#6b7280',
          align: 'center'
        }).setOrigin(0.5);
      });
      
      // Continue button
      const continueBtn = this.add.rectangle(W/2, startY + 180, 200, 50, 0x34d399).setInteractive({useHandCursor:true});
      this.add.text(W/2, startY + 180, 'Form Party', { fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#0b1220' }).setOrigin(0.5);
      continueBtn.on('pointerover', ()=> continueBtn.setFillStyle(0x6ee7b7));
      continueBtn.on('pointerout', ()=> continueBtn.setFillStyle(0x34d399));
      continueBtn.on('pointerdown', ()=> this.showHeroSelection());
    }
    
    showHeroSelection(){
      // Clear weapon display
      this.children.removeAll();
      
      const { width: W, height: H } = this.scale;
      
      // Title
      this.add.text(W/2, 40, 'Form Your Party', { fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#fbbf24' }).setOrigin(0.5);
      this.add.text(W/2, 70, 'Assign heroes to weapons', { fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#e5e7eb' }).setOrigin(0.5);
      
      // Auto-assign heroes to weapons (for prototype - later this could be interactive)
      this.selectedParty = this.selectedWeapons.map(weaponKey => {
        const weapon = this.gameData.weapons[weaponKey];
        const heroKey = weapon.heroType;
        const hero = this.gameData.heroes[heroKey];
        
        return {
          heroKey,
          heroName: hero.name,
          weaponKey,
          weaponName: weapon.name,
          className: weapon.className,
          elements: weapon.elements
        };
      });
      
      // Display party
      this.displayParty();
      
      // Continue to combat button
      const toCombat = this.add.rectangle(W/2, H - 80, 240, 56, 0x34d399).setInteractive({useHandCursor:true});
      this.add.text(W/2, H - 80, 'Begin Adventure', { fontFamily: 'system-ui, Arial', fontSize: '18px', color: '#0b1220' }).setOrigin(0.5);
      toCombat.on('pointerover', ()=> toCombat.setFillStyle(0x6ee7b7));
      toCombat.on('pointerout', ()=> toCombat.setFillStyle(0x34d399));
      toCombat.on('pointerdown', ()=> {
        // Store party data for combat scene
        this.registry.set('selectedParty', this.selectedParty);
        this.scene.start('Combat');
      });
      
      // Back button
      const back = this.add.text(24, 20, '← Back', { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#93c5fd' })
        .setInteractive({useHandCursor:true}).on('pointerdown', ()=> this.scene.start('Menu'));
    }
    
    displayParty(){
      const { width: W, height: H } = this.scale;
      const startY = 140;
      
      this.selectedParty.forEach((member, index) => {
        const x = W/4 + (index % 2) * W/2;
        const y = startY + Math.floor(index / 2) * 160;
        
        // Party member card
        const card = this.add.rectangle(x, y, 300, 140, 0x1f2937).setStrokeStyle(2, 0x374151);
        
        // Hero name
        this.add.text(x, y - 50, member.heroName, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '18px', 
          color: '#e5e7eb'
        }).setOrigin(0.5);
        
        // Class name
        this.add.text(x, y - 25, member.className, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '20px', 
          color: '#fbbf24'
        }).setOrigin(0.5);
        
        // Weapon
        this.add.text(x, y, member.weaponName, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '14px', 
          color: '#94a3b8'
        }).setOrigin(0.5);
        
        // Elements
        const elementsText = member.elements.join(' + ');
        this.add.text(x, y + 25, elementsText, { 
          fontFamily: 'system-ui, Arial', 
          fontSize: '16px', 
          color: '#34d399'
        }).setOrigin(0.5);
        
        // Get class stats
        const classData = this.gameData.classes[member.className];
        if(classData){
          this.add.text(x, y + 45, `Speed: ${classData.speed} | Range: ${classData.range}`, { 
            fontFamily: 'system-ui, Arial', 
            fontSize: '12px', 
            color: '#6b7280'
          }).setOrigin(0.5);
        }
      });
    }
  }
  window.ETScenes.PartySelectScene = PartySelectScene;
})();
