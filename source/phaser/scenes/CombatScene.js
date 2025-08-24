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
    this.spellsData = null;
    this.abilitiesLayer = null;
    // Battle map state (hex grid)
    this.grid = null; // 2D array: rows x cols of hex cells
    this.hexSize = 36; // radius of flat-top hex in pixels
    this.boardOrigin = { x: 420, y: 140 }; // screen origin for board (top-left-ish visual origin)
    this.mapKey = null; // phaser texture key for the selected map PNG
    this.blockedSet = new Set(); // indices of tiles that block movement/LOS
    // Debug/align controls
    this.sampleOrigin = { x: 36, y: 36 }; // where the first hex center lies in the PNG
    this.showOverlay = false; // hide PNG underlay by default for clarity
    this.overlaySprite = null;
    this._calibrating = false;
    this._calibPoints = [];
    // Load persisted calibration if available
    this._loadCalibration && this._loadCalibration();
    // Cached center layout provided by UIScene
    this._centerArea = null;
  }

  // ---- Debug helpers ----
  _rebuildGrid(){
    const parsed = this._parseGridFromMapTexture(this.mapKey);
    this.grid = parsed.grid;
    this.rows = parsed.rows;
    this.cols = parsed.cols;
    this.gridLayer.removeAll(true);
    this._renderGrid(parsed.rows, parsed.cols);
    this._computeBlockedSet();
  }

  _setupAlignControls(){
    if (this._alignControlsSetup) return;
    this._alignControlsSetup = true;
    this.input.keyboard.on('keydown-O', () => {
      this.showOverlay = !this.showOverlay;
      if (this.overlaySprite) this.overlaySprite.setAlpha(this.showOverlay ? 0.25 : 0);
    });
    this.input.keyboard.on('keydown-UP', () => { this.sampleOrigin.y = Math.max(0, this.sampleOrigin.y - 1); this._rebuildGrid(); });
    this.input.keyboard.on('keydown-DOWN', () => { this.sampleOrigin.y += 1; this._rebuildGrid(); });
    this.input.keyboard.on('keydown-LEFT', () => { this.sampleOrigin.x = Math.max(0, this.sampleOrigin.x - 1); this._rebuildGrid(); });
    this.input.keyboard.on('keydown-RIGHT', () => { this.sampleOrigin.x += 1; this._rebuildGrid(); });
    this.input.keyboard.on('keydown-Q', () => { this.hexSize = Math.max(10, this.hexSize - 1); this._rebuildAndResizeOverlay(); });
    this.input.keyboard.on('keydown-E', () => { this.hexSize = Math.min(96, this.hexSize + 1); this._rebuildAndResizeOverlay(); });
    this.input.keyboard.on('keydown-C', () => {
      this._startCalibration();
    });
    // Persist/clear calibration
    this.input.keyboard.on('keydown-S', () => { this._saveCalibration && this._saveCalibration(); });
    this.input.keyboard.on('keydown-K', () => { this._clearCalibration && this._clearCalibration(); });
  }

  _rebuildAndResizeOverlay(){
    // Overlay is unscaled because we draw at native size; just rebuild grid for new hex size
    this._rebuildGrid();
  }

  _startCalibration(){
    this._calibrating = true;
    this._calibPoints = [];
    this.logMessage('Calibration: Click origin hex center, then its right neighbor, then its down-right neighbor.');
    this.input.once('pointerdown', (p)=> this._collectCalibPoint(p));
  }

  _collectCalibPoint(pointer){
    const x = pointer.worldX - this.boardOrigin.x;
    const y = pointer.worldY - this.boardOrigin.y;
    this._calibPoints.push({x,y});
    const needed = 3 - this._calibPoints.length;
    if (needed > 0){
      this.logMessage(`Calibration: ${needed} more point(s)...`);
      this.input.once('pointerdown', (p)=> this._collectCalibPoint(p));
      return;
    }
    // points: P0 (q=0,r=0), P1 (q=1,r=0), P2 (q=0,r=1) in flat-top
    const [P0, P1, P2] = this._calibPoints;
    const dx = P1.x - P0.x;
    const dy = P1.y - P0.y;
    const dist01 = Math.hypot(dx, dy);
    // In flat-top, delta between q neighbors is 1.5*R horizontally
    const R = dist01 / 1.5;
    // Compute sampleOrigin so that (q=0,r=0) -> P0
    // For flat-top: pixel(q,r) = (1.5R*q, sqrt(3)R*(r+q/2)) + origin
    const originX = P0.x - 0;
    const originY = P0.y - 0;
    // Validate P2 alignment (should be ~ (q=0,r=1) offset of sqrt(3)R)
    const expectedP2 = { x: originX + 0, y: originY + Math.sqrt(3)*R };
    const err = Math.hypot(expectedP2.x - P2.x, expectedP2.y - P2.y);
    if (err > R*0.6){
      this.logMessage('Calibration warning: clicks may not be on adjacent hex centers. Using best estimate.');
    }
    this.hexSize = Math.max(10, Math.min(120, R));
    this.sampleOrigin = { x: originX, y: originY };
    this._calibrating = false;
    this._calibPoints = [];
    this.logMessage(`Calibrated. R=${this.hexSize.toFixed(1)} origin=(${this.sampleOrigin.x.toFixed(1)},${this.sampleOrigin.y.toFixed(1)})`);
    this._rebuildGrid();
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
    
    // Bind to UI layout from UIScene (center square between panels)
    this._applyUILayout(this.registry.get('uiLayout'));
    this._onUILayout = (layout) => this._applyUILayout(layout);
    this.game.events.on('ui:layout', this._onUILayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this._onUILayout){
        this.game.events.off('ui:layout', this._onUILayout);
        this._onUILayout = null;
      }
    });
    
    // Create basic UI chrome (respect center area)
    this.createCombatUI();
    // Load spells data (non-blocking)
    this.loadSpells();

    // Build battle map, then start combat once ready
    this.setupBattleMap().then(() => {
      this.startCombat();
    }).catch(err => {
      console.warn('Battle map setup failed, starting combat anyway', err);
      this.startCombat();
    });
    
    // Debug: Press 'D' to win combat
    this.input.keyboard.on('keydown-D', () => this.endCombat(true));
    // Debug: Press 'P' to rebuild a procedural map immediately
    this.input.keyboard.on('keydown-P', () => {
      this._buildProceduralAndRender();
    });
  }
  
  createCombatUI() {
    // Combat log and action buttons within center area
    this.createCombatLog();
    this.createActionButtons();
  }

  // ----- Battle Map Loading & Parsing -----
  async setupBattleMap(){
    // If caller requested procedural map, skip PNG loading
    if (this.registry.get('useProcMap')) {
      this._buildProceduralAndRender();
      return;
    }
    // Determine difficulty; default to 'easy'. Later, wire from MapScene or registry.
    const difficulty = this.registry.get('encounterDifficulty') || 'easy';
    // Always use built-in list to avoid network issues
    const builtin = {
      easy: [
        "Screenshot_2025-04-19_184813 1.png","Screenshot_2025-04-19_184813 13.png","Screenshot_2025-04-19_184813 18.png","Screenshot_2025-04-19_184813 2.png",
        "Screenshot_2025-04-19_184813 22.png","Screenshot_2025-04-19_184813 23.png","Screenshot_2025-04-19_184813 26.png","Screenshot_2025-04-19_184813 27.png",
        "Screenshot_2025-04-19_184813 31.png","Screenshot_2025-04-19_184813 35.png","Screenshot_2025-04-19_184813 40.png","Screenshot_2025-04-19_184813 41.png",
        "Screenshot_2025-04-19_184813 43.png","Screenshot_2025-04-19_184813 44.png","Screenshot_2025-04-19_184813 47.png","Screenshot_2025-04-19_184813 5.png",
        "Screenshot_2025-04-19_184813 52.png","Screenshot_2025-04-19_184813 56.png","Screenshot_2025-04-19_184813 60.png","Screenshot_2025-04-19_184813 9.png"
      ],
      medium: [
        "Screenshot_2025-04-19_184813 10.png","Screenshot_2025-04-19_184813 11.png","Screenshot_2025-04-19_184813 14.png","Screenshot_2025-04-19_184813 19.png",
        "Screenshot_2025-04-19_184813 24.png","Screenshot_2025-04-19_184813 28.png","Screenshot_2025-04-19_184813 3.png","Screenshot_2025-04-19_184813 32.png",
        "Screenshot_2025-04-19_184813 36.png","Screenshot_2025-04-19_184813 37.png","Screenshot_2025-04-19_184813 45.png","Screenshot_2025-04-19_184813 48.png",
        "Screenshot_2025-04-19_184813 53.png","Screenshot_2025-04-19_184813 57.png","Screenshot_2025-04-19_184813 6.png","Screenshot_2025-04-19_184813 61.png"
      ],
      hard: [
        "Screenshot_2025-04-19_184813 12.png","Screenshot_2025-04-19_184813 15.png","Screenshot_2025-04-19_184813 16.png","Screenshot_2025-04-19_184813 20.png",
        "Screenshot_2025-04-19_184813 21.png","Screenshot_2025-04-19_184813 25.png","Screenshot_2025-04-19_184813 29.png","Screenshot_2025-04-19_184813 30.png",
        "Screenshot_2025-04-19_184813 33.png","Screenshot_2025-04-19_184813 38.png","Screenshot_2025-04-19_184813 39.png","Screenshot_2025-04-19_184813 4.png",
        "Screenshot_2025-04-19_184813 42.png","Screenshot_2025-04-19_184813 46.png","Screenshot_2025-04-19_184813 49.png","Screenshot_2025-04-19_184813 50.png",
        "Screenshot_2025-04-19_184813 54.png","Screenshot_2025-04-19_184813 55.png","Screenshot_2025-04-19_184813 58.png","Screenshot_2025-04-19_184813 59.png",
        "Screenshot_2025-04-19_184813 62.png","Screenshot_2025-04-19_184813 63.png","Screenshot_2025-04-19_184813 7.png","Screenshot_2025-04-19_184813 8.png"
      ]
    };
    let list = builtin[difficulty] || builtin.easy;
    if (!list.length) throw new Error('No maps found for difficulty');
    const file = list[Math.floor(Math.random() * list.length)];
    // Use absolute path to avoid relative resolution issues
    const path = encodeURI(`/source/phaser/assets/Battle Maps/${this._folderFor(difficulty)}/${file}`);
    console.log('Loading battle map image:', path);

    // Dynamically load the image into Phaser
    this.mapKey = `battlemap_${difficulty}_${Date.now()}`;
    await this._loadImageAsync(this.mapKey, path);

    // Compute board origin centered within the UIScene center area
    const srcImg = this.textures.get(this.mapKey).getSourceImage();
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const area = this._centerArea || { x: Math.floor(viewW/2), y: Math.floor(viewH/2), width: viewW, height: viewH };
    this.boardOrigin = {
      x: Math.floor(area.x - srcImg.width / 2),
      y: Math.floor(area.y - srcImg.height / 2)
    };

    // Create/position debug overlay (under grid)
    if (this.overlaySprite) this.overlaySprite.destroy();
    this.overlaySprite = this.add.image(this.boardOrigin.x, this.boardOrigin.y, this.mapKey)
      .setOrigin(0, 0)
      .setAlpha(this.showOverlay ? 0.25 : 0)
      .setDepth(-20);

    // Prepare grid layer for easy clearing
    if (this.gridLayer) this.gridLayer.destroy(true);
    this.gridLayer = this.add.layer();
    this.gridLayer.setDepth(-10); // ensure grid stays under UI

    // Parse pixels into a grid and render (now that origin is centered)
    this._rebuildGrid();

    // Place party and enemies according to blue/red tiles
    await this._placeUnitsFromGrid({ rows: this.rows, cols: this.cols });

    // Setup debug controls for alignment
    this._setupAlignControls();
  }

  // ---- UIScene layout integration ----
  _applyUILayout(layout){
    if (!layout || !layout.center) return;
    const c = layout.center; // { x, y, size } square
    this._centerArea = { x: c.x, y: c.y, width: c.size, height: c.size };
    // If UI already exists, rebuild center-dependent UI
    if (this.logBg || this.abilitiesLayer) {
      this._rebuildCenterUI();
    }
  }

  _rebuildCenterUI(){
    // Destroy and recreate log and action buttons to respect new layout
    if (this.logBg) { this.logBg.destroy(); this.logBg = null; }
    if (this.logText) { this.logText.destroy(); this.logText = null; }
    // Action buttons are ephemeral; rely on re-creation (no handles kept)
    this.createCombatLog();
    this.createActionButtons();
  }

  _buildProceduralAndRender(){
    // Remove overlay if present
    if (this.overlaySprite) { this.overlaySprite.destroy(); this.overlaySprite = null; }
    if (this.gridLayer) this.gridLayer.destroy(true);
    this.gridLayer = this.add.layer();
    const dims = this._buildProceduralGrid(13, 17); // rows, cols
    this._renderGrid(dims.rows, dims.cols);
    this._placeUnitsFromGrid(dims);
    this._computeBlockedSet();
    this.logMessage('Procedural map generated (press P again to re-roll).');
  }

  _buildProceduralGrid(rows, cols){
    // Create a reasonable board with left/right spawn zones and scattered walls
    const R = this.hexSize;
    this.rows = rows; this.cols = cols;
    this.grid = new Array(rows).fill(null).map(()=> new Array(cols).fill(null));
    const noise = (q,r)=>{
      const s = Math.sin((q*37 + r*57) * 0.25);
      return (s + 1)/2; // 0..1
    };
    for (let r=0; r<rows; r++){
      for (let q=0; q<cols; q++){
        const p = this._hexFlatToPixel(q, r, R);
        const x = this.boardOrigin.x + p.x;
        const y = this.boardOrigin.y + p.y;
        let type = 'ground';
        // Spawn bands: first 3 cols blue, last 3 cols red
        if (q <= 2) type = 'playerSpawn';
        else if (q >= cols - 3) type = 'enemySpawn';
        // Random obstacles in the middle band only
        if (q >= 3 && q <= cols - 4){
          if (noise(q,r) > 0.82) type = 'wall';
        }
        this.grid[r][q] = { type, row:r, col:q, x, y, q, r };
      }
    }
    return { rows, cols };
  }

  _folderFor(diff){
    if (diff === 'hard') return 'Hard Maps';
    if (diff === 'medium') return 'Medium Maps';
    return 'Easy Maps';
  }

  _loadImageAsync(key, url){
    return new Promise((resolve, reject) => {
      this.load.image(key, url);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.LOAD_ERROR, (_file) => reject(new Error('Load error')));
      this.load.start();
    });
  }

  _parseGridFromMapTexture(texKey){
    const tex = this.textures.get(texKey);
    const src = tex.getSourceImage();
    const imgW = src.width, imgH = src.height;

    const R = this.hexSize; // radius
    const stepX = 1.5 * R; // horizontal spacing between hex centers (flat-top)
    const stepY = Math.sqrt(3) * R; // vertical spacing per r-step

    // Estimate grid bounds that fit within the PNG using sampling origin
    const originX = this.sampleOrigin.x;
    const originY = this.sampleOrigin.y;
    const cols = Math.max(1, Math.floor((imgW - originX - R) / stepX) + 1);
    const rows = Math.max(1, Math.floor((imgH - originY - (Math.sqrt(3)/2)*R) / (Math.sqrt(3)*R)) + 1);
    const grid = new Array(rows).fill(null).map(() => new Array(cols).fill(null));

    // Robust color classification
    const classify = (r,g,b) => {
      // Hard white/black
      if (r > 245 && g > 245 && b > 245) return 'void';
      if (r < 15 && g < 15 && b < 15) return 'wall';
      // Channel-dominance rules
      if (r >= 160 && g <= 110 && b <= 110) return 'enemySpawn'; // red dominant
      if (b >= 160 && r <= 110 && g <= 170) return 'playerSpawn'; // blue dominant
      // If near white/black after compression
      const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
      if (maxc - minc < 12) { // nearly gray
        if (maxc > 240) return 'void';
        if (maxc < 20) return 'wall';
      }
      return 'ground';
    };

    let counts = { void:0, wall:0, ground:0, playerSpawn:0, enemySpawn:0 };
    for (let r = 0; r < rows; r++){
      for (let q = 0; q < cols; q++){
        // Axial (q,r) -> pixel center within the PNG (with sampling origin)
        const px = originX + R * (1.5 * q);
        const py = originY + R * (Math.sqrt(3) * (r + q/2));
        if (px >= imgW || py >= imgH) {
          grid[r][q] = null; // outside image
          continue;
        }
        const pixel = this.textures.getPixel(Math.floor(px), Math.floor(py), texKey);
        const type = classify(pixel.r, pixel.g, pixel.b);
        if (counts[type] !== undefined) counts[type]++;
        const world = this._hexFlatToPixel(q, r, R);
        const worldX = this.boardOrigin.x + world.x;
        const worldY = this.boardOrigin.y + world.y;
        grid[r][q] = { type, row: r, col: q, x: worldX, y: worldY, q, r };
      }
    }
    console.log(`Parsed grid: ${rows}x${cols}  counts`, counts, `R=${R}`, `origin=(${originX},${originY})`);
    return { grid, rows, cols };
  }

  _renderGrid(rows, cols){
    const R = this.hexSize;
    for (let r=0; r<rows; r++){
      for (let q=0; q<cols; q++){
        const tile = this.grid[r][q];
        if (!tile) continue;
        let color = 0x475569; // ground default
        if (tile.type === 'wall') color = 0x111827;
        if (tile.type === 'void') color = 0xffffff;
        if (tile.type === 'playerSpawn') color = 0x3b82f6;
        if (tile.type === 'enemySpawn') color = 0xef4444;
        const points = this._hexCornersFlat(tile.x, tile.y, R);
        const poly = this.add.polygon(tile.x, tile.y, points, 0xffffff).setOrigin(0.5);
        // Outline-first rendering: ground has no fill, others semi-transparent
        if (tile.type === 'ground') {
          poly.setFillStyle(color, 0);
          poly.setStrokeStyle(1, 0x0b1220, 0.6);
        } else if (tile.type === 'void') {
          poly.setFillStyle(color, 0.9);
          poly.setStrokeStyle(1, 0x111827, 0.8);
        } else if (tile.type === 'wall') {
          poly.setFillStyle(color, 0.9);
          poly.setStrokeStyle(1, 0x000000, 0.9);
        } else {
          // spawns
          poly.setFillStyle(color, 0.6);
          poly.setStrokeStyle(1, 0x000000, 0.8);
        }
        this.gridLayer.add(poly);
      }
    }
  }

  // Build a fast lookup set of blocked tiles for LOS/movement
  _computeBlockedSet(){
    this.blockedSet = new Set();
    if (!this.grid || !this.rows || !this.cols) return;
    for (let r=0; r<this.rows; r++){
      for (let q=0; q<this.cols; q++){
        const t = this.grid[r][q];
        if (!t) continue;
        if (t.type === 'wall' || t.type === 'void'){
          this.blockedSet.add(this._indexFromQR(q, r));
        }
      }
    }
  }

  // ---- Hex helpers (flat-top) ----
  _hexFlatToPixel(q, r, R){
    const x = R * (1.5 * q);
    const y = R * (Math.sqrt(3) * (r + q/2));
    return { x, y };
  }

  _hexCornersFlat(cx, cy, R){
    // flat-top orientation starting at angle 0deg, step 60deg
    const angles = [0, 60, 120, 180, 240, 300].map(a => (Math.PI/180)*a);
    const pts = [];
    for (const a of angles){
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      pts.push(x, y);
    }
    return pts;
  }

  // Linearize axial q,r into a single integer index for fast Set lookups
  _indexFromQR(q, r){
    // Guard against undefined cols
    const cols = Math.max(0, this.cols | 0);
    return r * cols + q;
  }

  async _placeUnitsFromGrid(parsed){
    const spawnBlue = [];
    const spawnRed = [];
    const ground = [];
    for (let r=0; r<parsed.rows; r++){
      for (let c=0; c<parsed.cols; c++){
        const t = this.grid[r][c];
        if (!t || !t.type) continue;
        if (t.type === 'playerSpawn') spawnBlue.push(t);
        else if (t.type === 'enemySpawn') spawnRed.push(t);
        else if (t.type === 'ground') ground.push(t);
      }
    }

    if (spawnBlue.length === 0) {
      console.warn('No blue spawn tiles found. Using ground tiles as fallback.');
      Phaser.Utils.Array.Shuffle(ground);
      spawnBlue.push(...ground.slice(0, Math.max(1, Math.min(4, ground.length))));
    }
    if (spawnRed.length === 0) {
      console.warn('No red spawn tiles found. Using ground tiles as fallback.');
      Phaser.Utils.Array.Shuffle(ground);
      spawnRed.push(...ground.slice(0, Math.max(1, Math.min(4, ground.length))));
    }
    // Randomly choose 4 blue tiles
    Phaser.Utils.Array.Shuffle(spawnBlue);
    const partySpawns = spawnBlue.slice(0, Math.min(4, this.party.length, spawnBlue.length));
    this.party.forEach((p, i) => {
      const tile = partySpawns.length ? partySpawns[i % partySpawns.length] : null;
      if (!tile) return;
      p.pos = { row: tile.row, col: tile.col };
      // Render token
      const token = this.add.circle(tile.x, tile.y, 18, 0x22c55e).setStrokeStyle(2, 0x064e3b);
      token.setDepth(10);
      this.add.text(tile.x, tile.y-28, p.name || 'Hero', { fontFamily:'Arial', fontSize:'12px', color:'#e5e7eb' }).setOrigin(0.5).setDepth(11);
      p._token = token;
    });

    // Build enemies from commons if not provided, count = red tiles
    if (!this.enemies || this.enemies.length === 0){
      try{
        const res = await fetch('source/data/enemies.json', { cache: 'no-store' });
        const data = await res.json();
        const commons = (data.enemies || []).filter(e => (e.rarity || 'common').toLowerCase() === 'common');
        Phaser.Utils.Array.Shuffle(spawnRed);
        const count = Math.min(spawnRed.length, 6); // cap to avoid overload
        this.enemies = new Array(count).fill(null).map((_, idx) => {
          const base = commons[idx % commons.length] || { name:'Shadow Sprite', health:10, attack:2 };
          return {
            name: base.name,
            maxHealth: base.health || 10,
            health: base.health || 10,
            attack: base.attack || 2
          };
        });
      }catch(e){
        console.warn('Failed to build enemies from commons', e);
      }
    }

    // Place enemies on red tiles
    Phaser.Utils.Array.Shuffle(spawnRed);
    this.enemies.forEach((e, i) => {
      if (!spawnRed.length) return;
      const tile = spawnRed[i % spawnRed.length];
      e.pos = { row: tile.row, col: tile.col };
      // Render token
      const token = this.add.rectangle(tile.x, tile.y, 32, 32, 0xef4444).setStrokeStyle(2, 0x7f1d1d).setOrigin(0.5);
      token.setDepth(10);
      this.add.text(tile.x, tile.y-28, e.name || 'Enemy', { fontFamily:'Arial', fontSize:'12px', color:'#fecaca' }).setOrigin(0.5).setDepth(11);
      e._token = token;
    });
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

      // Energy pool UI (A/D/U counts)
      member._ui = member._ui || {};
      member._ui.energyText = this.add.text(x - 20, y + 5, 'A:0  D:0  U:0', {
        fontFamily: 'Arial', fontSize: '14px', color: '#f8fafc'
      });
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
    const center = this._centerArea || { x: this.scale.width/2, y: this.scale.height/2, width: this.scale.width, height: this.scale.height };
    const buttonY = center.y + center.height/2 - 40;
    const spacing = Math.max(120, Math.floor(center.width * 0.18));
    
    const actions = [
      { 
        text: 'Attack', 
        x: center.x - spacing, 
        action: () => this.playerAction('attack') 
      },
      {
        text: 'Move',
        x: center.x - spacing * 2,
        action: () => this.playerAction('move')
      },
      { 
        text: 'Spells', 
        x: center.x, 
        action: () => this.showAbilities() 
      },
      { 
        text: 'Items', 
        x: center.x + spacing, 
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
    // Build a minimal overlay listing known spells for party[0]
    const actor = this.party[0];
    if (!actor) return;
    if (!this.spellsData) {
      this.logMessage('Spells loading...');
      return;
    }
    const known = actor.knownSpells || [];
    if (!known.length) {
      this.logMessage('No spells known.');
      return;
    }
    // Clear previous layer
    if (this.abilitiesLayer) {
      this.abilitiesLayer.clear(true, true);
    }
    this.abilitiesLayer = this.add.group();
    const { width: W, height: H } = this.scale;
    const panel = this.add.rectangle(W/2, H/2, 380, 220, 0x0f172a).setStrokeStyle(2, 0x94a3b8);
    this.abilitiesLayer.add(panel);
    const title = this.add.text(W/2, H/2 - 90, 'Spells', { fontFamily:'Arial', fontSize:'18px', color:'#e2e8f0' }).setOrigin(0.5);
    this.abilitiesLayer.add(title);
    // List entries
    let y = H/2 - 50;
    known.forEach((key, idx) => {
      const spell = this.findSpellByKey(key);
      const label = spell ? `${spell.name}  (A:1)` : `${key}  (A:1)`;
      const btn = this.add.rectangle(W/2, y + idx*36, 320, 28, 0x1e293b).setStrokeStyle(1, 0x64748b).setInteractive();
      const txt = this.add.text(W/2, y + idx*36, label, { fontFamily:'Arial', fontSize:'14px', color:'#f1f5f9' }).setOrigin(0.5);
      btn.on('pointerdown', () => {
        this.castSpell(key);
        this.hideAbilities();
      });
      this.abilitiesLayer.addMultiple([btn, txt]);
    });
    // Close button
    const closeBtn = this.add.rectangle(W/2, H/2 + 90, 100, 28, 0x334155).setStrokeStyle(1, 0x64748b).setInteractive();
    const closeTxt = this.add.text(W/2, H/2 + 90, 'Close', { fontFamily:'Arial', fontSize:'14px', color:'#e2e8f0' }).setOrigin(0.5);
    closeBtn.on('pointerdown', () => this.hideAbilities());
    this.abilitiesLayer.addMultiple([closeBtn, closeTxt]);
  }
  
  showItems() {
    // TODO: Implement item selection
    this.logMessage('Items not implemented yet!');
  }
  
  createCombatLog() {
    const center = this._centerArea || { x: this.scale.width/2, y: this.scale.height/2, width: this.scale.width-40, height: 200 };
    const logW = Math.max(240, Math.floor(center.width * 0.6));
    const logH = Math.min(120, Math.floor(center.height * 0.22));
    const cx = center.x;
    const cy = center.y + center.height/2 - logH/2 - 10;
    // Log background
    this.logBg = this.add.rectangle(cx, cy, logW, logH, 0x1e293b)
      .setStrokeStyle(1, 0x64748b);
    // Log text
    this.logText = this.add.text(cx - logW/2 + 12, cy - logH/2 + 10, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#e2e8f0',
      wordWrap: { width: logW - 24 }
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

    // Roll energy dice for each hero and update UI
    this.party.forEach(member => {
      member.energyPool = this.rollEnergyForMember(member);
      this.updateEnergyUI(member);
    });
  }

  rollEnergyForMember(member) {
    const energyPool = { A: 0, D: 0, U: 0 };
    for (let i = 0; i < member.maxEnergy; i++) {
      const roll = Math.floor(Math.random() * 3);
      switch (roll) {
        case 0:
          energyPool.A++;
          break;
        case 1:
          energyPool.D++;
          break;
        case 2:
          energyPool.U++;
          break;
      }
    }
    return energyPool;
  }

  updateEnergyUI(member) {
    const a = member.energyPool.A|0, d = member.energyPool.D|0, u = member.energyPool.U|0;
    const total = a+d+u;
    // legacy text if present
    if (member._ui && member._ui.energyText){
      member._ui.energyText.setText(`A:${a}  D:${d}  U:${u}`);
    }
    // mats bars
    if (member._mat){
      const m = member._mat;
      const cap = 10; // simple cap for bar visuals
      const energyWidth = Math.max(0, Math.min(cap, total)) / cap * (m.bars.width - 4);
      m.bars.energyFill.width = energyWidth;
      m.bars.energyTxt.setText(`${total}/${cap}`);
      const mana = member.mana|0;
      const manaWidth = Math.max(0, Math.min(cap, mana)) / cap * (m.bars.width - 4);
      m.bars.manaFill.width = manaWidth;
      m.bars.manaTxt.setText(`${mana}/${cap}`);
      const corruption = member.corruption|0;
      const corrCap = 10;
      const corrWidth = Math.max(0, Math.min(corrCap, corruption)) / corrCap * (m.bars.width - 4);
      m.bars.corrFill.width = corrWidth;
      m.bars.corrTxt.setText(`${corruption}/${corrCap}`);
    }
  }

  // ---- Player Mats (corner UI) ----
  createPlayerMatsUI(){
    const { width: W, height: H } = this.scale;
    const pad = 20;
    const matW = 280, matH = 190; // portrait area
    const cardW = 70, cardH = 96, cardGap = 10;
    const corners = [
      { name:'TL', x: pad, y: pad },
      { name:'TR', x: W - pad - matW, y: pad },
      { name:'BL', x: pad, y: H - pad - matH },
      { name:'BR', x: W - pad - matW, y: H - pad - matH }
    ];
    (this.party || []).slice(0,4).forEach((member, idx) => {
      const c = corners[idx];
      if (!c) return;
      this._createSingleMat(member, c.x, c.y, matW, matH, { cardW, cardH, cardGap }, idx);
    });
    // After mats exist, apply initial highlight
    this._updateActiveHighlight();
  }

  _createSingleMat(member, x, y, matW, matH, cards, index){
    const group = this.add.layer();
    group.setDepth(20);
    const frame = this.add.rectangle(x + matW/2, y + matH/2, matW, matH, 0x0b1220).setStrokeStyle(2, 0x64748b).setOrigin(0.5);
    group.add(frame);
    // Portrait placeholder
    const portrait = this.add.rectangle(x + matW/2, y + 70, matW - 16, 110, 0x1e293b).setStrokeStyle(1, 0x94a3b8);
    const nameTxt = this.add.text(x + 10, y + 8, member.name || 'Hero', { fontFamily:'Arial', fontSize:'14px', color:'#e5e7eb' });
    group.add(portrait);
    group.add(nameTxt);
    // Bars: Energy, Mana, Corruption
    const barsX = x + 12, barsY = y + 130, barsW = matW - 24, barsH = 12, gap = 16;
    const makeBar = (label, by, colorFill, colorStroke)=>{
      const lbl = this.add.text(barsX, by-12, label, { fontFamily:'Arial', fontSize:'12px', color:'#cbd5e1' });
      const bg = this.add.rectangle(barsX + barsW/2, by, barsW, barsH, 0x0f172a).setStrokeStyle(1, colorStroke).setOrigin(0.5,0.5);
      const fill = this.add.rectangle(barsX + 2, by, 0, barsH-4, colorFill).setOrigin(0,0.5);
      const txt = this.add.text(barsX + barsW - 34, by-10, '0/10', { fontFamily:'Arial', fontSize:'11px', color:'#e2e8f0' });
      group.add(lbl);
      group.add(bg);
      group.add(fill);
      group.add(txt);
      return { bg, fill, txt };
    };
    const energyBar = makeBar('Energy', barsY, 0x10b981, 0x134e4a);
    const manaBar = makeBar('Mana', barsY + gap, 0x60a5fa, 0x1d4ed8);
    const corrBar = makeBar('Corruption', barsY + gap*2, 0xf87171, 0x7f1d1d);
    // Spell cards (simple placeholders) to the side of portrait
    const startCX = x + matW + 12;
    const startCY = y + 12;
    const known = (member.knownSpells || []).slice(0,6);
    known.forEach((key, i) => {
      const cx = startCX + (i%3) * (cards.cardW + cards.cardGap);
      const cy = startCY + Math.floor(i/3) * (cards.cardH + cards.cardGap);
      const card = this.add.rectangle(cx + cards.cardW/2, cy + cards.cardH/2, cards.cardW, cards.cardH, 0x1f2937).setStrokeStyle(2, 0x94a3b8).setDepth(21);
      const label = this.add.text(cx + 6, cy + 6, (this.findSpellByKey(key)?.name) || key, { fontFamily:'Arial', fontSize:'11px', color:'#e5e7eb', wordWrap:{ width: cards.cardW-12 }}).setDepth(22);
      group.add(card);
      group.add(label);
    });
    // Interactions: clicking anywhere in the frame selects this hero
    frame.setInteractive({ useHandCursor: true });
    portrait.setInteractive({ useHandCursor: true });
    frame.on('pointerdown', () => this._setActiveHero(index));
    portrait.on('pointerdown', () => this._setActiveHero(index));

    member._mat = {
      group,
      frame,
      bars: {
        width: barsW,
        energyFill: energyBar.fill,
        energyTxt: energyBar.txt,
        manaFill: manaBar.fill,
        manaTxt: manaBar.txt,
        corrFill: corrBar.fill,
        corrTxt: corrBar.txt
      }
    };
  }

  _setActiveHero(index){
    if (typeof index !== 'number' || !this.party || index < 0 || index >= this.party.length) return;
    this.activeHeroIndex = index;
    this._updateActiveHighlight();
  }

  _updateActiveHighlight(){
    (this.party||[]).forEach((m, i) => {
      const isActive = i === this.activeHeroIndex;
      if (m._mat && m._mat.frame){
        m._mat.frame.setStrokeStyle(2, isActive ? 0xf59e0b : 0x64748b);
        m._mat.group.setDepth(isActive ? 25 : 20);
      }
      if (m._token){
        m._token.setScale(isActive ? 1.15 : 1.0);
        m._token.setStrokeStyle(isActive ? 3 : 2, isActive ? 0xf59e0b : 0x064e3b);
      }
    });
  }

  playerAction(action, target = null) {
    // Actions performed by the selected hero
    const actor = this.party[this.activeHeroIndex || 0];
    if (!actor || this.enemies.length === 0) return;

    // Move: consume any one energy if available
    if (action === 'move') {
      const spent = this.trySpendAnyEnergy(actor, 1);
      if (!spent) {
        this.logMessage('Not enough energy to move.');
        return;
      }
      this.logMessage(`${actor.name} moves (consumed 1 energy).`);
      this.updateEnergyUI(actor);
      this.endPlayerTurn();
      return;
    }

    // Attack requires 1 Attack energy (A)
    if (action === 'attack') {
      if (!this.trySpendEnergy(actor, 'A', 1)) {
        this.logMessage('Need 1 Attack energy (A) to attack.');
        return;
      }
      const enemy = this.enemies[0]; // Simple target first enemy for now
      // LOS check using wall/void blockers
      const aPos = actor.pos;
      const ePos = enemy.pos;
      if (!aPos || !ePos){
        this.logMessage('Positions not set.');
        return;
      }
      const canSee = this.hasLineOfSight({ q: aPos.col, r: aPos.row }, { q: ePos.col, r: ePos.row });
      if (!canSee){
        this.logMessage('No line of sight. Attack fails.');
        // refund energy for UX? keep it simple: not refunded
        this.updateEnergyUI(actor);
        return;
      }
      enemy.health -= 5; // Simple damage calculation
      this.logMessage(`${actor.name} attacked ${enemy.name} for 5 damage!`);
      if (enemy.health <= 0) {
        this.logMessage(`${enemy.name} was defeated!`);
        this.enemies = this.enemies.filter(e => e !== enemy);
      }
      this.updateEnergyUI(actor);
      this.endPlayerTurn();
      return;
    }
  }

  trySpendAnyEnergy(actor, amount) {
    for (const type in actor.energyPool) {
      if (actor.energyPool[type] >= amount) {
        actor.energyPool[type] -= amount;
        return true;
      }
    }
    return false;
  }

  trySpendEnergy(actor, type, amount) {
    if (actor.energyPool[type] >= amount) {
      actor.energyPool[type] -= amount;
      return true;
    }
    return false;
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
          // Pull the 4 chosen classes from Party Select if available
          const selected = this.registry.get('partySelected'); // expected array of hero objects
          this.party = Array.isArray(selected) && selected.length ? selected.slice(0,4) : (this.registry.get('party') || this._createDefaultParty());
          this.activeHeroIndex = 0; // default to first
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
  
  // ----- Spells helpers (MVP) -----
  hideAbilities(){
    if (this.abilitiesLayer) {
      this.abilitiesLayer.clear(true, true);
      this.abilitiesLayer = null;
    }
  }

  castSpell(key){
    const actor = this.party[0];
    if (!actor) return;
    if (!this.trySpendEnergy(actor, 'A', 1)) {
      this.logMessage('Need 1 Attack energy (A) to cast.');
      return;
    }
    const spell = this.findSpellByKey(key);
    const enemy = this.enemies[0];
    if (!enemy) return;
    const damage = this.damageForSpell(key, spell);
    enemy.health -= damage;
    this.logMessage(`${actor.name} casts ${spell ? spell.name : key} for ${damage} damage!`);
    if (enemy.health <= 0) {
      this.logMessage(`${enemy.name} was defeated!`);
      this.enemies = this.enemies.filter(e => e !== enemy);
    }
    this.updateEnergyUI(actor);
    this.endPlayerTurn();
  }

  damageForSpell(key, spell){
    if ((key || '').toLowerCase() === 'kindlestrike') return 2;
    if (spell && typeof spell.effect === 'string'){
      const m = spell.effect.match(/(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
    return 2;
  }

  findSpellByKey(key){
    if (!this.spellsData) return null;
    const { spells } = this.spellsData;
    if (!spells) return null;
    return (spells.minor && spells.minor[key]) || (spells.major && spells.major[key]) || null;
  }

  async loadSpells(){
    try{
      const res = await fetch('source/data/spells.json', { cache: 'no-store' });
      this.spellsData = await res.json();
      if (this.party && this.party[0]){
        const hasKindle = this.findSpellByKey('kindlestrike');
        if (hasKindle){
          this.party[0].knownSpells = this.party[0].knownSpells || [];
          if (!this.party[0].knownSpells.includes('kindlestrike')){
            this.party[0].knownSpells.push('kindlestrike');
          }
        }
      }
    }catch(e){
      console.warn('Failed to load spells.json', e);
    }
  }

  // ---- Calibration persistence ----
  _loadCalibration(){
    try{
      const raw = localStorage.getItem('et_board_calib');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d.R === 'number' && d.origin && typeof d.origin.x === 'number' && typeof d.origin.y === 'number'){
        this.hexSize = d.R;
        this.sampleOrigin = { x: d.origin.x, y: d.origin.y };
      }
    }catch(e){
      console.warn('Failed to load calibration', e);
    }
  }

  _saveCalibration(){
    try{
      const payload = { R: this.hexSize, origin: { x: this.sampleOrigin.x, y: this.sampleOrigin.y } };
      localStorage.setItem('et_board_calib', JSON.stringify(payload));
      this.logMessage && this.logMessage('Calibration saved.');
    }catch(e){
      console.warn('Failed to save calibration', e);
    }
  }

  _clearCalibration(){
    try{
      localStorage.removeItem('et_board_calib');
      this.logMessage && this.logMessage('Calibration cleared.');
    }catch(e){
      // noop
    }
  }
}
