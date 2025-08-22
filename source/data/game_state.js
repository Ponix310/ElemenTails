// source/data/game_state.js
class GameState {
  constructor() {
    this.paths = [];
    this.defeatedDragons = [];
    this.availableElements = ['Fire', 'Water', 'Plant', 'Air', 'Lightning', 'Earth'];
    this.currentPath = null;
    this.initializePaths();
  }

  // Initialize the three paths with random dragons
  initializePaths() {
    this.paths = [
      { id: 0, dragons: [this.getRandomDragon()], isLocked: false },
      { id: 1, dragons: [this.getRandomDragon()], isLocked: false },
      { id: 2, dragons: [this.getRandomDragon()], isLocked: false }
    ];
  }

  // Get a random dragon element that hasn't been used yet
  getRandomDragon() {
    if (this.availableElements.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.availableElements.length);
    return this.availableElements.splice(randomIndex, 1)[0];
  }

  // Select a path and lock it
  selectPath(pathId) {
    if (pathId < 0 || pathId >= this.paths.length) return false;
    if (this.paths[pathId].isLocked) return false;
    
    this.paths.forEach(path => path.isLocked = true);
    this.currentPath = pathId;
    return true;
  }

  // Called when a dragon is defeated
  defeatDragon() {
    if (this.currentPath === null) return false;
    
    const currentPath = this.paths[this.currentPath];
    if (currentPath.dragons.length === 0) return false;
    
    // Move the first dragon to defeated
    const defeatedDragon = currentPath.dragons.shift();
    this.defeatedDragons.push(defeatedDragon);
    
    // If there are still available elements, add them to other paths
    if (this.availableElements.length > 0) {
      this.paths.forEach((path, index) => {
        if (index !== this.currentPath) {
          const newDragon = this.getRandomDragon();
          if (newDragon) {
            path.dragons.push(newDragon);
          }
        }
      });
    }
    
    return true;
  }

  // Check if all dragons are defeated
  isGameComplete() {
    return this.defeatedDragons.length === 6;
  }

  // Get current dragon in the selected path
  getCurrentDragon() {
    if (this.currentPath === null || this.paths[this.currentPath].dragons.length === 0) return null;
    return this.paths[this.currentPath].dragons[0];
  }

  // Reset the game state
  reset() {
    this.availableElements = ['Fire', 'Water', 'Plant', 'Air', 'Lightning', 'Earth'];
    this.defeatedDragons = [];
    this.currentPath = null;
    this.initializePaths();
  }
}

// Export a singleton instance
export const gameState = new GameState();
