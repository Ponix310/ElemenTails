
// source/components/CornerMats.js
// Renders four persistent player mats. UI-only; no game rules here.
// Expects a lightweight state structure on window.ET_STATE with players array.
// Each player: { id, name, className, imageUrl, color, stats: {hp, mana, energy, block, buffs[], debuffs[]}, spells: [ {id,title,iconUrl} ] }
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const el = (tag, attrs={}, children=[])=>{
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k === 'style') Object.assign(n.style, v);
      else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if(v !== undefined && v !== null) n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if(c==null) return;
      if(typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  };

  function renderSlot(spell){
    if(!spell) return el('div', { class: 'et-slot et-slot--empty' }, '+');
    const s = el('div', { class: 'et-slot', title: spell.title });
    const img = el('img', { src: spell.iconUrl || '', alt: spell.title, style: { maxWidth:'90%', maxHeight:'90%', borderRadius: '8px' }});
    s.appendChild(img);
    return s;
  }

  function renderMat(player, isActive){
    const wrap = el('section', { class: 'et-corner', id: player.domId, 'data-player-color': player.color || '' });

    const img = el('div', { class: 'et-mat-image', style: { backgroundImage: `url('${player.imageUrl||''}')` } });
    const name = el('div', { class: 'et-mat-name' }, player.name || player.className || 'Character');
    const badge = el('div', { class: 'et-active-badge', role: 'button', tabindex: 0, title: 'Set active character', onclick: ()=>window.ET_UI?.setActiveCharacter(player.id) }, isActive ? 'Active' : 'Set Active');
    const overlay = el('div', { class: 'et-mat-overlay' }, [name, badge]);

    // Stats pills (UI placeholders; values provided by your state)
    const stats = player.stats || {};
    const statsBar = el('div', { class: 'et-stats' }, [
      el('div', { class: 'et-pill', title: 'HP' }, `HP ${stats.hp ?? '-'}`),
      el('div', { class: 'et-pill', title: 'Mana' }, `MP ${stats.mana ?? '-'}`),
      el('div', { class: 'et-pill', title: 'Energy' }, `EN ${stats.energy ?? '-'}`),
      el('div', { class: 'et-pill', title: 'Block' }, `BL ${stats.block ?? '-'}`),
    ]);
    img.appendChild(statsBar);
    img.appendChild(overlay);

    const slots = el('div', { class: 'et-slots' });
    const spells = player.spells || [];
    for(let i=0;i<6;i++){
      slots.appendChild(renderSlot(spells[i]));
    }

    wrap.appendChild(img);
    wrap.appendChild(slots);
    return wrap;
  }

  function mountCorners(){
    const state = window.ET_STATE || { players: [] };
    const players = state.players || [];
    const activeId = state.activeCharacterId;
    const ids = ['mat-top-left','mat-top-right','mat-bottom-left','mat-bottom-right'];

    players.slice(0,4).forEach((p, idx)=>{
      p.domId = ids[idx];
      const root = document.getElementById(ids[idx]);
      if(root){
        root.innerHTML = '';
        root.appendChild(renderMat(p, p.id === activeId));
      }
    });
  }

  // public UI helpers
  window.ET_UI = Object.assign(window.ET_UI || {}, {
    setActiveCharacter(id){
      if(!window.ET_STATE) window.ET_STATE = {};
      window.ET_STATE.activeCharacterId = id;
      mountCorners();
      // emit a simple event for other systems to listen (optional)
      window.dispatchEvent(new CustomEvent('et:activeCharacter', { detail: { id } }));
    },
    refreshCorners: mountCorners
  });

  // Initial mount after DOM ready
  document.addEventListener('DOMContentLoaded', mountCorners);
})();
