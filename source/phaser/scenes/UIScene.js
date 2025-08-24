// source/phaser/scenes/UIScene.js
export default class UIScene extends Phaser.Scene {
  constructor(){
    super('UI');
    this.party = [];
    this.heroPanels = []; // per-hero refs
    this.activeHeroIndex = 0;
    this._bound = false;
  }

  preload(){
    // Energy icons (use if present)
    this.load.image('icon_attack', 'source/phaser/assets/icons/Attack%20Energy.png');
    this.load.image('icon_defense', 'source/phaser/assets/icons/defense_energy.png');
    this.load.image('icon_utility', 'source/phaser/assets/icons/utility_energy.png');
    this.load.image('icon_energized', 'source/phaser/assets/icons/energized.png');
  }

  create(){
    this.cameras.main.setScroll(0,0);
    this._bindEvents();
    // Reflow UI on browser resize
    this._onResize = ()=>{
      this._clearPanels();
      this._renderPanels();
    };
    this.scale.on('resize', this._onResize);

    // If party already present, render immediately
    const selectedParty = this.registry.get('selectedParty');
    if (Array.isArray(selectedParty) && selectedParty.length){
      this._initParty(selectedParty);
    }
  }

  shutdown(){
    this._unbindEvents();
    if (this._onResize){ this.scale.off('resize', this._onResize); this._onResize = null; }
  }

  _bindEvents(){
    if (this._bound) return;
    this._onInit = ({ party }) => this._initParty(party);
    this._onSetActive = ({ index }) => this._setActive(index);
    this._onUpdateCP = ({ index, cp }) => this._updateCP(index, cp);
    this._onUpdateSpells = ({ index, spells }) => this._updateSpells(index, spells);
    this.game.events.on('ui:initParty', this._onInit);
    this.game.events.on('ui:setActiveHero', this._onSetActive);
    this.game.events.on('ui:updateCP', this._onUpdateCP);
    this.game.events.on('ui:updateSpells', this._onUpdateSpells);
    this._bound = true;
  }

  _unbindEvents(){
    if (!this._bound) return;
    this.game.events.off('ui:initParty', this._onInit);
    this.game.events.off('ui:setActiveHero', this._onSetActive);
    this.game.events.off('ui:updateCP', this._onUpdateCP);
    this.game.events.off('ui:updateSpells', this._onUpdateSpells);
    this._bound = false;
  }

  _initParty(party){
    // Normalize
    this.party = (party || []).map((p, i)=>({
      heroName: p.heroName || `Hero ${i+1}`,
      className: p.className || 'Adventurer',
      weaponName: p.weaponName || 'Weapon',
      elements: Array.isArray(p.elements) ? p.elements : [],
      cp: typeof p.cp === 'number' ? p.cp : 3,
      spells: Array.isArray(p.spells) ? p.spells : [],
      elementsMana: p.elementsMana || { Fire:0, Water:0, Plant:0, Air:0, Lightning:0, Earth:0 },
      energyPool: p.energyPool || { A:0, D:0, U:0, E:0 }
    }));

    this._clearPanels();
    this._renderPanels();
  }

  _setActive(index){
    this.activeHeroIndex = index|0;
    this.heroPanels.forEach((panel, i)=>{
      if (!panel) return;
      panel.outline.setStrokeStyle(2, i===this.activeHeroIndex ? 0xf59e0b : 0x475569);
    });
  }

  _updateCP(index, cp){
    const panel = this.heroPanels[index];
    if (panel && panel.cpText){ panel.cpText.setText(String(cp)); }
    if (this.party[index]) this.party[index].cp = cp;
  }

  _updateSpells(index, spells){
    const panel = this.heroPanels[index];
    if (this.party[index]) this.party[index].spells = spells.slice();
    if (panel){ this._renderSpellSlots(panel, this.party[index]); }
  }

  _clearPanels(){
    this.children.removeAll(true);
    this.heroPanels = [];
  }

  _renderPanels(){
    const { width: W, height: H } = this.scale;
    // Target portrait ratio 1170x2532 (approx 0.462 : 1)
    const designW = 1170, designH = 2532, aspect = designW / designH; // ~0.462
    const padding = 0; // no gaps or outer margins
    // Panels must fill the full vertical height with two stacked per side
    const panelHeight = Math.floor(H / 2); // top panels
    const panelHeightBottom = H - panelHeight; // bottom panels take the remainder to avoid gaps
    const panelWidth = Math.floor(panelHeight * aspect);
    // Center square area fits exactly between left/right panels
    const centerAvailableW = Math.max(0, W - 2 * panelWidth);
    const centerSize = Math.min(H, centerAvailableW);
    const centerX = Math.floor(W / 2);
    const centerY = Math.floor(H / 2);
    const centerRect = { x: centerX, y: centerY, width: centerSize, height: centerSize, size: centerSize };
    // Expose layout for other scenes
    const layout = { panel: { width: panelWidth, height: panelHeight, aspect }, center: centerRect, screen: { width: W, height: H } };
    this.registry.set('uiLayout', layout);
    this.game.events.emit('ui:layout', layout);
    const positions = [
      { x: 0, y: 0, h: panelHeight },
      { x: W - panelWidth, y: 0, h: panelHeight },
      { x: 0, y: H - panelHeightBottom, h: panelHeightBottom },
      { x: W - panelWidth, y: H - panelHeightBottom, h: panelHeightBottom }
    ];

    this.party.slice(0,4).forEach((member, index)=>{
      const pos = positions[index];
      const centerX = pos.x + panelWidth/2;
      const ph = pos.h; // per-panel height (top vs bottom)

      // Gradient background per class
      const texKey = this._ensureGradientTexture({
        className: member.className,
        primary: (member.elements && member.elements[0]) || 'Air',
        secondary: (member.elements && member.elements[1]) || 'Earth',
        width: panelWidth,
        height: ph
      });
      const bg = this.add.image(centerX, pos.y + ph/2, texKey)
        .setDisplaySize(panelWidth, ph)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', ()=> this.game.events.emit('ui:setActiveHero', { index }));

      const outline = this.add.rectangle(centerX, pos.y + ph/2, panelWidth, ph)
        .setStrokeStyle(2, index===this.activeHeroIndex?0xf59e0b:0x475569)
        .setFillStyle(0x000000, 0);

      // Internal margins and typography scale with panel size
      const m = Math.max(10, Math.floor(panelWidth * 0.05));
      const headerY = pos.y + m + 6;
      const fontSmall = Math.max(10, Math.floor(panelWidth * 0.08));
      const fontTiny = Math.max(9, Math.floor(panelWidth * 0.07));
      const nameText = this.add.text(pos.x + m, headerY, member.heroName, { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' }).setOrigin(0,0.5);
      const classText = this.add.text(pos.x + panelWidth - m, headerY, member.className, { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' }).setOrigin(1,0.5);

      // Portrait placeholder (28% of panel height)
      const portraitH = Math.floor(ph * 0.28);
      const portraitW = panelWidth - 2*m;
      const portraitTop = headerY + m + Math.floor(fontSmall*0.6);
      const portrait = this.add.rectangle(centerX, portraitTop + portraitH/2, portraitW, portraitH, 0x0f172a).setStrokeStyle(1, 0x1f2937);

      // Element Mana indicators (left column)
      const leftX = pos.x + m;
      let rowY = portraitTop + portraitH + m + 10;
      this.add.text(leftX, rowY - (fontTiny+2), 'Mana', { fontFamily:'system-ui, Arial', fontSize:`${fontTiny}px`, color:'#0b1220' });
      const elements = ['Fire','Water','Plant','Air','Lightning','Earth'];
      const iconSize = Math.max(12, Math.floor(panelWidth * 0.08));
      const gap = Math.max(3, Math.floor(panelWidth * 0.02));
      elements.forEach((el, i)=>{
        const y = rowY + i*(iconSize + gap);
        const color = this._getElementColor(el);
        this.add.circle(leftX + iconSize/2, y, iconSize/2, color, 1).setStrokeStyle(1, 0x111827);
        const val = (member.elementsMana && typeof member.elementsMana[el]==='number') ? member.elementsMana[el] : 0;
        this.add.text(leftX + iconSize + 6, y - Math.floor(iconSize*0.55), String(val), { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' });
      });

      // Energy star counters (A/D/U/E)
      const starsY = portraitTop + portraitH + m + 10;
      const starX0 = pos.x + panelWidth - (m + 4*24);
      const starVals = member.energyPool || { A:0,D:0,U:0,E:0 };
      const spec = [
        { key:'A', color: 0xef4444, icon:'icon_attack' }, // Red = Attack
        { key:'D', color: 0x3b82f6, icon:'icon_defense' }, // Blue = Defense
        { key:'U', color: 0x10b981, icon:'icon_utility' }, // Green = Utility
        { key:'E', color: 0xffffff, icon:'icon_energized' }  // White = Energized
      ];
      spec.forEach((s, i)=>{
        const x = starX0 + i*24;
        if (this.textures.exists(s.icon)){
          this.add.image(x, starsY, s.icon).setDisplaySize(16,16).setOrigin(0.5);
        } else {
          this.add.star(x, starsY, 5, 4, 7, s.color, 1).setStrokeStyle(1, 0x111827);
        }
        this.add.text(x + 10, starsY - 8, String(starVals[s.key]||0), { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' });
      });

      // CP row
      const cpY = rowY + 6* (iconSize + gap) + m;
      this.add.text(leftX, cpY, 'CP:', { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' });
      const cpText = this.add.text(leftX + Math.max(24, Math.floor(panelWidth*0.12)), cpY, String(member.cp||0), { fontFamily:'system-ui, Arial', fontSize:`${fontSmall}px`, color:'#0b1220' });

      // Spell grid 2x3 with card aspect 3.5:2.5 (portrait). Ensure no overlap when toggled to landscape.
      const gridTop = cpY + Math.max(12, Math.floor(ph*0.02));
      const cols = 3, rows = 2;
      const gridSidePadding = m;
      const gridMaxWidth = panelWidth - gridSidePadding*2;
      const gridBottomMargin = m;
      const remainingH = (pos.y + ph - gridBottomMargin) - gridTop;
      const gridGap = Math.max(6, Math.floor(panelWidth*0.035));
      const cellW = Math.floor((gridMaxWidth - gridGap*(cols-1)) / cols);
      const cellH = Math.floor((remainingH - gridGap*(rows-1)) / rows);
      // Card portrait aspect h:w = 3.5:2.5 => h = 1.4*w
      // Fit both portrait (w x 1.4w) and landscape (1.4w x w) within the cell
      const cardWPortraitMaxByWidth = Math.floor(cellW / 1.4); // from landscape width constraint
      const cardWPortraitMaxByHeight = Math.floor(cellH / 1.4); // from portrait height constraint
      const cardW = Math.max(10, Math.min(cardWPortraitMaxByWidth, cardWPortraitMaxByHeight));
      const cardH = Math.floor(cardW * 1.4);
      const totalGridH = rows*cardH + (rows-1)*gridGap;
      const startX = pos.x + gridSidePadding + cardW/2;
      const startY = gridTop + Math.max(0, Math.floor((remainingH - totalGridH)/2));
      const slots = [];
      for (let r=0; r<rows; r++){
        for (let c=0; c<cols; c++){
          const sx = startX + c*(cellW + gridGap);
          const sy = startY + r*(cellH + gridGap);
          // Create a container rect that always centers the card; card can switch between portrait and landscape safely
          const rect = this.add.rectangle(sx, sy, cardW, cardH, 0x0f172a).setStrokeStyle(1, 0x374151);
          rect.setInteractive({ useHandCursor: true });
          const slot = { bg: rect, content: null, state: 'portrait' };
          rect.on('pointerdown', ()=>{
            // Toggle orientation
            slot.state = (slot.state === 'portrait') ? 'landscape' : 'portrait';
            const isPortrait = slot.state === 'portrait';
            const w = isPortrait ? cardW : cardH;
            const h = isPortrait ? cardH : cardW;
            rect.setSize(w, h);
            rect.setDisplaySize(w, h);
            if (slot.content) {
              slot.content.setAngle(isPortrait ? 0 : 90);
              // Resize content to fit current rect with small padding
              const availW = rect.width - 8;
              const availH = rect.height - 8;
              const imgW = Math.min(availW, Math.floor(availH / 1.4));
              const imgH = Math.floor(imgW * 1.4);
              slot.content.setDisplaySize(imgW, imgH);
              // Keep centered
              slot.content.setPosition(rect.x, rect.y);
            }
          });
          slots.push(slot);
        }
      }

      const panel = { outline, nameText, classText, portrait, cpText, slots };
      this.heroPanels[index] = panel;
      this._renderSpellSlots(panel, member);
    });
  }

  _renderSpellSlots(panel, member){
    if (!panel || !panel.slots) return;
    panel.slots.forEach(s=>{ if (s.content){ s.content.destroy(); s.content=null; } });
    const spells = (member && member.spells) ? member.spells : [];
    const max = Math.min(spells.length, panel.slots.length);
    for (let i=0; i<max; i++){
      const slot = panel.slots[i];
      const key = String(spells[i]);
      const isPortrait = (slot.state ?? 'portrait') === 'portrait';
      const texKey = `spell_${key}`;
      const path = `source/phaser/assets/spellcards/${key}.png`;
      const place = () => {
        if (this.textures.exists(texKey)){
          const img = this.add.image(slot.bg.x, slot.bg.y, texKey).setOrigin(0.5);
          img.setAngle(isPortrait ? 0 : 90);
          const availW = slot.bg.width - 8;
          const availH = slot.bg.height - 8;
          const imgW = Math.min(availW, Math.floor(availH / 1.4));
          const imgH = Math.floor(imgW * 1.4);
          img.setDisplaySize(imgW, imgH);
          panel.slots[i].content = img;
        } else {
          // Fallback placeholder rect
          const ph = this.add.rectangle(slot.bg.x, slot.bg.y, Math.max(10, slot.bg.width-8), Math.max(10, slot.bg.height-8), 0x0f172a).setStrokeStyle(1, 0x374151);
          ph.setAngle(isPortrait ? 0 : 90);
          panel.slots[i].content = ph;
        }
      };
      if (!this.textures.exists(texKey)){
        this.load.image(texKey, path);
        const onFile = (keyLoaded)=>{ if (keyLoaded===texKey){ place(); this.load.off('filecomplete', onFile);} };
        this.load.on('filecomplete', onFile);
        this.load.start();
      } else {
        place();
      }
    }
  }

  _getElementColor(element){
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

  _ensureGradientTexture({ className, primary, secondary, width, height }){
    const key = `panel_${className}_${width}x${height}`;
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, width, height);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, width, height); // TL -> BR
    const p = Phaser.Display.Color.IntegerToColor(this._getElementColor(primary)).rgba;
    const s = Phaser.Display.Color.IntegerToColor(this._getElementColor(secondary)).rgba;
    grad.addColorStop(0, p);
    grad.addColorStop(1, s);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    // subtle header strip for readability
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, width, 28);
    tex.refresh();
    return key;
  }
}
