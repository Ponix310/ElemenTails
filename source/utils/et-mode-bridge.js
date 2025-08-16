// source/utils/et-mode-bridge.js
// Minimal helpers Main Menu can call before navigating to partyselect.html

export function setETMode(mode /* 'single' | 'multi' */){
  localStorage.setItem('ET_mode', mode);
}

export function setETPlayers(list /* string[] length <=4 */){
  try{
    const names = Array.isArray(list) ? list.slice(0,4) : [];
    localStorage.setItem('ET_players', JSON.stringify(names));
  }catch(_){ /* noop */}
}

// Example usage in Main Menu click handlers:
// import { setETMode, setETPlayers } from './source/utils/et-mode-bridge.js';
// setETMode('single'); setETPlayers(['You']); location.href='partyselect.html';
// setETMode('multi');  setETPlayers(['Host']); location.href='partyselect.html';
