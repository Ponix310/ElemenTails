import { EventEmitter } from 'events';
import { SpellSystem } from '../data/spell_system.js';
import { gameState } from '../../data/game_state.js';

class MapScene extends Phaser.Scene {
    constructor(){ 
      super('Map'); 
      this.selectedParty = [];
      this.isMultiplayer = false;
      this.playerLevel = 1;
      this.cleansePoints = 10; // Deprecated: using per-hero cp
      this.pathGraphics = [];
      this.marketSpells = [];
      this.activeHeroIndex = 0;
      this.spellSystem = new SpellSystem(this);
      this.spellsData = null; // loaded from data file
      this.marketSpells = []; // 4 minor + 2 major roll
      // Legacy UI arrays removed; UIScene is now the sole owner of character panels
    }
    
    async create() {
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
        buffs: member.buffs || [],
        cp: typeof member.cp === 'number' ? member.cp : 3
      }));

      // Launch persistent UI overlay and initialize panels
      try {
        if (!this.scene.isActive('UI')) {
          this.scene.launch('UI');
        }
        // Defer one frame to ensure UI scene create() runs
        this.time.delayedCall(0, () => {
          this.game.events.emit('ui:initParty', { party: this.selectedParty });
          this.game.events.emit('ui:setActiveHero', { index: this.activeHeroIndex });
        });
        // Listen for hero selection from UI
        this._onUISetActiveHero = ({ index }) => { this.activeHeroIndex = index|0; };
        this.game.events.on('ui:setActiveHero', this._onUISetActiveHero);
        // Cleanup on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          if (this._onUISetActiveHero) {
            this.game.events.off('ui:setActiveHero', this._onUISetActiveHero);
            this._onUISetActiveHero = null;
          }
        });
      } catch (e) { console.warn('UIScene launch failed or not available', e); }
      
      // Background across full canvas
      this.add.rectangle(W/2, H/2, W, H, 0x0f172a);

      // Build a layer for center-square content
      this.centerLayer = this.add.layer();
      // Create header labels we can reposition on layout changes
      this.titleText = this.add.text(0, 0, 'Adventure Map', { 
        fontFamily: 'system-ui, Arial', fontSize: '24px', color: '#e5e7eb' 
      }).setOrigin(0.5);
      this.modeLabel = this.add.text(0, 0, this.isMultiplayer ? 'Multiplayer Lobby' : 'Singleplayer', { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#64748b' 
      }).setOrigin(0.5);
      this.centerLayer.add([this.titleText, this.modeLabel]);

      // Initial layout render
      this._rebuildCenteredUI();

      // React to UI layout changes (resize/orientation)
      this._onUILayout = (layout)=>{ this._rebuildCenteredUI(layout); };
      this.game.events.on('ui:layout', this._onUILayout);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, ()=>{
        if (this._onUILayout){ this.game.events.off('ui:layout', this._onUILayout); this._onUILayout = null; }
      });
      
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

      // Player stats (edge HUD) and Market (center square bottom)
      await this._ensureSpellsLoaded();
      await this.spellSystem.loadSpells();
      this._rollMarketSpells();
      this.displayMarket();
    }
    
    _getCenterRect(){
      const ui = this.registry.get('uiLayout');
      if (ui && ui.center && ui.center.size){
        return { x: ui.center.x, y: ui.center.y, width: ui.center.size, height: ui.center.size };
      }
      const { width: W, height: H } = this.scale;
      const s = Math.min(W, H);
      return { x: Math.floor(W/2), y: Math.floor(H/2), width: s, height: s };
    }

    _rebuildCenteredUI(layout){
      const C = this._getCenterRect();
      const left = C.x - C.width/2;
      const top = C.y - C.height/2;
      // Position header inside center square
      this.titleText?.setPosition(C.x, top + 24);
      this.modeLabel?.setPosition(C.x, top + 54);
      // Redraw paths using center rect
      this.drawPaths();
      // Reposition market cards if already displayed
      if (this.marketSpells && this.marketSpells.length){
        // Remove market UI and rebuild for new layout
        this.centerMarketLayer?.destroy(true);
        this.centerMarketLayer = null;
        this.displayMarket();
      }
    }

    drawPaths() {
      const C = this._getCenterRect();
      const W = C.width; const H = C.height;
      const offsetX = C.x - W/2; const offsetY = C.y - H/2;
      const pathWidth = W * 0.25;
      const startY = offsetY + H * 0.30;
      const endY = offsetY + H * 0.70;
      
      // Clear previous graphics
      this.pathGraphics.forEach(g => g.destroy());
      this.pathGraphics = [];
      this.pathNodes = [];
      
      // Draw each path
      gameState.paths.forEach((path, index) => {
        const x = offsetX + (index + 1) * (W / 4);
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
      this._beginCombat({ bossElement: dragonElement, isBoss: true });
    }
    
    startEncounter() {
      // Set up regular encounter
      this.registry.set('encounterType', 'normal');
      this._beginCombat({ isBoss: false });
    }

    // Build party objects for CombatScene expectations
    _buildPartyForCombat() {
      // Map selectedParty entries to have name/maxEnergy fields used by CombatScene
      return this.selectedParty.map(p => ({
        name: p.heroName || p.className,
        className: p.className,
        weaponName: p.weaponName,
        elements: p.elements || [],
        health: p.maxHealth || 10,
        maxHealth: p.maxHealth || 10,
        energy: 0,
        maxEnergy: 3,
        knownSpells: p.spells || [],
        cp: p.cp || 0
      }));
    }

    // Fetch enemies.json and pick a small group
    async _buildEnemiesForCombat({ isBoss }) {
      try {
        const res = await fetch('source/data/enemies.json', { cache: 'no-store' });
        const data = await res.json();
        const all = data && data.enemies ? data.enemies : {};

        // Separate by rarity if available; default to Common
        const entries = Object.entries(all);
        const commons = entries.filter(([, v]) => (v.rarity || 'Common') === 'Common');
        const rares = entries.filter(([, v]) => v.rarity === 'Rare');
        const elites = entries.filter(([, v]) => v.rarity === 'Elite');

        const pickRandom = (arr, n) => {
          const pool = [...arr];
          const out = [];
          while (pool.length && out.length < n) {
            const idx = Math.floor(Math.random() * pool.length);
            out.push(pool.splice(idx, 1)[0]);
          }
          return out;
        };

        let chosen = [];
        if (isBoss && elites.length) {
          chosen = pickRandom(elites, 1);
        } else {
          // 3-4 enemies, mostly commons, 20% chance to include one rare
          const count = 3 + Math.floor(Math.random() * 2);
          const includeRare = rares.length && Math.random() < 0.2;
          if (includeRare) {
            chosen = pickRandom(rares, 1).concat(pickRandom(commons, Math.max(0, count - 1)));
          } else {
            chosen = pickRandom(commons, count);
          }
        }

        // Shape enemies for CombatScene MVP (health/attack defaults)
        const shaped = chosen.map(([, v]) => ({
          name: v.name,
          maxHealth: v.maxCorruption ? Math.max(6, Math.round(v.maxCorruption * 0.5)) : 12,
          health: v.maxCorruption ? Math.max(6, Math.round(v.maxCorruption * 0.5)) : 12,
          attack: v.rarity === 'Elite' ? 4 : (v.rarity === 'Rare' ? 3 : 2)
        }));
        return shaped;
      } catch (e) {
        console.warn('Failed to load enemies.json', e);
        // Fallback stub
        return [
          { name: 'Training Dummy', health: 10, maxHealth: 10, attack: 2 }
        ];
      }
    }

    async _beginCombat({ isBoss, bossElement = null }) {
      const party = this._buildPartyForCombat();
      const enemies = await this._buildEnemiesForCombat({ isBoss });

      this.scene.start('Combat', {
        party,
        enemies,
        onComplete: (victory) => this._afterCombat(victory)
      });
    }

    _afterCombat(victory) {
      if (victory) {
        // Award a small CP amount for MVP
        this.selectedParty.forEach((p, i) => {
          p.cp = (p.cp || 0) + 2;
          // Notify UIScene to refresh CP display
          this.game.events.emit('ui:updateCP', { index: i, cp: p.cp });
        });
      }
      // Return to map (this scene is still active, Combat stopped itself)
      this.scene.restart();
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
    
    // Legacy displayParty removed; UIScene renders all character panels
    
    displayPlayerStats(){
      const { width: W } = this.scale;
      
      // Stats panel
      this.add.text(W - 150, 100, 'Player Stats', { 
        fontFamily: 'system-ui, Arial', fontSize: '16px', color: '#fbbf24' 
      });
      
      this.add.text(W - 150, 130, `Level: ${this.playerLevel}`, { 
        fontFamily: 'system-ui, Arial', fontSize: '14px', color: '#e5e7eb' 
      });
    }
    
    async displayMarket(){
      // Clear any existing market first
      if (this.centerMarketLayer) {
        this.centerMarketLayer.destroy(true);
        this.centerMarketLayer = null;
      }
      
      // Get center area between side panels
      const layout = this.registry.get('uiLayout');
      
      if (!layout || !layout.center) {
        // Fallback to screen center
        const { width: W, height: H } = this.scale;
        const centerX = W / 2;
        const centerY = H / 2;
        const centerW = W * 0.6;
        const centerH = H;
        
        this._displayMarketCards(centerX, centerY, centerW, centerH);
        return;
      }
      
      const centerX = layout.center.x;
      const centerY = layout.center.y;
      const centerW = layout.center.width;
      const centerH = layout.center.height;
      
      this._displayMarketCards(centerX, centerY, centerW, centerH);
    }
    
    _displayMarketCards(centerX, centerY, centerW, centerH) {
      // Create new market layer
      this.centerMarketLayer = this.add.layer();

      // Simple fixed sizing - 6 cards in a row
      const cardW = 80;
      const cardH = 112;
      const gap = 12;
      const totalRowW = 6 * cardW + 5 * gap;
      
      // Position at bottom of center area
      const bottomY = centerY + centerH/2 - 30;
      const cardY = bottomY - cardH/2;
      const startX = centerX - totalRowW/2 + cardW/2;

      // Header
      const headerY = cardY - cardH/2 - 25;
      const header = this.add.text(centerX, headerY, 'Market', {
        fontFamily: 'system-ui, Arial', fontSize: '18px', color: '#fbbf24'
      }).setOrigin(0.5);
      this.centerMarketLayer.add(header);

      // Create 6 cards
      this.marketSpells.forEach((entry, i) => {
        const cardX = startX + i * (cardW + gap);
        const isMajor = entry.tier === 'major';
        const cost = isMajor ? 3 : 1;
        
        // Card background (keep for border/interaction)
        const bg = this.add.rectangle(cardX, cardY, cardW, cardH, 0x000000, 0)
          .setStrokeStyle(2, isMajor ? 0xdc2626 : 0x475569)
          .setInteractive({ useHandCursor: true });
        
        // Load and display spell card image
        const texKey = `spell_${entry.key}`;
        const imagePath = `source/phaser/assets/spellcards/${entry.key}.png`;
        
        const placeImage = () => {
          if (this.textures.exists(texKey)) {
            const img = this.add.image(cardX, cardY, texKey);
            // Fit image to card size with small padding
            const targetW = cardW - 4;
            const targetH = cardH - 4;
            img.setDisplaySize(targetW, targetH);
            this.centerMarketLayer.add(img);
            entry.ui = { bg, img };
          } else {
            // Fallback: show spell name text
            const nameText = this.add.text(cardX, cardY, entry.key, {
              fontFamily: 'Arial', fontSize: '10px', color: '#e5e7eb',
              align: 'center', wordWrap: { width: cardW - 8 }
            }).setOrigin(0.5);
            this.centerMarketLayer.add(nameText);
            entry.ui = { bg, nameText };
          }
        };

        if (!this.textures.exists(texKey)) {
          this.load.image(texKey, imagePath);
          const onFileComplete = (key) => {
            if (key === texKey) {
              placeImage();
              this.load.off('filecomplete', onFileComplete);
            }
          };
          this.load.on('filecomplete', onFileComplete);
          this.load.start();
        } else {
          placeImage();
        }

        bg.on('pointerdown', () => this.purchaseSpell({ key: entry.key, tier: entry.tier, cost, index: i }));
        this.centerMarketLayer.add(bg);
      });
    }
    
    purchaseSpell({ key, tier, cost, index }){
      // Prevent re-purchase of sold cards
      const marketItem = this.marketSpells[index];
      if (!marketItem || marketItem.sold) { console.log('Already sold.'); return; }
      const buyer = this.selectedParty[this.activeHeroIndex];
      if (!buyer){ console.log('No active hero selected'); return; }
      if ((buyer.cp ?? 0) < cost) { console.log('Not enough CP!'); return; }
      // Deduct CP and add spell to buyer
      buyer.cp -= cost;
      // Inform UI overlay of CP change
      this.game.events.emit('ui:updateCP', { index: this.activeHeroIndex, cp: buyer.cp });
      buyer.spells = buyer.spells || [];
      buyer.spells.push(key);
      console.log(`Purchased ${key} (${tier}) for ${buyer.heroName}`);

      // Mark market item as sold and visually disable
      marketItem.sold = true;
      if (marketItem.ui && marketItem.ui.bg) {
        marketItem.ui.bg.disableInteractive();
        marketItem.ui.bg.setAlpha(0.35);
      }
      if (marketItem.ui && marketItem.ui.costText){
        marketItem.ui.costText.setText('SOLD');
        marketItem.ui.costText.setColor('#f87171');
      }

      // Inform UI overlay of spell list change
      this.game.events.emit('ui:updateSpells', { index: this.activeHeroIndex, spells: buyer.spells.slice() });
    }

    async _ensureSpellsLoaded(){
      if (this.spellsData) return;
      try{
        const res = await fetch('source/data/spells.json', { cache: 'no-store' });
        this.spellsData = await res.json();
      }catch(e){
        console.warn('Failed to load spells.json', e);
        this.spellsData = { spells: { minor:{}, major:{} } };
      }
    }

    _rollMarketSpells(){
      const minor = Object.keys(this.spellsData.spells.minor || {});
      const major = Object.keys(this.spellsData.spells.major || {});
      const pick = (arr, n)=>{
        const pool = [...arr]; const out=[];
        while(pool.length && out.length<n){ const i=Math.floor(Math.random()*pool.length); out.push(pool.splice(i,1)[0]); }
        return out;
      };
      const minors = pick(minor, 4).map(k=>({ tier:'minor', key:k, sold:false }));
      const majors = pick(major, 2).map(k=>({ tier:'major', key:k, sold:false }));
      this.marketSpells = minors.concat(majors);
    }

    _getSpellByKey(key, tier){
      return (this.spellsData && this.spellsData.spells && this.spellsData.spells[tier] && this.spellsData.spells[tier][key]) || null;
    }

    // _renderHeroSpells removed; UIScene renders spells inside its own slots
    
    startCombat(){
      // Pass current game state to combat
      this.registry.set('playerLevel', this.playerLevel);
      this.scene.start('Combat');
    }
  }

export default MapScene;
