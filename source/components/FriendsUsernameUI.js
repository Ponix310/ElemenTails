
// source/components/FriendsUsernameUI.js
// Minimal UI helper for username-based friends list.
// Auto-mounts into #friends-panel if present.
(function(){
  function el(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==='style') Object.assign(n.style, v);
      else if(k.startsWith('on')&&typeof v==='function') n.addEventListener(k.slice(2), v);
      else if(v!=null) n.setAttribute(k, v);
    });
    (Array.isArray(children)?children:[children]).forEach(c=> n.append(c));
    return n;
  }

  function render(container){
    container.innerHTML = '';
    const form = el('div', { style:{display:'flex', gap:'8px', marginBottom:'12px'} }, [
      el('input', { id:'et-friend-input', type:'text', placeholder:'Enter username', style:{flex:'1', padding:'10px', borderRadius:'10px', border:'1px solid #2a3147', background:'#0f1320', color:'#fff'} }),
      el('button', { style:{padding:'10px 14px', borderRadius:'10px', background:'#20c997', color:'#06241e', border:'0', fontWeight:'600', cursor:'pointer', onclick:add } }, 'Add')
    ]);
    const list = el('div', { id:'et-friends-list', style:{display:'grid', gap:'6px'} });
    container.append(form, list);
    refresh(list);
  }

  function add(){
    const input = document.getElementById('et-friend-input');
    const v = (input?.value||'').trim();
    if(!v) return;
    const res = window.ET_Friends.add(v);
    if(!res.ok && res.error==='exists'){ alert('Already in friends.'); }
    input.value='';
    refresh();
  }

  function remove(username){
    window.ET_Friends.remove(username);
    refresh();
  }

  function refresh(target){
    const listEl = target || document.getElementById('et-friends-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    const friends = window.ET_Friends?.list() || [];
    if(!friends.length){
      listEl.append(el('div', { style:{opacity:.7}}, '(none yet)'));
      return;
    }
    friends.forEach(u=>{
      const row = el('div', { style:{display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0f1220', border:'1px solid #2a3147', borderRadius:'10px', padding:'8px 10px'} }, [
        el('span', {}, u),
        el('button', { style:{padding:'6px 10px', borderRadius:'8px', background:'#1e2433', color:'#fff', border:'0', cursor:'pointer', onclick:()=>remove(u)} }, 'Remove')
      ]);
      listEl.append(row);
    });
  }

  // Auto-mount
  document.addEventListener('DOMContentLoaded', ()=>{
    const panel = document.getElementById('friends-panel');
    if(panel) render(panel);
  });

  window.ET_FriendsUI = { render, refresh };
})();
