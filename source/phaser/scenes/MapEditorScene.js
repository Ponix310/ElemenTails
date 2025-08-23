// source/phaser/scenes/MapEditorScene.js
export default class MapEditorScene extends Phaser.Scene {
  constructor(){
    super('MapEditor');
    this.hexSize = 36; // radius (match CombatScene default)
    this.gridCols = 17; // a nice compact board by default
    this.gridRows = 13;
    this.boardOrigin = { x: 300, y: 80 };
    this.grid = []; // cells: {q,r,x,y,type}
    this.brush = 'ground';
    this.dragPaint = false;
  }

  create(){
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W/2, H/2, W, H, 0x0b1220);

    // Build grid data and render layer
    this.gridLayer = this.add.layer();
    this.uiLayer = this.add.layer();
    this._buildGrid();
    this._renderGrid();

    // UI: palette + actions
    this._buildToolbar();

    // Input for painting
    this.input.on('pointerdown', (p)=>{ this.dragPaint = true; this._paintAt(p); });
    this.input.on('pointermove', (p)=>{ if (this.dragPaint) this._paintAt(p); });
    this.input.on('pointerup', ()=>{ this.dragPaint = false; });

    // Shortcuts
    this.input.keyboard.on('keydown-ONE', ()=> this._setBrush('ground'));
    this.input.keyboard.on('keydown-TWO', ()=> this._setBrush('wall'));
    this.input.keyboard.on('keydown-THREE', ()=> this._setBrush('void'));
    this.input.keyboard.on('keydown-FOUR', ()=> this._setBrush('playerSpawn'));
    this.input.keyboard.on('keydown-FIVE', ()=> this._setBrush('enemySpawn'));
    this.input.keyboard.on('keydown-S', ()=> this._exportPNG());
    this.input.keyboard.on('keydown-J', ()=> this._exportJSON());
    this.input.keyboard.on('keydown-R', ()=> this._clearBoard());
  }

  _buildToolbar(){
    const { width: W } = this.scale;
    const startX = 40; let x = startX; const y = 30; const w=120, h=32, pad=12;
    const mkBtn = (label, onClick)=>{
      const bg = this.add.rectangle(x, y, w, h, 0x1e293b).setStrokeStyle(1, 0x64748b).setInteractive();
      const txt = this.add.text(x, y, label, { fontFamily:'Arial', fontSize:'14px', color:'#e5e7eb' }).setOrigin(0.5);
      bg.on('pointerdown', onClick);
      this.uiLayer.addMultiple([bg, txt]);
      x += w + pad;
      return bg;
    };
    mkBtn('1 Ground', ()=> this._setBrush('ground'));
    mkBtn('2 Wall', ()=> this._setBrush('wall'));
    mkBtn('3 Void', ()=> this._setBrush('void'));
    mkBtn('4 Player', ()=> this._setBrush('playerSpawn'));
    mkBtn('5 Enemy', ()=> this._setBrush('enemySpawn'));
    mkBtn('Save PNG (S)', ()=> this._exportPNG());
    mkBtn('Save JSON (J)', ()=> this._exportJSON());
    mkBtn('Clear (R)', ()=> this._clearBoard());

    this.statusText = this.add.text(W - 10, y, 'Brush: ground', { fontFamily:'Arial', fontSize:'14px', color:'#94a3b8' }).setOrigin(1,0.5);
    this.uiLayer.add(this.statusText);
  }

  _setBrush(type){
    this.brush = type;
    this.statusText.setText(`Brush: ${type}`);
  }

  _buildGrid(){
    const R = this.hexSize;
    this.grid = [];
    for (let r=0; r<this.gridRows; r++){
      const row = [];
      for (let q=0; q<this.gridCols; q++){
        const p = this._hexFlatToPixel(q, r, R);
        const x = this.boardOrigin.x + p.x;
        const y = this.boardOrigin.y + p.y;
        row.push({ q, r, x, y, type: 'ground' });
      }
      this.grid.push(row);
    }
  }

  _renderGrid(){
    this.gridLayer.removeAll(true);
    const R = this.hexSize;
    for (let r=0; r<this.gridRows; r++){
      for (let q=0; q<this.gridCols; q++){
        const t = this.grid[r][q];
        const color = this._colorFor(t.type);
        const pts = this._hexCornersFlat(t.x, t.y, R);
        const poly = this.add.polygon(t.x, t.y, pts, color).setStrokeStyle(1, 0x000000).setOrigin(0.5).setInteractive(new Phaser.Geom.Polygon(pts), Phaser.Geom.Polygon.Contains);
        poly.on('pointerdown', ()=>{ this._paintCell(q,r); });
        poly.on('pointerover', (pointer)=>{ if (this.dragPaint) this._paintCell(q,r); });
        this.gridLayer.add(poly);
        t._poly = poly;
      }
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

  _paintAt(pointer){
    const p = { x: pointer.worldX - this.boardOrigin.x, y: pointer.worldY - this.boardOrigin.y };
    const { q, r } = this._pixelToAxial(p.x, p.y, this.hexSize);
    if (q<0 || r<0 || r>=this.gridRows || q>=this.gridCols) return;
    this._paintCell(q,r);
  }

  _paintCell(q,r){
    const cell = this.grid[r][q];
    if (!cell) return;
    cell.type = this.brush;
    cell._poly.setFillStyle(this._colorFor(cell.type));
  }

  _clearBoard(){
    for (let r=0; r<this.gridRows; r++){
      for (let q=0; q<this.gridCols; q++){
        this.grid[r][q].type = 'ground';
        this.grid[r][q]._poly.setFillStyle(this._colorFor('ground'));
      }
    }
  }

  // Exports a PNG mask using the same color scheme used by CombatScene parser
  _exportPNG(){
    const R = this.hexSize;
    // Compute image bounds from last cell center + padding
    const last = this.grid[this.gridRows-1][this.gridCols-1];
    const width = Math.ceil(this.boardOrigin.x + (this._hexFlatToPixel(this.gridCols-1, this.gridRows-1, R).x + R + 2));
    const height = Math.ceil(this.boardOrigin.y + (this._hexFlatToPixel(this.gridCols-1, this.gridRows-1, R).y + R + 2));

    // Draw onto an offscreen canvas at exact centers aligned from sampleOrigin assumptions
    const canvas = document.createElement('canvas');
    // We export only the map area starting from (0,0) relative to sampling model -> use tight size
    const imgW = Math.ceil(R * (1.5 * (this.gridCols-1)) + R * 2);
    const imgH = Math.ceil(R * (Math.sqrt(3) * (this.gridRows-1 + (this.gridCols-1)/2)) + R * 2);
    canvas.width = imgW; canvas.height = imgH;
    const ctx = canvas.getContext('2d');

    const colorRGB = (type)=>{
      switch(type){
        case 'void': return [255,255,255,255];
        case 'wall': return [0,0,0,255];
        case 'playerSpawn': return [59,130,246,255];
        case 'enemySpawn': return [220,38,38,255];
        default: return [148,163,184,255];
      }
    };

    // Fill background as void for safety
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,imgW,imgH);

    // Paint hex centers as filled hexes with the appropriate color
    for (let r=0; r<this.gridRows; r++){
      for (let q=0; q<this.gridCols; q++){
        const p = this._hexFlatToPixel(q, r, R);
        const [rC,gC,bC] = colorRGB(this.grid[r][q].type);
        ctx.fillStyle = `rgb(${rC},${gC},${bC})`;
        const pts = this._hexCornersFlat(p.x + R, p.y + R, R-0.5); // shift by R so image origin maps to first center at R,R
        ctx.beginPath();
        ctx.moveTo(pts[0]-this.boardOrigin.x, pts[1]-this.boardOrigin.y);
        for (let i=2;i<pts.length;i+=2){
          ctx.lineTo(pts[i]-this.boardOrigin.x, pts[i+1]-this.boardOrigin.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    const link = document.createElement('a');
    link.download = `map_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  _exportJSON(){
    const payload = {
      hexSize: this.hexSize,
      cols: this.gridCols,
      rows: this.gridRows,
      cells: this.grid.flat().map(c=>({ q:c.q, r:c.r, type:c.type }))
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Hex math (flat-top) ---
  _hexFlatToPixel(q, r, R){
    const x = R * (1.5 * q);
    const y = R * (Math.sqrt(3) * (r + q/2));
    return { x: x + R, y: y + R }; // ensure first center near (R,R) for exported image
  }

  _hexCornersFlat(cx, cy, R){
    const angles = [0, 60, 120, 180, 240, 300].map(a => (Math.PI/180)*a);
    const pts = [];
    for (const a of angles){
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      pts.push(x, y);
    }
    return pts;
  }

  // Approximate axial from pixel for painting (flat-top)
  _pixelToAxial(x, y, R){
    // reverse of _hexFlatToPixel with origin at R,R
    const px = x - R;
    const py = y - R;
    const qf = (2/3) * px / R;
    const rf = (-1/3) * px / R + (Math.sqrt(3)/3) * py / R;
    // cube rounding
    const x1 = qf;
    const z1 = rf;
    const y1 = -x1 - z1;
    let rx = Math.round(x1);
    let ry = Math.round(y1);
    let rz = Math.round(z1);

    const x_diff = Math.abs(rx - x1);
    const y_diff = Math.abs(ry - y1);
    const z_diff = Math.abs(rz - z1);

    if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
    else if (y_diff > z_diff) ry = -rx - rz;
    else rz = -rx - ry;

    const q = rx;
    const r = rz;
    return { q, r };
  }
}
