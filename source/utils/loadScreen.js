
// source/utils/loadScreen.js
// Simple screen loader that swaps the center stage content.
// Usage: loadScreen('map') or loadScreen('encounter')
(function(){
  async function loadScreen(name){
    const stage = document.getElementById('stage');
    if(!stage) return;
    stage.innerHTML = 'Loading...';
    const resp = await fetch(`source/screens/${name}.html`, { cache: 'no-store' });
    const html = await resp.text();
    stage.innerHTML = html;
    window.dispatchEvent(new CustomEvent('et:screen', { detail: { name } }));
  }
  window.loadScreen = loadScreen;
  document.addEventListener('DOMContentLoaded', ()=>{
    // Default to map unless page sets something else
    if(!stageHasContent()) loadScreen('map');
  });
  function stageHasContent(){
    const stage = document.getElementById('stage');
    return stage && stage.children.length > 0;
  }
})();
