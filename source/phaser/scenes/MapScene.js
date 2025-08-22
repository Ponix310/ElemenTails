import { gameState } from '../data/game_state.js';

class MapScene extends Phaser.Scene {
    constructor(){ 
      super('Map'); 
      this.selectedParty = [];
      this.isMultiplayer = false;
      this.playerLevel = 1;
      this.cleansePoints = 10; // Starting CP
      this.pathGraphics = [];
      this.pathNodes = [];
    }
    
    create() {
      const { width: W, height: H } = this.scale;
      
      // Get party data from registry and ensure it has all required fields
      this.selectedParty = this.registry.get('selectedParty') || [];
      this.isMultiplayer = this.registry.get('isMultiplayer') || false;
      
      // Ensure party data has all required fields
      this.selectedParty = this.selectedParty.map((member, index) => ({
        heroName: member.heroName || `Hero ${index + 1}`,
        className: member.className || 'Adventurer',
        weaponName: member.weaponName || 'Basic Weapon',
        elements: member.elements || [],
        corruption: member.corruption || 0,
        health: member.health || 10,
        maxHealth: member.maxHealth || 10,
        energy: member.energy || '0/3',
        spells: member.spells || [],
        buffs: member.buffs || []
      }));
      
      // Background
      this.add.rectangle(W/2, H/2, W, H, 0x0f172a);
      
      // Title
      this.add.text(W/2, 30, 'Adventure Map', { 
        fontFamily: 'system-ui, Arial', 
        fontSize: '24px', 
        color: '#e5e7eb' 
      }).setOrigin(0.5);
      
      // Game mode indicator
      const modeText = this.isMultiplayer ? 'Multiplayer Lobby' : 'Singleplayer';
      this.add.text(W/2, 60, modeText, { 
        fontFamily: 'system-ui, Arial', 
        fontSize: '14px', 
        color: '#64748b' 
      }).setOrigin(0.5);
      
      // Display party info
      this.displayParty();
      
      // Draw the three paths
      this.drawPaths();
      
      // Back to party select
      this.add.text(24, 20, '← Party Select', { 
        fontFamily: 'system-ui, Arial', 
        fontSize: '16px', 
        color: '#93c5fd' 
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('PartySelect'));
      
      // Show defeated dragons
      this.displayDefeatedDragons();
    }
    
    drawPaths() {
      const { width: W, height: H } = this.scale;
      const pathWidth = W * 0.25;
      const startY = H * 0.3;
      const endY = H * 0.7;
      
      // Clear previous graphics
      this.pathGraphics.forEach(g => g.destroy());
      this.pathGraphics = [];
      this.pathNodes = [];
      
      // Draw each path
      gameState.paths.forEach((path, index) => {
        const x = (index + 1) * (W / 4);
        const isCurrentPath = gameState.currentPath === path.id;
        const isLocked = path.isLocked && !isCurrentPath;
        
        // Draw path line
        const pathLine = this.add.graphics();
        pathLine.lineStyle(4, isCurrentPath ? 0x3b82f6 : 0x4b5563, 1);
        pathLine.beginPath();
        pathLine.moveTo(x, startY);
        pathLine.lineTo(x, endY);
        pathLine.strokePath();
        this.pathGraphics.push(pathLine);
        
        // Draw path nodes (encounters)
        const nodeCount = 4; // Number of encounters + boss
        const nodeSpacing = (endY - startY) / (nodeCount + 1);
        
        for (let i = 0; i < nodeCount; i++) {
          const nodeY = startY + (i + 1) * nodeSpacing;
          let nodeColor;
          let nodeText = '';
          
          if (i < nodeCount - 1) {
            // Regular encounter
            nodeColor = 0x4b5563;
            nodeText = 'Encounter';
          } else {
            // Boss node
            nodeColor = this.getElementColor(path.dragons[0]);
            nodeText = `${path.dragons[0]} Dragon`;
          }
          
          const node = this.add.circle(x, nodeY, 15, nodeColor)
            .setInteractive({ useHandCursor: !isLocked })
            .on('pointerdown', () => this.selectPath(path.id, i));
            
          this.pathGraphics.push(node);
          
          // Add node text
          const text = this.add.text(x, nodeY - 25, nodeText, {
            fontFamily: 'system-ui, Arial',
            fontSize: '12px',
            color: '#e5e7eb',
            align: 'center',
            wordWrap: { width: 100 }
          }).setOrigin(0.5);
          
          this.pathGraphics.push(text);
          this.pathNodes.push({ node, text, pathId: path.id, nodeIndex: i });
          
          // Draw connection lines between nodes
          if (i > 0) {
            const line = this.add.graphics();
            line.lineStyle(2, 0x4b5563, 0.5);
            line.beginPath();
            line.moveTo(x, startY + i * nodeSpacing + 15);
            line.lineTo(x, startY + (i + 1) * nodeSpacing - 15);
            line.strokePath();
            this.pathGraphics.push(line);
          }
        }
      });
    }
    
    getElementColor(element) {
      const colors = {
        Fire: 0xef4444,
        Water: 0x3b82f6,
        Plant: 0x10b981,
        Air: 0x93c5fd,
        Lightning: 0xf59e0b,
        Earth: 0x92400e
      };
      return colors[element] || 0x6b7280;
    }
    
    selectPath(pathId, nodeIndex) {
      if (gameState.currentPath !== null && gameState.currentPath !== pathId) {
        // Already on a different path
        return;
      }
      
      const path = gameState.paths[pathId];
      if (path.isLocked && gameState.currentPath !== pathId) {
        // Path is locked and not the current path
        return;
      }
      
      // If this is the first selection for this path
      if (gameState.currentPath === null) {
        gameState.selectPath(pathId);
        this.drawPaths();
        return;
      }
      
      // Handle node selection
      const isBossNode = nodeIndex === 3; // Last node is boss
      
      if (isBossNode) {
        // Start boss battle
        this.startBossBattle(path.dragons[0]);
      } else {
        // Start regular encounter
        this.startEncounter();
      }
    }
    
    startBossBattle(dragonElement) {
      // Set up boss battle with the specified dragon
      this.registry.set('encounterType', 'boss');
      this.registry.set('bossElement', dragonElement);
      this.scene.start('Combat');
    }
    
    startEncounter() {
      // Set up regular encounter
      this.registry.set('encounterType', 'normal');
      this.scene.start('Combat');
    }
    
    displayDefeatedDragons() {
      const { width: W, height: H } = this.scale;
      
      this.add.text(W * 0.1, H * 0.85, 'Defeated Dragons:', {
        fontFamily: 'system-ui, Arial',
        fontSize: '16px',
        color: '#e5e7eb'
      });
      
      // Display icons for defeated dragons
      gameState.defeatedDragons.forEach((dragon, index) => {
        const x = W * 0.2 + index * 40;
        const y = H * 0.9;
        
        this.add.circle(x, y, 15, this.getElementColor(dragon));
        this.add.text(x, y, dragon[0], {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);
      });
    }
    
    displayParty(){
      const { width: W, height: H } = this.scale;
      
      // Panel dimensions and positions
      const panelWidth = 180;
      const panelHeight = 300;
      const padding = 20;
      
      // Panel positions (top-left, top-right, bottom-left, bottom-right)
      const positions = [
        { x: padding, y: padding },                     // Top-left
        { x: W - panelWidth - padding, y: padding },    // Top-right
        { x: padding, y: H - panelHeight - padding },   // Bottom-left
        { x: W - panelWidth - padding, y: H - panelHeight - padding } // Bottom-right
      ];
      
      // Display each party member in their own panel
      this.selectedParty.forEach((member, index) => {
        if (index >= 4) return; // Max 4 party members
        
        const pos = positions[index];
        const centerX = pos.x + (panelWidth / 2);
        
        // Panel background
        const bg = this.add.rectangle(
          centerX, 
          pos.y + (panelHeight / 2), 
          panelWidth, 
          panelHeight, 
          0x1e293b
        ).setStrokeStyle(2, 0x475569);
        
        // Character portrait area (top half)
        const portraitHeight = 120;
        this.add.rectangle(
          centerX,
          pos.y + (portraitHeight / 2) + 10,
          panelWidth - 20,
          portraitHeight,
          0x0f172a
        ).setStrokeStyle(1, 0x475569);
        
        // Character name and class
        this.add.text(centerX, pos.y + 20, member.heroName, {
          fontFamily: 'system-ui, Arial',
          fontSize: '16px',
          color: '#e5e7eb'
        }).setOrigin(0.5);
        
        this.add.text(centerX, pos.y + 40, member.className, {
          fontFamily: 'system-ui, Arial',
          fontSize: '14px',
          color: '#fbbf24'
        }).setOrigin(0.5);
        
        // Stats area (bottom half)
        const statsY = pos.y + portraitHeight + 20;
        const statYSpacing = 25;
        
        // Corruption
        this.add.text(pos.x + 10, statsY, 'Corruption:', {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#ef4444'
        });
        
        // Corruption bar
        const corruptionWidth = 100;
        const corruptionHeight = 8;
        const corruptionBg = this.add.rectangle(
          pos.x + panelWidth - 60,
          statsY + 5,
          corruptionWidth,
          corruptionHeight,
          0x4b5563
        ).setOrigin(0, 0.5);
        
        const corruptionFill = this.add.rectangle(
          corruptionBg.x,
          corruptionBg.y,
          (member.corruption || 0) * (corruptionWidth / 10), // Assuming max 10 corruption
          corruptionHeight,
          0xef4444
        ).setOrigin(0, 0.5);
        
        // Elements
        this.add.text(pos.x + 10, statsY + statYSpacing, 'Elements:', {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#6ee7b7'
        });
        
        const elementsText = member.elements.join(' + ');
        this.add.text(pos.x + 80, statsY + statYSpacing, elementsText, {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#e5e7eb'
        });
        
        // Weapon
        this.add.text(pos.x + 10, statsY + (statYSpacing * 2), 'Weapon:', {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#93c5fd'
        });
        
        this.add.text(pos.x + 80, statsY + (statYSpacing * 2), member.weaponName, {
          fontFamily: 'system-ui, Arial',
          fontSize: '12px',
          color: '#e5e7eb'
        });
        
        // Stats (example - customize based on your game's stats)
        const stats = [
          { label: 'HP:', value: `${member.health || 10}/${member.maxHealth || 10}`, color: '#ef4444' },
          { label: 'Energy:', value: member.energy || '0/3', color: '#fbbf24' },
          { label: 'Spells:', value: member.spells ? member.spells.length : '0', color: '#93c5fd' },
          { label: 'Buffs:', value: member.buffs ? member.buffs.length : '0', color: '#6ee7b7' }
        ];
        
        stats.forEach((stat, i) => {
          const y = statsY + (statYSpacing * (i + 3));
          this.add.text(pos.x + 10, y, stat.label, {
            fontFamily: 'system-ui, Arial',
            fontSize: '12px',
            color: stat.color
          });
          
          this.add.text(pos.x + 80, y, stat.value, {
            fontFamily: 'system-ui, Arial',
            fontSize: '12px',
            color: '#e5e7eb'
          });
        });
        
        // Add click handler for future mobile integration
        bg.setInteractive().on('pointerdown', () => {
          // Will be used for mobile interaction
          console.log('Character selected:', member.heroName);
        });
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

export default MapScene;
