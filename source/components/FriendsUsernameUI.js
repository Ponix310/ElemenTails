
// source/components/FriendsUsernameUI.js (diagnostic build)
// Surfaces reasons why "Add" might appear to do nothing.
// - Shows status messages for: script load, Firebase presence, auth state, Firestore reads/writes
// - Works with or without Firebase (falls back to localStorage if Firebase missing)
// - Auto-mounts into #friends-panel
(function(){
  const norm = s => String(s||'').trim();
  const lower = s => norm(s).toLowerCase();

  const css = `
    .et-friends { display:grid; gap:10px; }
    .et-friends-row { display:flex; gap:8px; align-items:center; }
    .et-friends-input { flex:1; padding:10px; border-radius:10px; border:1px solid #2a3147; background:#0f1320; color:#fff }
    .et-friends-btn { padding:10px 14px; border-radius:10px; border:0; background:#20c997; color:#06241e; font-weight:700; cursor:pointer }
    .et-friends-btn.secondary { background:#1e2433; color:#fff }
    .et-friends-status { min-height:18px; font-size:12px }
    .et-ok { color:#63e6be } .et-err { color:#ff6b6b } .et-muted { color:#9aa4b2 }
    .et-friends-list { display:grid; gap:6px }
    .et-friends-item { display:flex; align-items:center; justify-content:space-between; background:#0f1220; border:1px solid #2a3147; border-radius:10px; padding:8px 10px }
  `;
  function injectStyle(){
    if(document.getElementById('et-friends-style')) return;
    const st = document.createElement('style'); st.id='et-friends-style'; st.textContent=css; document.head.appendChild(st);
  }
  function el(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)){
      if(k==='style') Object.assign(n.style, v);
      else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if(v!=null) n.setAttribute(k, v);
    }
    (Array.isArray(children)?children:[children]).forEach(c => n.append(c));
    return n;
  }

  let statusEl, listEl, inputEl, addBtn;
  function setStatus(msg, tone=null){
    if(!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'et-friends-status ' + (tone===true ? 'et-ok' : tone===false ? 'et-err' : 'et-muted');
    console.log('[FriendsUI]', msg);
  }

  // Local fallback provider (no Firebase)
  const Local = (function(){
    const KEY='etFriendsLocal';
    const read=()=>{ try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return[];} };
    const write=(v)=>localStorage.setItem(KEY, JSON.stringify(v));
    return {
      label:'local-fallback',
      async addByUsername(u){
        const arr=read(); const uname=norm(u);
        if(!uname) return {ok:false,error:'empty'};
        if(arr.some(x => lower(x.username||x)===lower(uname))) return {ok:false,error:'exists'};
        arr.push({id:lower(uname), username:uname}); write(arr); return {ok:true};
      },
      async list(){ return read(); },
      async remove(id){ write(read().filter(x => (x.id||lower(x.username)) !== id)); return {ok:true}; }
    };
  })();

  // Firebase provider
  const FB = (function(){
    function hasSDK(){ return !!(window.firebase && firebase.auth && firebase.firestore); }
    async function addByUsername(u){
      if(!hasSDK()) return {ok:false,error:'no_firebase'};
      const auth=firebase.auth(), db=firebase.firestore();
      const me=auth.currentUser; if(!me) return {ok:false,error:'no_auth'};
      const uname=norm(u); const unameLower=lower(uname);
      try{
        const claim=await db.collection('usernames').doc(unameLower).get();
        if(!claim.exists) return {ok:false,error:'not_found'};
        const friendUid=claim.data()?.uid;
        if(!friendUid) return {ok:false,error:'not_found'};
        if(friendUid===me.uid) return {ok:false,error:'self'};
        const prof=await db.collection('users').doc(friendUid).get();
        const display = prof.exists ? (prof.data()?.username || uname) : uname;
        const ref=db.collection('users').doc(me.uid).collection('friends').doc(friendUid);
        const snap=await ref.get();
        if(snap.exists) return {ok:false,error:'exists'};
        await ref.set({ uid: friendUid, username: display, usernameLower: unameLower, addedAt: firebase.firestore.FieldValue.serverTimestamp() });
        return {ok:true};
      }catch(e){ console.error('[FriendsUI] add error', e); return {ok:false,error:'firestore'}; }
    }
    async function list(){
      if(!hasSDK()) return [];
      const auth=firebase.auth(), db=firebase.firestore();
      const me=auth.currentUser; if(!me) return [];
      const qs=await db.collection('users').doc(me.uid).collection('friends').orderBy('usernameLower').get();
      return qs.docs.map(d => Object.assign({id:d.id}, d.data()));
    }
    async function remove(id){
      if(!hasSDK()) return {ok:false,error:'no_firebase'};
      const auth=firebase.auth(), db=firebase.firestore();
      const me=auth.currentUser; if(!me) return {ok:false,error:'no_auth'};
      await db.collection('users').doc(me.uid).collection('friends').doc(id).delete();
      return {ok:true};
    }
    function watch(callback, errorCb){
      if(!hasSDK()) return ()=>{};
      const auth=firebase.auth(), db=firebase.firestore();
      return auth.onAuthStateChanged(user=>{
        if(!user){ callback([]); return; }
        const unsub = db.collection('users').doc(user.uid).collection('friends').orderBy('usernameLower')
          .onSnapshot(s=>{ callback(s.docs.map(d=>Object.assign({id:d.id}, d.data()))); }, errorCb);
        callback.__unsub && callback.__unsub();
        callback.__unsub = ()=>{ try{unsub();}catch{} };
      });
    }
    return { label:'firebase', addByUsername, list, remove, watch, hasSDK };
  })();

  const Provider = (FB.hasSDK && FB.hasSDK()) ? FB : Local;

  function render(container){
    injectStyle();
    container.innerHTML = '';
    inputEl = el('input', { class:'et-friends-input', placeholder:'Enter username', onkeydown:(e)=>{ if(e.key==='Enter') onAdd(); } });
    addBtn  = el('button', { class:'et-friends-btn', onclick:onAdd }, 'Add');
    statusEl= el('div', { class:'et-friends-status et-muted' }, `Friends UI loaded (${Provider.label}).`);
    listEl  = el('div', { class:'et-friends-list' });

    container.append(
      el('div', { class:'et-friends' }, [
        el('div', { class:'et-friends-row' }, [inputEl, addBtn]),
        statusEl,
        listEl
      ])
    );

    refresh();
    if(Provider.watch){
      try{
        Provider.watch(items=>{ renderList(items); setStatus('Realtime list updated.', true); },
          err=>{ console.error(err); setStatus('Realtime failed.', false); });
      }catch(e){ console.error(e); }
    }
  }

  async function onAdd(){
    setStatus('Processing…', null);
    addBtn.disabled = true;
    try{
      const v = norm(inputEl.value);
      const res = await Provider.addByUsername(v);
      if(!res.ok){
        const msg = res.error==='not_found' ? 'User not found.'
                  : res.error==='exists'    ? 'Already in your friends.'
                  : res.error==='self'      ? 'That’s you 🙂'
                  : res.error==='no_auth'   ? 'Sign in first.'
                  : res.error==='no_firebase'? 'Firebase not loaded.'
                  : 'Could not add friend.';
        setStatus(msg, false);
      }else{
        setStatus('Friend added ✔', true);
        inputEl.value='';
        refresh();
      }
    }catch(e){
      console.error(e);
      setStatus('Unexpected error adding friend.', false);
    }finally{
      addBtn.disabled = false;
    }
  }

  async function refresh(){
    try{
      const items = await Provider.list();
      renderList(items);
      if(Provider.label==='local-fallback'){
        setStatus('Firebase not detected — using local-only mode. Include Firebase SDK for live search.', false);
      }else{
        setStatus('Ready.', true);
      }
    }catch(e){
      console.error(e);
      setStatus('Could not load friends.', false);
    }
  }

  function renderList(items){
    listEl.innerHTML = '';
    if(!items || !items.length){
      listEl.append(el('div', { class:'et-muted' }, '(none yet)'));
      return;
    }
    items.forEach(it=>{
      const name = it.username || it.usernameLower || it.id;
      listEl.append(el('div', { class:'et-friends-item' }, [
        el('span', {}, name),
        el('div', {}, [
          el('button', { class:'et-friends-btn secondary', onclick:()=>remove(it.id) }, 'Remove')
        ])
      ]));
    });
  }

  async function remove(id){
    try{
      await Provider.remove(id);
      setStatus('Removed.', true);
      refresh();
    }catch(e){
      console.error(e);
      setStatus('Could not remove.', false);
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const panel = document.getElementById('friends-panel');
    if(panel){ render(panel); } else { console.warn('[FriendsUI] #friends-panel not found'); }
  });
})();
