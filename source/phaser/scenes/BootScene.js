// source/phaser/scenes/BootScene.js
(function(){
  class BootScene extends Phaser.Scene {
    constructor(){ super('Boot'); }
    create(){
      this.scene.start('Load');
    }
  }
  window.ETScenes.BootScene = BootScene;
})();
