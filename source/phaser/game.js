// source/phaser/game.js
(function () {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#0b1220',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    scene: []
  };

  const game = new Phaser.Game(config);

  function addScene(key, ctor) {
    game.scene.add(key, ctor, false);
  }

  // Import scenes (attached to window by their files)
  addScene('Boot', window.ETScenes.BootScene);
  addScene('Load', window.ETScenes.LoadScene);
  addScene('Menu', window.ETScenes.MenuScene);
  addScene('PartySelect', window.ETScenes.PartySelectScene);
  addScene('Combat', window.ETScenes.CombatScene);

  // Start boot
  game.scene.start('Boot');
})();
