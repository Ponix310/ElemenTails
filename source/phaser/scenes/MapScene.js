(function(){
  class MapScene extends Phaser.Scene {
    constructor(){ 
      super('Map'); 
      this.selectedParty = [];
      this.isMultiplayer = false;
      this.marketCards = [];
      this.playerLevel = 1;
      this.cleansePoints = 10; // Starting CP
    }
    
    create(){
      const { width: W, height: H } = this.scale;
      
      // Get party data from registry
      this.selectedParty = this.registry.get('selectedParty') || [];
      this.isMultiplayer = this.registry.get('isMultiplayer') || false;
      
      // Background
      this.add.rectangle(W/2, H/2, W, H, 0x0f172a);
      
      // Title
      this.add.text(W/2, 30, 'Adventure Map', { 
        fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#e5e7eb' 
      }).setOrigin(0.5);
      
      // Game mode indicator
      const modeText = this.isMultiplayer ? 'Multiplayer Lobby' : 'Singleplayer';
      this.add.text(W/2, 60, modeText, { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#64748b' 
      }).setOrigin(0.5);
      
      // Party display (top area)
      this.displayParty();
      
      // Player stats
      this.displayPlayerStats();
      
      // Market area (bottom 6 cards as per memory)
      this.displayMarket();
      
      // Combat encounter button
      this.add.rectangle(W/2, H/2, 200, 60, 0xdc2626)
        .setInteractive({useHandCursor: true})
        .on('pointerdown', () => this.startCombat());
      
      this.add.text(W/2, H/2, 'Enter Combat', { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#e5e7eb' 
      }).setOrigin(0.5);
      
      // Back to party select
      this.add.text(24, 20, '← Party Select', { 
        fontFamily:'system-ui, Arial', fontSize:'16px', color:'#93c5fd' 
      }).setInteractive({useHandCursor:true})
        .on('pointerdown', () => this.scene.start('PartySelect'));
    }
    
    displayParty(){
      const { width: W } = this.scale;
      
      // Party header
      this.add.text(W/2, 100, 'Your Party', { 
        fontFamily: 'system-ui, Arial', fontSize: '18px', color: '#fbbf24' 
      }).setOrigin(0.5);
      
      // Display each party member
      this.selectedParty.forEach((member, index) => {
        const x = (W/2) - 150 + (index * 100);
        const y = 150;
        
        // Member card background
        this.add.rectangle(x, y, 90, 120, 0x1e293b)
          .setStrokeStyle(1, 0x475569);
        
        // Class name
        this.add.text(x, y - 40, member.className, { 
          fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#fbbf24' 
        }).setOrigin(0.5);
        
        // Hero name
        this.add.text(x, y - 20, member.heroName, { 
          fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#e5e7eb' 
        }).setOrigin(0.5);
        
        // Weapon
        this.add.text(x, y + 20, member.weaponName, { 
          fontFamily: 'system-ui, Arial', fontSize: '9px', color: '#94a3b8' 
        }).setOrigin(0.5);
        
        // Elements
        const elementsText = member.elements.join(' + ');
        this.add.text(x, y + 40, elementsText, { 
          fontFamily: 'system-ui, Arial', fontSize: '8px', color: '#6ee7b7' 
        }).setOrigin(0.5);
      });
    }
    
    displayPlayerStats(){
      const { width: W } = this.scale;
      
      // Stats panel
      this.add.text(W - 150, 100, 'Player Stats', { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#fbbf24' 
      });
      
      this.add.text(W - 150, 130, `Level: ${this.playerLevel}`, { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' 
      });
      
      this.add.text(W - 150, 150, `CP: ${this.cleansePoints}`, { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#34d399' 
      });
    }
    
    displayMarket(){
      const { width: W, height: H } = this.scale;
      
      // Market header
      this.add.text(W/2, H - 200, 'Market (4 Minor + 2 Major Spells)', { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#fbbf24' 
      }).setOrigin(0.5);
      
      // Generate market cards (placeholder for now)
      for(let i = 0; i < 6; i++) {
        const x = 100 + (i * 120);
        const y = H - 120;
        const isMajor = i >= 4;
        
        // Card background
        const cardBg = this.add.rectangle(x, y, 100, 80, isMajor ? 0x7c2d12 : 0x1e293b)
          .setStrokeStyle(2, isMajor ? 0xdc2626 : 0x475569)
          .setInteractive({useHandCursor: true});
        
        // Card type
        this.add.text(x, y - 25, isMajor ? 'Major' : 'Minor', { 
          fontFamily: 'system-ui, Arial', fontSize: '10px', 
          color: isMajor ? '#fca5a5' : '#94a3b8' 
        }).setOrigin(0.5);
        
        // Placeholder spell name
        this.add.text(x, y, `Spell ${i + 1}`, { 
          fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#e5e7eb' 
        }).setOrigin(0.5);
        
        // Cost
        const cost = isMajor ? 3 : 1;
        this.add.text(x, y + 25, `${cost} CP`, { 
          fontFamily: 'system-ui, Arial', fontSize: '10px', color: '#34d399' 
        }).setOrigin(0.5);
        
        cardBg.on('pointerdown', () => this.purchaseSpell(i, cost));
      }
      
      // Market refresh info
      this.add.text(W/2, H - 40, 'Market refreshes after each combat', { 
        fontFamily: 'system-ui, Arial', fontSize: '12px', color: '#64748b' 
      }).setOrigin(0.5);
    }
    
    purchaseSpell(index, cost){
      if(this.cleansePoints >= cost) {
        this.cleansePoints -= cost;
        // Update CP display
        this.children.list.forEach(child => {
          if(child.text && child.text.startsWith('CP:')) {
            child.setText(`CP: ${this.cleansePoints}`);
          }
        });
        
        // TODO: Add spell to player inventory
        console.log(`Purchased spell ${index + 1} for ${cost} CP`);
      } else {
        console.log('Not enough CP!');
      }
    }
    
    startCombat(){
      // Pass current game state to combat
      this.registry.set('playerLevel', this.playerLevel);
      this.registry.set('cleansePoints', this.cleansePoints);
      this.scene.start('Combat');
    }
  }
  
  window.ETScenes.MapScene = MapScene;
})();
