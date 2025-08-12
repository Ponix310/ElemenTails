
// source/components/FriendsUsernameUI.js
// Step 2: Firebase-powered Friends panel (search by username, validate, add/remove, realtime list)
// Requires Firebase Auth + Firestore loaded on the page.
// Collection layout assumed by rules:
//   /usernames/{lowerUsername} -> { uid }
//   /users/{uid}/friends/{friendUid} -> { uid, username, usernameLower, addedAt }
(function(){
  // ---- Helpers ----
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
    const st = document.createElement('style');
    st.id = 'et-friends-style';
    st.textContent = css;
    document.head.appendChild(st);
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

  // ---- Firebase shims ----
  function needFirebase(){
    const ok = !!(window.firebase && firebase.auth && firebase.firestore);
    if(!ok) console.warn('[FriendsUI] Firebase SDK (auth + firestore) is required.');
    return ok;
  }

  // ---- Rendering & logic ----
  let unsub = null; // snapshot unsubscribe
  let listEl, statusEl, inputEl, addBtn;

  function setStatus(msg, ok=null){
    if(!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'et-friends-status ' + (ok===true ? 'et-ok' : ok===false ? 'et-err' : 'et-muted');
  }

  async function add(){
    if(!needFirebase()) return;
    const v = norm(inputEl?.value);
    if(!v){ setStatus('Type a username.', false); return; }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const me = auth.currentUser;
    if(!me){ setStatus('Sign in first.', false); return; }

    try{
      addBtn.disabled = true;
      setStatus('Searching…', null);

      // 1) Resolve username -> uid
      const uLower = lower(v);
      const claim = await db.collection('usernames').doc(uLower).get();
      if(!claim.exists){
        setStatus('User not found.', false);
        addBtn.disabled = false;
        return;
      }
      const friendUid = claim.data()?.uid;
      if(!friendUid){ setStatus('User not found.', false); addBtn.disabled=false; return; }
      if(friendUid === me.uid){ setStatus('That’s you 🙂', false); addBtn.disabled=false; return; }

      // 2) Fetch display username
      const prof = await db.collection('users').doc(friendUid).get();
      const username = prof.exists ? (prof.data()?.username || v) : v;

      // 3) Upsert friend doc (id = friendUid)
      const friendRef = db.collection('users').doc(me.uid).collection('friends').doc(friendUid);
      const snap = await friendRef.get();
      if(snap.exists){
        setStatus('Already in your friends.', true);
      }else{
        await friendRef.set({
          uid: friendUid,
          username: username,
          usernameLower: uLower,
          addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setStatus('Friend added ✔', true);
      }
      inputEl.value = '';
    }catch(e){
      console.error(e);
      // Common errors: permission-denied if rules not updated
      setStatus('Could not add friend.', false);
    }finally{
      addBtn.disabled = false;
    }
  }

  async function remove(friendUid){
    if(!needFirebase()) return;
    const auth = firebase.auth();
    const db = firebase.firestore();
    const me = auth.currentUser;
    if(!me) return;
    try{
      await db.collection('users').doc(me.uid).collection('friends').doc(friendUid).delete();
      setStatus('Removed.', true);
    }catch(e){
      console.error(e);
      setStatus('Could not remove.', false);
    }
  }

  function watchList(){
    if(!needFirebase()) return;
    const auth = firebase.auth();
    const db = firebase.firestore();
    if(unsub) { unsub(); unsub = null; }
    const me = auth.currentUser;
    if(!me){ renderList([]); return; }
    unsub = db.collection('users').doc(me.uid).collection('friends')
      .orderBy('usernameLower')
      .onSnapshot(snap => {
        const arr = [];
        snap.forEach(d => arr.push(Object.assign({id:d.id}, d.data())));
        renderList(arr);
      }, err => {
        console.error(err);
        setStatus('Could not load friends.', false);
      });
  }

  function renderList(items){
    if(!listEl) return;
    listEl.innerHTML = '';
    if(!items.length){
      listEl.append(el('div', { class:'et-muted' }, '(none yet)'));
      return;
    }
    items.forEach(it => {
      const row = el('div', { class:'et-friends-item' }, [
        el('span', {}, it.username || it.usernameLower || it.id),
        el('div', {}, [
          el('button', { class:'et-friends-btn secondary', onclick: ()=>remove(it.id) }, 'Remove')
        ])
      ]);
      listEl.append(row);
    });
  }

  function render(container){
    injectStyle();
    container.innerHTML = '';
    inputEl = el('input', { id:'et-friend-input', type:'text', placeholder:'Enter username', class:'et-friends-input', onkeydown:(e)=>{ if(e.key==='Enter') add(); } });
    addBtn = el('button', { class:'et-friends-btn', onclick:add }, 'Add');
    statusEl = el('div', { class:'et-friends-status et-muted' }, '');
    listEl = el('div', { id:'et-friends-list', class:'et-friends-list' });

    container.append(
      el('div', { class:'et-friends' }, [
        el('div', { class:'et-friends-row' }, [inputEl, addBtn]),
        statusEl,
        listEl
      ])
    );

    // Start realtime list if already signed in; re-bind on auth changes
    if(needFirebase()){
      firebase.auth().onAuthStateChanged(()=> watchList());
    }
  }

  // Auto-mount if #friends-panel exists
  document.addEventListener('DOMContentLoaded', ()=>{
    const panel = document.getElementById('friends-panel');
    if(panel) render(panel);
  });

  // Expose for manual mounting if needed
  window.ET_FriendsUI = { render };
})();
