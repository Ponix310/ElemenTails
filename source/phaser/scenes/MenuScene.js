// source/phaser/scenes/MenuScene.js
(function(){
  class MenuScene extends Phaser.Scene {
    constructor(){ super('Menu'); }

    create(){
      const { width: W, height: H } = this.scale;

      // background grid
      const g = this.add.graphics();
      g.lineStyle(1, 0x243244, 1);
      for (let x=0; x<=W; x+=64) g.lineBetween(x,0,x,H);
      for (let y=0; y<=H; y+=64) g.lineBetween(0,y,W,y);
      g.setDepth(-1);

      // Title
      this.add.text(W/2, 80, 'ElemenTails — Main Menu', { fontFamily: 'system-ui, Arial', fontSize: '34px', color: '#e5e7eb' }).setOrigin(0.5);

      // Login status + buttons
      this.statusText = this.add.text(60, 150, 'Status: Signed out', { fontFamily:'system-ui, Arial', fontSize:'18px', color:'#cbd5e1' });
      this._button(60, 190, 'Login with Google', 200, async () => {
        try {
          await ETFirebase.ensureAuth();
          ETFirebase.startPresenceHeartbeat();
          this._afterLogin();
        } catch (e) { alert((e && (e.message||e.code)) || 'Login failed'); }
      });
      this._button(60, 245, 'Edit Username', 200, async () => {
        try {
          const cur = ETFirebase.auth.currentUser;
          const proposed = prompt('Enter new username (a-z, 0-9, _  — 3–20):', '');
          if (!proposed) return;
          const uname = await ETFirebase.saveUsername(proposed.trim().toLowerCase());
          alert('Username set to @' + uname);
          this._afterLogin(true);
        } catch (e) { alert(e.message || e.code || 'Could not save username'); }
      });

      // Start button (go Party Select)
      this._button(W/2-130, H-100, 'Start (Party Select)', 260, () => this.scene.start('PartySelect'));

      // Auto-detect existing session and render when ready
      if (ETFirebase && ETFirebase.auth && ETFirebase.auth.onAuthStateChanged){
        ETFirebase.auth.onAuthStateChanged((u)=>{
          if (u){
            ETFirebase.startPresenceHeartbeat();
            this._afterLogin();
          }
        });
      }

      // Friends panel
      this.add.text(W-380, 150, 'Friends', { fontFamily:'system-ui, Arial', fontSize:'20px', color:'#e5e7eb' });
      this.friendsPanel = this.add.rectangle(W-220, H/2, 340, 420, 0x111827).setStrokeStyle(1, 0x2a3147);
      this.friendsItems = [];

      // If already logged in, start presence and render
      if (ETFirebase.auth.currentUser) {
        ETFirebase.startPresenceHeartbeat();
        this._afterLogin();
      }
    }

    async _afterLogin(forceRefresh=false){
      const u = ETFirebase.auth.currentUser;
      if (!u) return;
      const name = u.displayName || u.email || 'Signed in';
      this.statusText.setText('Status: ' + name);
      if (!this._loaded || forceRefresh) await this._loadFriendsOnce(u.uid);
      if (!this._refreshTimer) {
        this._refreshTimer = this.time.addEvent({ delay: 15000, loop: true, callback: () => this._loadFriendsOnce(u.uid) });
      }
    }

    async _loadFriendsOnce(uid){
      const friends = await ETFirebase.listFriends(uid);
      // Clear old items and unsub presence
      if (this._presenceUnsubs){
        this._presenceUnsubs.forEach(fn => { try{fn();}catch{} });
      }
      this._presenceUnsubs = [];
      this.friendsItems.forEach(it => it.destroy());
      this.friendsItems = [];

      const startY = 190;
      const lineH = 34;
      friends.slice(0, 10).forEach((f, i) => {
        const y = startY + i * lineH;
        const dot = this.add.circle(this.friendsPanel.x - 150, y, 6, 0x64748b);
        const label = (f.username && typeof f.username === 'string') ? f.username : (f.uid ? f.uid.slice(0,6) : 'user');
        const name = this.add.text(this.friendsPanel.x - 130, y-10, label, { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#e5e7eb' });
        const pill = this.add.rectangle(this.friendsPanel.x + 120, y-6, 90, 24, 0x1e293b).setStrokeStyle(1, 0x273148);
        const state = this.add.text(pill.x, y-12, 'Offline', { fontFamily:'system-ui, Arial', fontSize:'12px', color:'#93a3b8' }).setOrigin(0.5);

        const unsub = ETFirebase.onPresence(f.uid, (online) => {
          dot.setFillStyle(online ? 0x22c55e : 0x64748b);
          state.setText(online ? 'Online' : 'Offline');
        });
        this._presenceUnsubs.push(unsub);

        this.friendsItems.push(dot, name, pill, state);
      });

      if (friends.length === 0){
        const msg = this.add.text(this.friendsPanel.x - 140, this.friendsPanel.y - 10, '(No friends yet)', { fontFamily:'system-ui, Arial', fontSize:'14px', color:'#93a3b8' });
        this.friendsItems.push(msg);
      }
      this._loaded = true;
    }

    _button(x, y, label, width, onClick){
      const btn = this.add.rectangle(x + width/2, y, width, 48, 0x1e293b).setStrokeStyle(1, 0x2a3147).setInteractive({useHandCursor:true});
      const txt = this.add.text(btn.x, btn.y-12, label, { fontFamily:'system-ui, Arial', fontSize:'16px', color:'#e5e7eb' }).setOrigin(0.5);
      btn.on('pointerover', ()=> btn.setFillStyle(0x263244));
      btn.on('pointerout', ()=> btn.setFillStyle(0x1e293b));
      btn.on('pointerdown', onClick);
      return btn;
    }

    shutdown(){
      if (this._presenceUnsubs){
        this._presenceUnsubs.forEach(fn => { try{fn();}catch{} });
        this._presenceUnsubs = null;
      }
      if (this._refreshTimer){
        this._refreshTimer.remove(false);
        this._refreshTimer = null;
      }
      ETFirebase.stopPresenceHeartbeat();
    }
  }
  window.ETScenes.MenuScene = MenuScene;
})();
