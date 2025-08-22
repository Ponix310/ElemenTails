// source/phaser/game.js
import MapScene from './scenes/MapScene.js';
import CombatScene from './scenes/CombatScene.js';
import { gameState } from './data/game_state.js';

// Initialize game configuration
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
  scene: [
    MapScene,
    CombatScene
  ]
};

// Create game instance
const game = new Phaser.Game(config);

// Make game state globally available for debugging
window.gameState = gameState;
