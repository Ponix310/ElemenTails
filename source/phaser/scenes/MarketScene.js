// source/phaser/scenes/MarketScene.js
(function(){
  class MarketScene extends Phaser.Scene {
    constructor(){ 
      super('Market'); 
      this.spellData = {};
      this.marketCards = [];
      this.selectedCards = [];
      this.playerCP = 10; // Starting Cleanse Points
    }
    
    preload(){
      // Load spell data
      this.load.json('spells', 'source/data/spells.json');
      
      // Load all spell card images
      const minorSpells = ['arcingflame', 'blazeheart', 'blazingslash', 'boilingguard', 'bramblebulwark', 'breezelightaid', 'cinderstep', 'earthenshell', 'flarebloom', 'flashbrand', 'flickerveil', 'kindlestrike', 'magmasmash', 'mistcutter', 'mistwalk', 'moltenstand', 'mudsweep', 'pulsevine', 'rallyingbloom', 'reedwhiprescue', 'rootedprovocation', 'scorchinggale', 'sharedgrowth', 'shocksnap', 'sparkstepbarrier', 'steamjab', 'stoneflowward', 'stormpiercrer', 'sylphwindsurge', 'thornlashspark', 'thunderlash', 'tidalanchor', 'tideburst', 'verdantshell', 'vitalwaters', 'windflare'];
      
      const majorSpells = ['exactedfury', 'incendiarychain', 'whirlpoolburst', 'stormpiercearrow', 'tempesttether', 'scorchwindtangle', 'blazingcomet', 'stoneveilward', 'zephyrgrace', 'tidalshelter', 'emberguard', 'verdantshell', 'emeraldoverbloom', 'cycloneswirl', 'shroudedcoil', 'arcwavesnare', 'phoenixaccord', 'surgingtailwind'];
      
      minorSpells.forEach(spell => {
        this.load.image(spell, `source/phaser/assets/spellcards/minor/${spell}.png`);
      });
      
      majorSpells.forEach(spell => {
        this.load.image(spell, `source/phaser/assets/spellcards/major/${spell}.png`);
      });
    }
    
    create(){
      const { width: W, height: H } = this.scale;
      
      // Load spell data
      this.spellData = this.cache.json.get('spells').spells;
      
      // Title
      this.add.text(W/2, 30, 'Market', { fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#fbbf24' }).setOrigin(0.5);
      
      // CP Display
      this.cpText = this.add.text(W - 100, 30, `CP: ${this.playerCP}`, { 
        fontFamily: 'system-ui, Arial', fontSize: '18px', color: '#34d399' 
      }).setOrigin(0.5);
      
      // Generate market cards (4 minor + 2 major)
      this.generateMarketCards();
      
      // Display market cards
      this.displayMarketCards();
      
      // Back button
      const back = this.add.text(24, 20, '← Back', { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#93c5fd' })
        .setInteractive({useHandCursor:true}).on('pointerdown', ()=> this.scene.start('Menu'));
        
      // Refresh button
      const refresh = this.add.rectangle(W/2, H - 60, 150, 40, 0x374151)
        .setInteractive({useHandCursor:true});
      this.add.text(W/2, H - 60, 'Refresh Market', { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' 
      }).setOrigin(0.5);
      
      refresh.on('pointerover', () => refresh.setFillStyle(0x475569));
      refresh.on('pointerout', () => refresh.setFillStyle(0x374151));
      refresh.on('pointerdown', () => this.refreshMarket());
    }
    
    generateMarketCards(){
      this.marketCards = [];
      
      // Get 4 random minor spells
      const minorSpellKeys = Object.keys(this.spellData.minor);
      for(let i = 0; i < 4; i++){
        const randomKey = minorSpellKeys[Math.floor(Math.random() * minorSpellKeys.length)];
        this.marketCards.push({
          key: randomKey,
          data: this.spellData.minor[randomKey],
          type: 'minor',
          locked: false
        });
      }
      
      // Get 2 random major spells
      const majorSpellKeys = Object.keys(this.spellData.major);
      for(let i = 0; i < 2; i++){
        const randomKey = majorSpellKeys[Math.floor(Math.random() * majorSpellKeys.length)];
        this.marketCards.push({
          key: randomKey,
          data: this.spellData.major[randomKey],
          type: 'major',
          locked: false
        });
      }
    }
    
    displayMarketCards(){
      const { width: W, height: H } = this.scale;
      const cardWidth = 160;
      const cardHeight = 220;
      const startX = 80;
      const startY = 120;
      
      // Clear existing displays
      this.children.removeByName('marketCard');
      
      this.marketCards.forEach((card, index) => {
        const x = startX + (index % 3) * (cardWidth + 20);
        const y = startY + Math.floor(index / 3) * (cardHeight + 40);
        
        // Card image
        const cardImage = this.add.image(x, y, card.key)
          .setDisplaySize(cardWidth, cardHeight)
          .setInteractive({useHandCursor: true})
          .setName('marketCard');
        
        // Lock indicator
        if(card.locked){
          const lockIcon = this.add.rectangle(x + cardWidth/2 - 15, y - cardHeight/2 + 15, 20, 20, 0xfbbf24)
            .setName('marketCard');
          this.add.text(x + cardWidth/2 - 15, y - cardHeight/2 + 15, '🔒', { 
            fontSize: '12px' 
          }).setOrigin(0.5).setName('marketCard');
        }
        
        // Cost display
        const costBg = this.add.rectangle(x, y + cardHeight/2 - 15, cardWidth - 10, 25, 0x000000, 0.7)
          .setName('marketCard');
        const costText = `${card.data.energyCost} CP`;
        this.add.text(x, y + cardHeight/2 - 15, costText, { 
          fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#fbbf24' 
        }).setOrigin(0.5).setName('marketCard');
        
        // Card interactions
        cardImage.on('pointerover', () => {
          cardImage.setTint(0xcccccc);
          this.showCardDetails(card, x, y);
        });
        
        cardImage.on('pointerout', () => {
          cardImage.clearTint();
          this.hideCardDetails();
        });
        
        cardImage.on('pointerdown', () => {
          this.purchaseCard(card, index);
        });
      });
    }
    
    showCardDetails(card, x, y){
      // Create tooltip with spell details
      const tooltip = this.add.container(x + 200, y);
      tooltip.setName('tooltip');
      
      const bg = this.add.rectangle(0, 0, 200, 120, 0x1f2937, 0.95);
      const title = this.add.text(0, -45, card.data.name, { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#fbbf24' 
      }).setOrigin(0.5);
      
      const type = this.add.text(0, -25, `${card.type.toUpperCase()} ${card.data.type}`, { 
        fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#94a3b8' 
      }).setOrigin(0.5);
      
      const effect = this.add.text(0, -5, card.data.effect, { 
        fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#e5e7eb',
        wordWrap: { width: 180 }
      }).setOrigin(0.5);
      
      const effect2 = this.add.text(0, 15, card.data.effect2, { 
        fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#6ee7b7',
        wordWrap: { width: 180 }
      }).setOrigin(0.5);
      
      tooltip.add([bg, title, type, effect, effect2]);
    }
    
    hideCardDetails(){
      this.children.removeByName('tooltip');
    }
    
    purchaseCard(card, index){
      if(this.playerCP < card.data.energyCost) {
        // Not enough CP
        this.showMessage('Not enough CP!', 0xff4444);
        return;
      }
      
      // Purchase the card
      this.playerCP -= card.data.energyCost;
      this.cpText.setText(`CP: ${this.playerCP}`);
      
      // Add to player's collection (for now just show message)
      this.showMessage(`Purchased ${card.data.name}!`, 0x34d399);
      
      // Remove from market
      this.marketCards.splice(index, 1);
      this.displayMarketCards();
    }
    
    refreshMarket(){
      // Auto-refresh after combat encounters
      this.generateMarketCards();
      this.displayMarketCards();
      this.showMessage('Market refreshed!', 0x60a5fa);
    }
    
    showMessage(text, color){
      const message = this.add.text(this.scale.width/2, 80, text, { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: color 
      }).setOrigin(0.5);
      
      this.tweens.add({
        targets: message,
        alpha: 0,
        y: 60,
        duration: 2000,
        onComplete: () => message.destroy()
      });
    }
  }
  window.ETScenes.MarketScene = MarketScene;
})();
