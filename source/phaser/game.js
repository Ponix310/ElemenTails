// source/phaser/game.js
import MapScene from './scenes/MapScene.js';
import CombatScene from './scenes/CombatScene.js';
import { gameState } from '../data/game_state.js';

// Pull globally attached scenes (loaded via non-module scripts)
const MenuScene = (window.ETScenes && window.ETScenes.MenuScene) ? window.ETScenes.MenuScene : null;
const PartySelectScene = (window.ETScenes && window.ETScenes.PartySelectScene) ? window.ETScenes.PartySelectScene : null;

// Initialize game configuration; start at Menu if available
const sceneOrder = [];
if (MenuScene) sceneOrder.push(MenuScene);
if (PartySelectScene) sceneOrder.push(PartySelectScene);
sceneOrder.push(MapScene, CombatScene);

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
  scene: sceneOrder
};

// Create game instance
const game = new Phaser.Game(config);

// Make game state globally available for debugging
window.gameState = gameState;
