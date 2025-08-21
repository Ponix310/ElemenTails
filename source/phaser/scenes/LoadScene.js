// source/phaser/scenes/LoadScene.js
(function(){
  class LoadScene extends Phaser.Scene {
    constructor(){ super('Load'); }
    preload(){
      // visuals
      this.load.image('logo', 'source/phaser/assets/logo.png');
      // data examples
      this.load.json('elements', 'source/data/elements.json');

      // simple progress bar
      const w = this.scale.width, h = this.scale.height;
      const g = this.add.graphics();
      this.load.on('progress', (p)=>{
        g.clear();
        g.fillStyle(0x1f2937,1).fillRect(w*0.2, h*0.55, w*0.6, 24);
        g.fillStyle(0x60a5fa,1).fillRect(w*0.2, h*0.55, w*0.6*p, 24);
      });
    }
    create(){
      this.scene.start('Menu');
    }
  }
  window.ETScenes.LoadScene = LoadScene;
})();
