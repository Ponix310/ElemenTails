// source/phaser/scenes/Template73EditorScene.js
// A minimal level editor for the canonical 73-cell hex grid template.
// - Loads template_73.json (fixed axial coords + stable indices 0..72)
// - Renders interactive hexes you can paint with brushes
// - Toggle index overlay (N)
// - Export compact assignment JSON by indices (J)
// - Save PNG snapshot of the board (S)

export default class Template73EditorScene extends Phaser.Scene {
  constructor(){
    super('Template73Editor');
    this.hexSize = 38; // visual radius
    this.cells = [];   // array of { i, q, r, x, y, type, _poly, _label }
    this.template = null;
    this.brush = 'ground';
    this.showIndices = true;
    this.dragPaint = false;
    this.isPanning = false;
    this.boardOrigin = { x: 0, y: 0 };
  }

  preload(){
    this.load.json('hex73', 'source/phaser/assets/maps/template_73.json');
  }

  create(){
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W/2, H/2, W, H, 0x0b1220);

    this.gridLayer = this.add.layer();
    this.uiLayer = this.add.layer();

    this.template = this.cache.json.get('hex73');
    // If you want a true hex (radius~5) but trimmed to 73 cells, generate it here
    if (this.template && this.template.layout === 'flat_top_axial'){
      this.template.cells = this._generateTrimmedHex73();
      this.template.templateName = 'hex73_trimmed_r5_to_73';
      this.template.columnProfile = 'trimmed from r=5 (91) by removing 3 middle cells per side on outer ring';
    }
    this._fitBoardToView();
    this._buildCellsFromTemplate();
    this._renderCells();
    this._buildToolbar();

    // Refit on window resize without losing paint
    this._onResize = ()=>{
      this._fitBoardToView();
      // Recompute positions from axial q/r using new hexSize/origin
      const R = this.hexSize;
      this.cells.forEach(c=>{
        const p = this._axialToPixel(c.q, c.r, R);
        c.x = this.boardOrigin.x + p.x;
        c.y = this.boardOrigin.y + p.y;
      });
      this._renderCells();
    };
    this.scale.on('resize', this._onResize);

    // Inputs
    this.input.on('pointerdown', (p)=>{ if (this.isPanning) return; this.dragPaint = true; this._paintAt(p); });
    this.input.on('pointermove', (p)=>{
      if (this.isPanning){
        const cam = this.cameras.main;
        cam.scrollX -= (p.position.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.position.y - p.prevPosition.y) / cam.zoom;
        return;
      }
      if (this.dragPaint) this._paintAt(p);
    });
    this.input.on('pointerup', ()=>{ this.dragPaint = false; });

    this.input.keyboard.on('keydown-SPACE', ()=>{ this.isPanning = true; this.input.setDefaultCursor('grabbing'); });
    this.input.keyboard.on('keyup-SPACE', ()=>{ this.isPanning = false; this.input.setDefaultCursor('default'); });

    // Phaser wheel signature: (pointer, currentlyOver, dx, dy, dz)
    this.input.on('wheel', (pointer, over, dx, dy, dz)=>{
      const cam = this.cameras.main;
      const factor = (dy > 0) ? 0.9 : 1.1; // dy>0 => scroll down => zoom out
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, 0.5, 2.5));
      this._updateStatus();
    });

    // Shortcuts
    this.input.keyboard.on('keydown-ONE', ()=> this._setBrush('ground'));
    this.input.keyboard.on('keydown-TWO', ()=> this._setBrush('wall'));
    this.input.keyboard.on('keydown-THREE', ()=> this._setBrush('void'));
    this.input.keyboard.on('keydown-FOUR', ()=> this._setBrush('playerSpawn'));
    this.input.keyboard.on('keydown-FIVE', ()=> this._setBrush('enemySpawn'));
    this.input.keyboard.on('keydown-N', ()=> this._toggleIndices());
    this.input.keyboard.on('keydown-J', ()=> this._exportAssignmentJSON());
    this.input.keyboard.on('keydown-S', ()=> this._exportPNG());
  }

  // --- Build & Render ---
  _fitBoardToView(){
    const { width: W, height: H } = this.scale;
    const margin = 180;
    // 1) Measure bounds at R=1 (offset inside _axialToPixel doesn't affect width/height)
    const measureBounds = (R)=>{
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      for (const c of this.template.cells){
        const p = this._axialToPixel(c.q, c.r, R);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
    };
    const b1 = measureBounds(1);
    const scaleX = (W - margin) / (b1.width + 2);  // +2 for stroke/edge slack
    const scaleY = (H - margin) / (b1.height + 2);
    this.hexSize = Math.max(18, Math.floor(Math.min(scaleX, scaleY)));

    // 2) Recompute bounds at final R to center precisely
    const bf = measureBounds(this.hexSize);
    const boardW = bf.width;
    const boardH = bf.height;
    this.boardOrigin.x = Math.floor((W - boardW) / 2 - bf.minX);
    this.boardOrigin.y = Math.floor((H - boardH) / 2 - bf.minY);
    this.cameras.main.setZoom(1.0);
  }

  _buildCellsFromTemplate(){
    const R = this.hexSize;
    this.cells = this.template.cells.map(c => {
      const p = this._axialToPixel(c.q, c.r, R);
      return { i:c.i, q:c.q, r:c.r, x: this.boardOrigin.x + p.x, y: this.boardOrigin.y + p.y, type: 'ground' };
    });
    // sort draw order by y for nicer overlaps (not strictly needed for polygons but good for future sprites)
    this.cells.sort((a,b)=> a.y - b.y || a.x - b.x);
  }

  // Build a true radius-5 flat-top hex (91 cells) and trim 3 mid-edge cells on each side -> 73
  _generateTrimmedHex73(){
    const R = 5;
    const all = [];
    for (let q = -R; q <= R; q++){
      for (let r = -R; r <= R; r++){
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= R){
          all.push({ q, r });
        }
      }
    }

    // Build the outer ring as 6 sides of length R; start at cube (0,-R,R)
    const dirs = [
      { x: 1, y:-1, z: 0 },
      { x: 1, y: 0, z:-1 },
      { x: 0, y: 1, z:-1 },
      { x:-1, y: 1, z: 0 },
      { x:-1, y: 0, z: 1 },
      { x: 0, y:-1, z: 1 }
    ];
    let cur = { x: 0, y: -R, z: R };
    const sides = [[],[],[],[],[],[]];
    for (let s = 0; s < 6; s++){
      for (let step = 0; step < R; step++){
        cur = { x: cur.x + dirs[s].x, y: cur.y + dirs[s].y, z: cur.z + dirs[s].z };
        sides[s].push({ ...cur });
      }
    }

    const remove = new Set();
    for (let s = 0; s < 6; s++){
      for (const k of [1,2,3]){ // middle 3 of 5 along each side
        const c = sides[s][k];
        const q = c.x; const r = c.z; // convert cube->axial (q=x, r=z)
        remove.add(`${q},${r}`);
      }
    }

    const kept = [];
    for (const {q,r} of all){
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist < R) { kept.push({ q, r }); continue; }
      if (dist === R && !remove.has(`${q},${r}`)) kept.push({ q, r });
    }

    // Stable indices row-major by r then q
    kept.sort((a,b)=> a.r - b.r || a.q - b.q);
    return kept.map((c,i)=> ({ i, q:c.q, r:c.r }));
  }

  _renderCells(){
    this.gridLayer.removeAll(true);
    const R = this.hexSize;
    for (const cell of this.cells){
      const color = this._colorFor(cell.type);
      const pts = this._hexCornersFlat(R); // relative points around (0,0)
      const poly = this.add.polygon(cell.x, cell.y, pts, color)
        .setStrokeStyle(2, 0x0f172a)
        .setOrigin(0.5)
        .setInteractive(new Phaser.Geom.Polygon(pts), Phaser.Geom.Polygon.Contains);
      poly.on('pointerdown', (pointer)=>{
        if (pointer.altKey) { this._pickBrushFromCell(cell); return; }
        this._paintCell(cell);
      });
      poly.on('pointerover', ()=>{ if (this.dragPaint) this._paintCell(cell); });
      cell._poly = poly;
      this.gridLayer.add(poly);

      if (this.showIndices){
        const txt = this.add.text(cell.x, cell.y, String(cell.i), { fontFamily:'Arial', fontSize:'12px', color:'#0b1220' }).setOrigin(0.5);
        cell._label = txt;
        this.gridLayer.add(txt);
      }
    }
    this._updateStatus();
  }

  shutdown(){
    if (this._onResize){
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }
  }

  _colorFor(type){
    switch(type){
      case 'wall': return 0x111827; // black
      case 'void': return 0xffffff; // white
      case 'playerSpawn': return 0x3b82f6; // blue
      case 'enemySpawn': return 0xef4444; // red
      default: return 0x94a3b8; // ground gray
    }
  }

  _rerenderLabelsOnly(){
    // toggle labels without rebuilding everything
    for (const c of this.cells){
      if (this.showIndices){
        if (!c._label){
          c._label = this.add.text(c.x, c.y, String(c.i), { fontFamily:'Arial', fontSize:'12px', color:'#0b1220' }).setOrigin(0.5);
          this.gridLayer.add(c._label);
        }
      } else {
        c._label?.destroy();
        c._label = null;
      }
    }
  }

  // --- Painting ---
  _paintAt(pointer){
    const world = { x: pointer.worldX, y: pointer.worldY };
    const c = this._hitTestCell(world.x, world.y);
    if (c) this._paintCell(c);
  }

  _hitTestCell(x, y){
    // simple O(n) hit test using polygon contains (n=73)
    for (const c of this.cells){
      if (c._poly && Phaser.Geom.Polygon.Contains(c._poly.geom, x, y)) return c;
    }
    return null;
  }

  _paintCell(cell){
    cell.type = this.brush;
    cell._poly.setFillStyle(this._colorFor(cell.type));
  }

  _pickBrushFromCell(cell){
    this._setBrush(cell.type);
  }

  _toggleIndices(){
    this.showIndices = !this.showIndices;
    this._rerenderLabelsOnly();
    this._updateStatus();
  }

  // --- UI / Toolbar ---
  _buildToolbar(){
    const { width: W } = this.scale;
    const startX = 40; let x = startX; const y = 30; const w=120, h=32, pad=12;
    const mkBtn = (label, onClick)=>{
      const bg = this.add.rectangle(x, y, w, h, 0x1e293b).setStrokeStyle(1, 0x64748b).setInteractive();
      const txt = this.add.text(x, y, label, { fontFamily:'Arial', fontSize:'14px', color:'#e5e7eb' }).setOrigin(0.5);
      bg.on('pointerdown', onClick);
      this.uiLayer.add([bg, txt]);
      x += w + pad;
    };
    mkBtn('1 Ground', ()=> this._setBrush('ground'));
    mkBtn('2 Wall', ()=> this._setBrush('wall'));
    mkBtn('3 Void', ()=> this._setBrush('void'));
    mkBtn('4 Player', ()=> this._setBrush('playerSpawn'));
    mkBtn('5 Enemy', ()=> this._setBrush('enemySpawn'));
    mkBtn('Toggle # (N)', ()=> this._toggleIndices());
    mkBtn('Save JSON (J)', ()=> this._exportAssignmentJSON());
    mkBtn('Save PNG (S)', ()=> this._exportPNG());

    this.statusText = this.add.text(W - 10, y, '', { fontFamily:'Arial', fontSize:'14px', color:'#94a3b8' }).setOrigin(1,0.5);
    this.uiLayer.add(this.statusText);
    this._updateStatus();
  }

  _setBrush(type){
    this.brush = type;
    this._updateStatus();
  }

  _updateStatus(){
    const z = this.cameras.main.zoom.toFixed(2);
    const idx = this.showIndices ? 'on' : 'off';
    this.statusText?.setText(`Brush: ${this.brush} | Zoom: ${z} | Indices: ${idx}`);
  }

  // --- Exporters ---
  _exportAssignmentJSON(){
    // Build compact assignment by indices for each non-ground type
    const byType = { wall:[], void:[], playerSpawn:[], enemySpawn:[] };
    for (const c of this.cells){
      if (c.type === 'ground') continue;
      if (byType[c.type]) byType[c.type].push(c.i);
    }
    const payload = {
      template: this.template.templateName || 'hex73_v1',
      layout: this.template.layout,
      indices: byType
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignment_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _exportPNG(){
    // Simple screenshot of the game canvas (not pixel-perfect mask but useful preview)
    this.game.renderer.snapshot((image)=>{
      const a = document.createElement('a');
      a.href = image.src;
      a.download = `level_${Date.now()}.png`;
      a.click();
    });
  }

  // --- Hex math (flat-top axial) ---
  _axialToPixel(q, r, R){
    // Flat-top axial to pixel (Red Blob):
    // x = size * 3/2 * q
    // y = size * sqrt(3) * (r + q/2)
    const x = R * (1.5 * q) + R;
    const y = R * (Math.sqrt(3) * (r + q/2)) + R;
    return { x, y };
  }

  _hexCornersFlat(R){
    // Flat-top hex: start at 0° then every 60° (top/bottom edges flat)
    const angles = [0, 60, 120, 180, 240, 300].map(a => (Math.PI/180)*a);
    const pts = [];
    for (const a of angles){
      const x = R * Math.cos(a);
      const y = R * Math.sin(a);
      pts.push(x, y);
    }
    return pts;
  }
}
